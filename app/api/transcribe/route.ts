import { openAIJson, transcribeWithOpenAI } from "@/lib/openai-server"

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
  try {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return Response.json({ error: "No recording was provided." }, { status: 400 })
    if (file.size > 4 * 1024 * 1024) return Response.json({ error: "This recording is too large to transcribe." }, { status: 413 })

    const raw = await transcribeWithOpenAI(file)
    const rawWordCount = meaningfulWordCount(raw)
    if (rawWordCount < 3) {
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
      return Response.json({ text, title: cleaned.title.trim(), wordCount, minimumWords: MIN_STORY_WORDS })
    } catch (cleanupError) {
      console.error("StoryTuner transcript cleanup error", cleanupError)
      return Response.json({ text: raw, title: titleFrom(raw), wordCount: rawWordCount, minimumWords: MIN_STORY_WORDS })
    }
  } catch (error) {
    console.error("StoryTuner transcription error", error)
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
