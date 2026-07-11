import { generateObject } from "ai"
import { z } from "zod"

export const maxDuration = 30

const lessonSchema = z.object({
  pass: z.boolean().describe("Whether the response meaningfully attempts the exercise."),
  working: z.string().describe("One specific strength in the response, in one or two concise sentences."),
  fix: z.string().describe("One concrete revision tied directly to the unit's technique."),
})

const arenaSchema = z.object({
  hook: z.number().min(0).max(100),
  development: z.number().min(0).max(100),
  landing: z.number().min(0).max(100),
  strongest: z.enum(["hook", "development", "landing"]),
  praise: z.string().describe("A specific observation about what worked in the submitted story."),
  fix: z.string().describe("One concrete, prioritized revision for the next take."),
  nextTake: z.string().describe("A brief instruction for the storyteller's next recording."),
})

const writtenStorySchema = z.object({
  score: z.number().min(0).max(100),
  headline: z.string(),
  scores: z.object({ structure: z.number().min(0).max(100), detail: z.number().min(0).max(100), emotion: z.number().min(0).max(100) }),
  strengths: z.array(z.string()).min(2).max(3),
  improvements: z.array(z.object({ title: z.string(), tip: z.string() })).min(2).max(3),
  nextStep: z.string(),
})

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const mode = typeof body.mode === "string" ? body.mode : "story"

    if (mode === "lesson") {
      const answer = typeof body.answer === "string" ? body.answer.trim() : ""
      if (answer.length < 20) return Response.json({ error: "Write a little more so the coach can respond usefully." }, { status: 400 })
      const { object } = await generateObject({
        model: "openai/gpt-4o-mini",
        schema: lessonSchema,
        system: "You are StoryTuner, a precise, warm storytelling teacher. Be encouraging without empty praise. Evaluate only the technique named for this exercise. Refer to the student's actual wording, then give one useful revision. Keep the total response under 110 words.",
        prompt: `Unit: ${String(body.unitTitle || "Storytelling")}
Technique: ${String(body.technique || "story craft")}
Exercise: ${String(body.prompt || "")}
Student response:
${answer}`,
      })
      return Response.json(object)
    }

    if (mode === "arena") {
      const transcript = typeof body.transcript === "string" ? body.transcript.trim() : ""
      if (transcript.length < 20) return Response.json({ error: "The transcript is too short for useful feedback." }, { status: 400 })
      const { object } = await generateObject({
        model: "openai/gpt-4o-mini",
        schema: arenaSchema,
        system: `You are StoryTuner, a sophisticated but friendly coach for spoken true stories. Score three areas: hook, development, and landing. Reward clarity and emotional honesty more than dramatic subject matter. Give one specific strength and one prioritized fix. Never invent details that are not in the transcript.${body.premium ? " For this Plus review, pay additional attention to pacing and word economy when choosing the single most useful fix." : ""}`,
        prompt: `Context: ${String(body.context || "Personal story")}
Prompt: ${String(body.prompt || "Tell a true story")}
Duration: ${Number(body.seconds || 0)} seconds
Transcript:
${transcript}`,
      })
      return Response.json(object)
    }

    const story = typeof body.story === "string" ? body.story.trim() : ""
    if (story.length < 20) return Response.json({ error: "Please share a little more of the story." }, { status: 400 })
    const { object } = await generateObject({
      model: "openai/gpt-4o-mini",
      schema: writtenStorySchema,
      system: "You are StoryTuner, a warm, specific storytelling coach. Focus on structure, vivid detail, emotional truth, and a clean landing. Avoid generic praise.",
      prompt: `Title: ${String(body.title || "Untitled")}

Story:
${story}`,
    })
    return Response.json(object)
  } catch (error) {
    console.error("StoryTuner feedback error", error)
    return Response.json({ error: "The coach is unavailable right now. Your work is still saved on this device." }, { status: 500 })
  }
}
