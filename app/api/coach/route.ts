import { openAIText } from "@/lib/openai-server"

export const runtime = "nodejs"

export const maxDuration = 30

type IncomingMessage = { role: "user" | "assistant"; content: string }

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      messages?: IncomingMessage[]
      storyContext?: string
      scoreContext?: string
    }
    const messages = Array.isArray(body.messages)
      ? body.messages.filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string").slice(-12)
      : []
    const latest = messages.at(-1)?.content?.trim() || ""
    if (!latest) return Response.json({ error: "Ask Weaver a question first." }, { status: 400 })

    const reply = await openAIText([
      {
        role: "system",
        content: `You are Weaver, StoryTuner's friendly, sophisticated AI storytelling coach. Help the user improve true stories, spoken answers, interviews, phrasing, structure, hooks, pacing, stakes, scenes, and endings. You may justify prior scores when score context is supplied, but do not pretend a score is mathematically exact. Ground every answer in the provided story. When rewriting, preserve the user's meaning and voice. Be concise, candid, and practical. Usually give one explanation and one immediately usable revision. Never claim to remember material not included below.\n\nSTORY CONTEXT:\n${body.storyContext || "No story selected."}\n\nPRIOR SCORE CONTEXT:\n${body.scoreContext || "No prior scoring supplied."}`,
      },
      ...messages.map((item) => ({ role: item.role, content: item.content })),
    ])
    return Response.json({ reply })
  } catch (error) {
    console.error("StoryTuner OpenAI coach error", error)
    const message = error instanceof Error && error.message.includes("OPENAI_API_KEY")
      ? "OpenAI is not configured yet. Add OPENAI_API_KEY in Vercel, then redeploy."
      : "Weaver could not reach OpenAI right now."
    return Response.json({ error: message }, { status: 500 })
  }
}
