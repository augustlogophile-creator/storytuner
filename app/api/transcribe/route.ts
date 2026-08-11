import { getActiveAuthenticatedUser } from "@/lib/require-auth"
import { openAIJson, transcribeWithOpenAI } from "@/lib/openai-server"
import { getMembershipByUserId } from "@/lib/membership-server"
import { enforceDurableUsageRate, isUuid, recordUsageEvent, releaseUsage, reserveUsage, type UsageReservation } from "@/lib/usage-server"
import { rateLimitResponse, rateLimitUser, rejectLargeRequest, runIdempotent } from "@/lib/request-protection"
import { backendError } from "@/lib/backend-log"

export const runtime = "nodejs"
export const maxDuration = 60

const MIN_STORY_WORDS = 50

const cleanupSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    transcript: { type: "string" },
  },
  required: ["title", "transcript"],
}

export async function POST(req: Request) {
  const auth = await getActiveAuthenticatedUser()
  if (!auth.ok) return auth.response
  const user = auth.user
  const oversized = rejectLargeRequest(req, 5 * 1024 * 1024)
  if (oversized) return oversized
  const rate = rateLimitUser(user.id, "transcribe", [
    { limit: 6, windowMs: 10 * 60 * 1000, label: "6/10min" },
    { limit: 20, windowMs: 60 * 60 * 1000, label: "20/hour" },
  ])
  const blocked = rateLimitResponse(rate, "Too many transcription requests are arriving from this account. Wait before trying another recording.")
  if (blocked) return blocked
  try {
    const form = await req.formData()
    const file = form.get("file")
    const requestKey = form.get("requestKey")
    const durationSeconds = Number(form.get("durationSeconds") ?? 0)
    if (!(file instanceof File)) return Response.json({ error: "No recording was provided." }, { status: 400 })
    if (file.size > 4 * 1024 * 1024) return Response.json({ error: "This recording is too large to transcribe." }, { status: 413 })
    if (!isUuid(requestKey)) return Response.json({ error: "This transcription request is missing a valid request key." }, { status: 400 })

    const membership = await getMembershipByUserId(user.id)
    if (!membership.active && Number.isFinite(durationSeconds) && durationSeconds > 300) {
      return Response.json({
        code: "ARENA_DURATION_MEMBERSHIP_REQUIRED",
        error: "Recording targets longer than five minutes require StoryTuner Membership.",
      }, { status: 403 })
    }
    let reservation: UsageReservation | null = null
    if (!membership.active) {
      reservation = await reserveUsage(user.id, "arena_review", requestKey)
      if (!reservation.allowed) {
        return Response.json({
          code: "ARENA_LIMIT_REACHED",
          error: "You have used both free spoken story reviews. Membership unlocks unlimited practice.",
          usage: reservation,
        }, { status: 403, headers: { "Cache-Control": "no-store" } })
      }
    } else {
      await recordUsageEvent(user.id, "arena_review", requestKey)
    }

    const durableRate = await enforceDurableUsageRate(user.id, "arena_review", [
      { limit: 40, windowMs: 60 * 60 * 1000, label: "40/hour" },
      { limit: 120, windowMs: 24 * 60 * 60 * 1000, label: "120/day" },
    ])
    if (!durableRate.allowed) {
      if (reservation && !reservation.alreadyReserved) await releaseUsage(user.id, "arena_review", requestKey).catch(() => undefined)
      return Response.json({ code: "RATE_LIMITED", error: "Arena has received unusually many transcription requests from this account. Wait and try again later." }, { status: 429, headers: { "Cache-Control": "no-store" } })
    }

    let raw: string
    try {
      raw = await runIdempotent(`transcribe:${user.id}:${requestKey}`, () => transcribeWithOpenAI(file), 2 * 60 * 1000)
    } catch (error) {
      if (reservation && !reservation.alreadyReserved) {
        await releaseUsage(user.id, "arena_review", requestKey).catch((releaseError) =>
          backendError("transcription_usage_rollback_failed", releaseError, { userId: user.id, requestKey }),
        )
      }
      throw error
    }

    const rawWordCount = meaningfulWordCount(raw)
    if (rawWordCount < 3) {
      if (reservation && !reservation.alreadyReserved) {
        await releaseUsage(user.id, "arena_review", requestKey).catch((releaseError) =>
          backendError("no_speech_usage_rollback_failed", releaseError, { userId: user.id, requestKey }),
        )
      }
      return Response.json({
        code: "NO_SPEECH",
        wordCount: rawWordCount,
        error: "Weaver could not hear a story. Check your microphone and try another take.",
      }, { status: 422 })
    }
    try {
      const cleaned = await openAIJson<{ title: string; transcript: string }>({
        name: "clean_story_transcript",
        schema: cleanupSchema,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: "You clean spoken-story transcripts for StoryTuner. Preserve the speaker's voice, meaning, sequence of events, and distinctive wording. Remove empty filler such as um, uh, repeated false starts, and unnecessary you-knows. Add capitalization, punctuation, paragraph breaks, and only obvious grammar corrections. Do not improve the story, rearrange events, add details, soften language, or make the speaker sound more formal. Create a natural title of 3 to 8 words based only on the transcript.",
          },
          { role: "user", content: `Raw transcript:\n${raw}` },
        ],
      })
      const text = cleaned.transcript.trim()
      const wordCount = meaningfulWordCount(text)
      return Response.json({ text, title: cleaned.title.trim(), wordCount, minimumWords: MIN_STORY_WORDS, usage: reservation })
    } catch (cleanupError) {
      backendError("transcript_cleanup_failed", cleanupError, { userId: user.id })
      return Response.json({ text: raw, title: titleFrom(raw), wordCount: rawWordCount, minimumWords: MIN_STORY_WORDS, usage: reservation })
    }
  } catch (error) {
    backendError("transcription_route_failed", error, { userId: user.id })
    const message = error instanceof Error && error.message.includes("OPENAI_API_KEY")
      ? "Weaver's AI connection is not configured yet. Add OPENAI_API_KEY in Vercel, then redeploy."
      : "Weaver could not transcribe this recording right now."
    return Response.json({ error: message }, { status: 500 })
  }
}

function meaningfulWordCount(text: string) {
  const fillerWords = new Set(["um", "uh", "erm", "hmm", "mhm", "ah", "eh"])
  const words = text.toLowerCase().match(/[a-z0-9]+(?:['’][a-z0-9]+)*/g) ?? []
  return words.filter((word) => !fillerWords.has(word)).length
}

function titleFrom(text: string) {
  const words = text.replace(/[^\w' -]/g, " ").split(/\s+/).filter(Boolean).slice(0, 6)
  return words.length ? words.join(" ") : "Untitled story"
}
