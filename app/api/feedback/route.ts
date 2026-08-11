import { getActiveAuthenticatedUser } from "@/lib/require-auth"
import { openAIJson } from "@/lib/openai-server"
import { getMembershipByUserId } from "@/lib/membership-server"
import { enforceDurableUsageRate, isUuid, recordUsageEvent, releaseUsage, reserveUsage, type UsageReservation } from "@/lib/usage-server"
import { rateLimitResponse, rateLimitUser, rejectLargeRequest, requestFingerprint, runIdempotent } from "@/lib/request-protection"
import { backendError } from "@/lib/backend-log"

export const runtime = "nodejs"
export const maxDuration = 60

const lessonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pass: { type: "boolean" },
    working: { type: "string" },
    fix: { type: "string" },
  },
  required: ["pass", "working", "fix"],
}

const arenaSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    hook: { type: "integer", minimum: 0, maximum: 100 },
    development: { type: "integer", minimum: 0, maximum: 100 },
    landing: { type: "integer", minimum: 0, maximum: 100 },
    strongest: { type: "string", enum: ["hook", "development", "landing"] },
    weakest: { type: "string", enum: ["hook", "development", "landing"] },
    strengths: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
    },
    improvements: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
    },
    levelUp: { type: "string" },
    revisedStory: { type: "string" },
  },
  required: ["hook", "development", "landing", "strongest", "weakest", "strengths", "improvements", "levelUp", "revisedStory"],
}

const writtenStorySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    headline: { type: "string" },
    scores: {
      type: "object",
      additionalProperties: false,
      properties: {
        structure: { type: "integer", minimum: 0, maximum: 100 },
        detail: { type: "integer", minimum: 0, maximum: 100 },
        emotion: { type: "integer", minimum: 0, maximum: 100 },
      },
      required: ["structure", "detail", "emotion"],
    },
    strengths: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
    improvements: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: { title: { type: "string" }, tip: { type: "string" } },
        required: ["title", "tip"],
      },
    },
    nextStep: { type: "string" },
  },
  required: ["score", "headline", "scores", "strengths", "improvements", "nextStep"],
}

export async function POST(req: Request) {
  const auth = await getActiveAuthenticatedUser()
  if (!auth.ok) return auth.response
  const user = auth.user
  const oversized = rejectLargeRequest(req, 120_000)
  if (oversized) return oversized
  const rate = rateLimitUser(user.id, "feedback", [
    { limit: 15, windowMs: 60_000, label: "15/min" },
    { limit: 120, windowMs: 60 * 60 * 1000, label: "120/hour" },
  ])
  const blocked = rateLimitResponse(rate, "Too many feedback requests are arriving from this account. Wait a moment and try again.")
  if (blocked) return blocked
  try {
    const body = (await req.json()) as Record<string, unknown>
    const mode = typeof body.mode === "string" ? body.mode : "story"

    if (mode === "lesson") {
      const answer = typeof body.answer === "string" ? body.answer.trim() : ""
      if (answer.length < 20) return Response.json({ error: "Write a little more so Weaver can respond usefully." }, { status: 400 })
      if (answer.length > 6000) return Response.json({ error: "Keep lesson responses under 6,000 characters." }, { status: 400 })

      const unitIndex = Number(body.unitIndex ?? 0)
      if (!Number.isInteger(unitIndex) || unitIndex < 1 || unitIndex > 15) {
        return Response.json({ error: "This lesson request is missing a valid unit." }, { status: 400 })
      }
      const membership = await getMembershipByUserId(user.id)
      if (!membership.active && unitIndex > 5) {
        return Response.json({
          code: "LESSON_MEMBERSHIP_REQUIRED",
          error: "The free plan includes the first five lessons. Membership unlocks all fifteen.",
        }, { status: 403 })
      }

      const lessonFingerprint = requestFingerprint(user.id, "lesson", unitIndex, answer, String(body.technique || ""), String(body.prompt || ""))
      const object = await runIdempotent(`lesson-feedback:${lessonFingerprint}`, () => openAIJson<{ pass: boolean; working: string; fix: string }>({
        name: "lesson_feedback",
        schema: lessonSchema,
        messages: [
          {
            role: "system",
            content: "You are Weaver, StoryTuner's precise, warm storytelling coach. Be friendly but sophisticated. Evaluate only the named lesson technique. Refer to the student's actual wording. Give one genuine strength and one concrete revision. Never invent details. Keep the full answer under 100 words.",
          },
          {
            role: "user",
            content: `Unit: ${String(body.unitTitle || "Storytelling")}\nTechnique: ${String(body.technique || "story craft")}\nExercise: ${String(body.prompt || "")}\n\nStudent response:\n${answer}`,
          },
        ],
      }), 90_000)
      return Response.json(object, { headers: { "Cache-Control": "no-store" } })
    }

    if (mode === "arena") {
      const transcript = typeof body.transcript === "string" ? body.transcript.trim() : ""
      if (transcript.length > 30000) return Response.json({ error: "This transcript is too long to review." }, { status: 400 })
      const wordCount = meaningfulWordCount(transcript)
      if (wordCount < 50) {
        return Response.json({
          code: wordCount === 0 ? "NO_SPEECH" : "STORY_TOO_SHORT",
          wordCount,
          error: wordCount === 0
            ? "Weaver could not hear a story. Check your microphone and try another take."
            : `Weaver caught ${wordCount} ${wordCount === 1 ? "word" : "words"}. Tell at least 50 words, then try again.`,
        }, { status: 400 })
      }
      const requestKey = body.requestKey
      if (!isUuid(requestKey)) {
        return Response.json({ error: "This story review is missing a valid request key. Refresh and try again." }, { status: 400 })
      }

      const membership = await getMembershipByUserId(user.id)
      const requestedSeconds = Number(body.targetSeconds ?? body.seconds ?? 0)
      if (!membership.active && Number.isFinite(requestedSeconds) && requestedSeconds > 300) {
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
        return Response.json({ code: "RATE_LIMITED", error: "Arena has received unusually many AI review requests from this account. Wait and try again later." }, { status: 429, headers: { "Cache-Control": "no-store" } })
      }

      try {
        const object = await runIdempotent(`arena-feedback:${user.id}:${requestKey}`, () => openAIJson<{
        hook: number
        development: number
        landing: number
        strongest: "hook" | "development" | "landing"
        weakest: "hook" | "development" | "landing"
        strengths: string[]
        improvements: string[]
        levelUp: string
        revisedStory: string
      }>({
        name: "arena_feedback",
        schema: arenaSchema,
        messages: [
          {
            role: "system",
            content: `You are Weaver, a friendly and sophisticated coach for spoken true stories. Score hook, development, and landing from 0 to 100. Reward clarity, specificity, forward movement, stakes, emotional honesty, and a satisfying ending, not dramatic subject matter.

Return exactly three strengths and exactly three improvements. Each bullet must point to something specific in the transcript, use plain language, and avoid repeating another bullet. The immediate next-step instruction must be one concrete change the storyteller can make right away.

Then write a revised version of the full story. Preserve every real event, the speaker's personality, meaning, and recognizable voice. Remove filler, tighten repetition, improve the opening, clarify the central turn, and strengthen the landing. Do not invent details, dialogue, feelings, or lessons. Do not make the speaker sound formal or unlike themselves.`,
          },
          {
            role: "user",
            content: `Practice mode: ${String(body.context || "Open story")}\nInstruction or prompt: ${String(body.prompt || "Tell a story of your choice")}\nTarget length: ${Number(body.targetSeconds || body.seconds || 0)} seconds\nActual length: ${Number(body.seconds || 0)} seconds\n\nClean transcript:\n${transcript}`,
          },
        ],
        }), 2 * 60 * 1000)
        return Response.json({ ...object, usage: reservation }, { headers: { "Cache-Control": "no-store" } })
      } catch (error) {
        if (reservation && !reservation.alreadyReserved) {
          await releaseUsage(user.id, "arena_review", requestKey).catch((releaseError) =>
            backendError("arena_usage_rollback_failed", releaseError, { userId: user.id, requestKey }),
          )
        }
        throw error
      }
    }

    const story = typeof body.story === "string" ? body.story.trim() : ""
    if (story.length < 20) return Response.json({ error: "Please share a little more of the story." }, { status: 400 })
    const writtenFingerprint = requestFingerprint(user.id, "written-story", story, String(body.title || ""))
    const object = await runIdempotent(`written-feedback:${writtenFingerprint}`, () => openAIJson({
      name: "written_story_feedback",
      schema: writtenStorySchema,
      messages: [
        { role: "system", content: "You are Weaver, a warm, specific storytelling coach. Focus on structure, vivid detail, emotional truth, and a clean landing. Avoid generic praise and never invent details." },
        { role: "user", content: `Title: ${String(body.title || "Untitled")}\n\nStory:\n${story}` },
      ],
    }), 90_000)
    return Response.json(object, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("feedback_route_failed", error, { userId: user.id })
    const message = error instanceof Error && error.message.includes("OPENAI_API_KEY")
      ? "Weaver's AI connection is not configured yet. Add OPENAI_API_KEY in Vercel, then redeploy."
      : "Weaver could not review this right now. Your work is still saved on this device."
    return Response.json({ error: message }, { status: 500 })
  }
}


function meaningfulWordCount(text: string) {
  const fillerWords = new Set(["um", "uh", "erm", "hmm", "mhm", "ah", "eh"])
  const words = text.toLowerCase().match(/[a-z0-9]+(?:['’][a-z0-9]+)*/g) ?? []
  return words.filter((word) => !fillerWords.has(word)).length
}
