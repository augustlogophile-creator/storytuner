import { openAIJson } from "@/lib/openai-server"

export const runtime = "nodejs"

export const maxDuration = 30

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
    praise: { type: "string" },
    weakness: { type: "string" },
    levelUp: { type: "string" },
  },
  required: ["hook", "development", "landing", "strongest", "weakest", "praise", "weakness", "levelUp"],
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
      if (transcript.length < 20) return Response.json({ error: "The transcript is too short for useful feedback." }, { status: 400 })
      const object = await openAIJson<{
        hook: number
        development: number
        landing: number
        strongest: "hook" | "development" | "landing"
        weakest: "hook" | "development" | "landing"
        praise: string
        weakness: string
        levelUp: string
      }>({
        name: "arena_feedback",
        schema: arenaSchema,
        messages: [
          {
            role: "system",
            content: "You are Weaver, a sophisticated but friendly coach for spoken true stories. Score hook, development, and landing from 0 to 100. Reward clarity, specificity, movement, emotional honesty, and a satisfying ending, not dramatic subject matter. Identify the strongest and weakest category. Praise one exact thing. Explain the main weakness without being harsh. Give one immediately usable revision under 22 words. Never invent details. Keep each feedback field concise.",
          },
          {
            role: "user",
            content: `Mode: ${String(body.context || "Open story")}\nPrompt: ${String(body.prompt || "Tell any story you choose")}\nDuration: ${Number(body.seconds || 0)} seconds\n\nTranscript:\n${transcript}`,
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
    console.error("StoryTuner OpenAI feedback error", error)
    const message = error instanceof Error && error.message.includes("OPENAI_API_KEY")
      ? "OpenAI is not configured yet. Add OPENAI_API_KEY in Vercel, then redeploy."
      : "Weaver could not reach OpenAI right now. Your work is still saved on this device."
    return Response.json({ error: message }, { status: 500 })
  }
}
