import { getActiveAuthenticatedUser } from "@/lib/require-auth"
import { openAIJson } from "@/lib/openai-server"
import { getMembershipByUserId } from "@/lib/membership-server"
import { enforceDurableUsageRate, isUuid, recordUsageEvent, releaseUsage, reserveUsage, type UsageReservation } from "@/lib/usage-server"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser, rejectLargeRequest, requestFingerprint, runIdempotent } from "@/lib/request-protection"
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


const checkpointSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pass: { type: "boolean" },
    score: { type: "integer", minimum: 0, maximum: 100 },
    working: { type: "string" },
    gaps: { type: "string" },
    nextStep: { type: "string" },
  },
  required: ["pass", "score", "working", "gaps", "nextStep"],
}

const arenaSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
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
  required: ["title", "hook", "development", "landing", "strongest", "weakest", "strengths", "improvements", "levelUp", "revisedStory"],
}

const arenaRevisionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    revisedStory: { type: "string" },
  },
  required: ["revisedStory"],
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
  const crossSite = requireSameOrigin(req)
  if (crossSite) return crossSite
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
    const json = await readJsonBody(req, 120_000)
    if (!json.ok) return json.response
    const body = json.value as Record<string, unknown>
    const mode = typeof body.mode === "string" ? body.mode : "story"

    if (mode === "lesson") {
      const answer = typeof body.answer === "string" ? body.answer.trim() : ""
      if (answer.length < 20) return Response.json({ error: "Write a little more so Parch can respond usefully." }, { status: 400 })
      if (answer.length > 6000) return Response.json({ error: "Keep lesson responses under 6,000 characters." }, { status: 400 })

      const unitIndex = Number(body.unitIndex ?? 0)
      if (!Number.isInteger(unitIndex) || unitIndex < 1 || unitIndex > 15) {
        return Response.json({ error: "This lesson request is missing a valid unit." }, { status: 400 })
      }
      let membership
      try {
        membership = await getMembershipByUserId(user.id)
      } catch (error) {
        backendError("feedback_membership_lookup_failed", error, { userId: user.id })
        return Response.json({ code: "MEMBERSHIP_STATUS_UNAVAILABLE", error: "StoryTuner could not verify your membership right now. Try again in a moment." }, { status: 503, headers: { "Cache-Control": "no-store" } })
      }
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
            content: "You are Parch, StoryTuner's precise, warm storytelling coach. Be friendly but sophisticated. Evaluate only the named lesson technique. Refer to the student's actual wording. Give one genuine strength and one concrete revision. Never invent details. Keep the full answer under 100 words.",
          },
          {
            role: "user",
            content: `Unit: ${String(body.unitTitle || "Storytelling")}\nTechnique: ${String(body.technique || "story craft")}\nExercise: ${String(body.prompt || "")}\n\nStudent response:\n${answer}`,
          },
        ],
      }), 90_000)
      return Response.json(object, { headers: { "Cache-Control": "no-store" } })
    }


    if (mode === "checkpoint") {
      const answer = typeof body.answer === "string" ? body.answer.trim() : ""
      if (answer.length < 40) return Response.json({ error: "Write a little more so Parch can grade the test fairly." }, { status: 400 })
      if (answer.length > 12_000) return Response.json({ error: "Keep checkpoint responses under 12,000 characters." }, { status: 400 })

      const afterUnit = Number(body.afterUnit ?? 0)
      if (!Number.isInteger(afterUnit) || afterUnit < 3 || afterUnit > 15) {
        return Response.json({ error: "This checkpoint request is missing a valid course position." }, { status: 400 })
      }

      let membership
      try {
        membership = await getMembershipByUserId(user.id)
      } catch (error) {
        backendError("feedback_membership_lookup_failed", error, { userId: user.id })
        return Response.json({ code: "MEMBERSHIP_STATUS_UNAVAILABLE", error: "StoryTuner could not verify your membership right now. Try again in a moment." }, { status: 503, headers: { "Cache-Control": "no-store" } })
      }
      if (!membership.active && afterUnit > 5) {
        return Response.json({
          code: "LESSON_MEMBERSHIP_REQUIRED",
          error: "This unit test is part of StoryTuner Membership.",
        }, { status: 403 })
      }

      const criteria = Array.isArray(body.criteria)
        ? body.criteria.filter((item): item is string => typeof item === "string").slice(0, 8)
        : []
      const fingerprint = requestFingerprint(user.id, "checkpoint", String(body.checkpointId || ""), answer, criteria.join("|"))
      const object = await runIdempotent(`checkpoint-feedback:${fingerprint}`, () => openAIJson<{
        pass: boolean
        score: number
        working: string
        gaps: string
        nextStep: string
      }>({
        name: "checkpoint_feedback",
        schema: checkpointSchema,
        messages: [
          {
            role: "system",
            content: `You are Parch, StoryTuner's precise course assessor. Grade ONLY the skills listed in the criteria and prompt. These checkpoint tests occur after specific units, so never expect, mention, or penalize the student for techniques that have not been named in the supplied criteria. Refer to the student's actual words. Do not invent missing or present details. Use the full 0–100 scale and grade rigorously. A score around 50 means partial but sufficient application with important gaps; 70 means competent control; 85+ means clear, deliberate, specific application. Keep working, gaps, and nextStep each concise and concrete. pass should be true at 50 or above.`,
          },
          {
            role: "user",
            content: `Checkpoint: ${String(body.checkpointTitle || "Course checkpoint")}
After unit: ${afterUnit}
Challenge type: ${String(body.writingKind || "analysis")}
Prompt: ${String(body.prompt || "")}
Criteria:
- ${criteria.join("\n- ")}

Student response:
${answer}`,
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
            ? "Parch could not hear a story. Check your microphone and try another take."
            : `Parch caught ${wordCount} ${wordCount === 1 ? "word" : "words"}. Tell at least 50 words, then try again.`,
        }, { status: 400 })
      }
      const requestKey = body.requestKey
      if (!isUuid(requestKey)) {
        return Response.json({ error: "This story review is missing a valid request key. Refresh and try again." }, { status: 400 })
      }

      let membership
      try {
        membership = await getMembershipByUserId(user.id)
      } catch (error) {
        backendError("feedback_membership_lookup_failed", error, { userId: user.id })
        return Response.json({ code: "MEMBERSHIP_STATUS_UNAVAILABLE", error: "StoryTuner could not verify your membership right now. Try again in a moment." }, { status: 503, headers: { "Cache-Control": "no-store" } })
      }
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
        return Response.json({ code: "RATE_LIMITED", error: "Studio has received unusually many AI review requests from this account. Wait and try again later." }, { status: 429, headers: { "Cache-Control": "no-store" } })
      }

      try {
        const object = await runIdempotent(`arena-feedback:${user.id}:${requestKey}`, () => openAIJson<{
        title: string
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
            content: `You are Parch, a precise, friendly, sophisticated coach for spoken true stories. Score hook, development, and landing from 0 to 100. Reward clarity, specificity, forward movement, stakes, emotional honesty, and a satisfying ending, not dramatic subject matter.

Create a short, recognizable title of 2 to 6 words based on the actual story. Do not mechanically copy the first few words of the transcript.

Return exactly three strengths and exactly three improvements. Every point must be demonstrably true from the transcript and specific to what the speaker actually said. Before claiming that a detail, example, feeling, image, context, or explanation is missing, re-read the transcript and verify that it is genuinely absent. Never criticize the storyteller for omitting something they already included. Do not invent evidence. Avoid generic feedback and avoid repeating the same point in different language. The immediate next-step instruction must be the single most useful concrete change the storyteller can make right away, and it must not ask for something already present in the transcript.

Then write a revised version of the ENTIRE story from beginning to end. It must remain a full story, not a summary, excerpt, outline, or partial rewrite. Preserve every real event, sequence, important detail, speaker meaning, and recognizable voice. You may tighten filler and repetition, improve the opening, clarify transitions, and strengthen the landing, but do not drop whole events or meaningful beats. Do not invent details, dialogue, feelings, or lessons. Do not make the speaker sound formal or unlike themselves.`,
          },
          {
            role: "user",
            content: `Practice mode: ${String(body.context || "Open story")}\nInstruction or prompt: ${String(body.prompt || "Tell a story of your choice")}\nTarget length: ${Number(body.targetSeconds || body.seconds || 0)} seconds\nActual length: ${Number(body.seconds || 0)} seconds\n\nClean transcript:\n${transcript}`,
          },
        ],
        }), 2 * 60 * 1000)
        const transcriptWords = meaningfulWordCount(transcript)
        const revisedWords = meaningfulWordCount(object.revisedStory || "")
        const minimumFullRevisionWords = Math.max(45, Math.floor(transcriptWords * 0.72))

        if (revisedWords < minimumFullRevisionWords) {
          try {
            const repaired = await openAIJson<{ revisedStory: string }>({
              name: "arena_full_revision_repair",
              schema: arenaRevisionSchema,
              temperature: 0.2,
              timeoutMs: 12_000,
              messages: [
                {
                  role: "system",
                  content: "Rewrite the complete spoken story from beginning to end. Preserve every real event, sequence, important detail, meaning, and recognizable voice. Tighten filler and repetition, but do not summarize, truncate, omit whole beats, or invent anything. Return only the full revisedStory field required by the schema.",
                },
                {
                  role: "user",
                  content: `Original transcript:
${transcript}

The prior revision was too incomplete:
${object.revisedStory}`,
                },
              ],
            })
            object.revisedStory = meaningfulWordCount(repaired.revisedStory) >= minimumFullRevisionWords
              ? repaired.revisedStory
              : transcript
          } catch {
            object.revisedStory = transcript
          }
        }

        object.title = cleanArenaTitle(object.title, transcript)
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
        { role: "system", content: "You are Parch, a warm, specific storytelling coach. Focus on structure, vivid detail, emotional truth, and a clean landing. Avoid generic praise and never invent details." },
        { role: "user", content: `Title: ${String(body.title || "Untitled")}\n\nStory:\n${story}` },
      ],
    }), 90_000)
    return Response.json(object, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("feedback_route_failed", error, { userId: user.id })
    const message = error instanceof Error && error.message.includes("OPENAI_API_KEY")
      ? "Parch's AI connection is not configured yet. Add OPENAI_API_KEY in Vercel, then redeploy."
      : "Parch could not review this right now. Your work is still saved on this device."
    return Response.json({ error: message }, { status: 500 })
  }
}


function cleanArenaTitle(value: string, transcript: string) {
  const cleaned = value.replace(/[\n\r]+/g, " ").replace(/[^a-zA-Z0-9'’&: -]/g, "").trim().replace(/\s+/g, " ")
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 6)
  if (words.length >= 2) return words.join(" ")
  const fallback = transcript.split(/[.!?]/)[0]?.trim() || "Untitled story"
  const fallbackWords = fallback.replace(/[^a-zA-Z0-9'’& -]/g, " ").split(/\s+/).filter(Boolean).slice(0, 5)
  return fallbackWords.join(" ") || "Untitled story"
}

function meaningfulWordCount(text: string) {
  const fillerWords = new Set(["um", "uh", "erm", "hmm", "mhm", "ah", "eh"])
  const words = text.toLowerCase().match(/[a-z0-9]+(?:['’][a-z0-9]+)*/g) ?? []
  return words.filter((word) => !fillerWords.has(word)).length
}
