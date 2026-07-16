import { getAuthenticatedUser } from "@/lib/require-auth"
import { openAIJson } from "@/lib/openai-server"

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
  const user = await getAuthenticatedUser()
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 })
  try {
    const body = (await req.json()) as Record<string, unknown>
    const mode = typeof body.mode === "string" ? body.mode : "story"

    if (mode === "lesson") {
      const answer = typeof body.answer === "string" ? body.answer.trim() : ""
      if (answer.length < 20) return Response.json({ error: "Write a little more so Weaver can respond usefully." }, { status: 400 })
      const object = await openAIJson<{ pass: boolean; working: string; fix: string }>({
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
      })
      return Response.json(object)
    }

    if (mode === "arena") {
      const transcript = typeof body.transcript === "string" ? body.transcript.trim() : ""
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
      const object = await openAIJson<{
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

Return exactly three strengths and exactly three improvements. Each bullet must point to something specific in the transcript, use plain language, and avoid repeating another bullet. The level-up instruction must be one concrete change the storyteller can make immediately.

Then write a revised version of the full story. Preserve every real event, the speaker's personality, meaning, and recognizable voice. Remove filler, tighten repetition, improve the opening, clarify the central turn, and strengthen the landing. Do not invent details, dialogue, feelings, or lessons. Do not make the speaker sound formal or unlike themselves.`,
          },
          {
            role: "user",
            content: `Practice mode: ${String(body.context || "Open story")}\nInstruction or prompt: ${String(body.prompt || "Tell a story of your choice")}\nTarget length: ${Number(body.targetSeconds || body.seconds || 0)} seconds\nActual length: ${Number(body.seconds || 0)} seconds\n\nClean transcript:\n${transcript}`,
          },
        ],
      })
      return Response.json(object)
    }

    const story = typeof body.story === "string" ? body.story.trim() : ""
    if (story.length < 20) return Response.json({ error: "Please share a little more of the story." }, { status: 400 })
    const object = await openAIJson({
      name: "written_story_feedback",
      schema: writtenStorySchema,
      messages: [
        { role: "system", content: "You are Weaver, a warm, specific storytelling coach. Focus on structure, vivid detail, emotional truth, and a clean landing. Avoid generic praise and never invent details." },
        { role: "user", content: `Title: ${String(body.title || "Untitled")}\n\nStory:\n${story}` },
      ],
    })
    return Response.json(object)
  } catch (error) {
    console.error("StoryTuner feedback error", error)
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
