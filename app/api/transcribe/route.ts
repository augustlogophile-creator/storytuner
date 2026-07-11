import { transcribeWithOpenAI } from "@/lib/openai-server"

export const runtime = "nodejs"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return Response.json({ error: "No recording was provided." }, { status: 400 })
    if (file.size > 4 * 1024 * 1024) return Response.json({ error: "This recording is too large to transcribe." }, { status: 413 })
    const text = await transcribeWithOpenAI(file)
    return Response.json({ text })
  } catch (error) {
    console.error("StoryTuner OpenAI transcription error", error)
    const message = error instanceof Error && error.message.includes("OPENAI_API_KEY")
      ? "OpenAI is not configured yet. Add OPENAI_API_KEY in Vercel, then redeploy."
      : "OpenAI could not transcribe this recording right now."
    return Response.json({ error: message }, { status: 500 })
  }
}
