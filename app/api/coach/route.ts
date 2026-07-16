import { getAuthenticatedUser } from "@/lib/require-auth"
import { openAIText } from "@/lib/openai-server"

export const runtime = "nodejs"
export const maxDuration = 30

type IncomingMessage = { role: "user" | "assistant"; content: string }

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 })
  try {
    const body = (await req.json()) as {
      messages?: IncomingMessage[]
      storyContext?: string
      scoreContext?: string
      personalizationContext?: string
    }
    const { data: profile } = await user.supabase
      .from("profiles")
      .select("ai_personalization_enabled")
      .eq("id", user.id)
      .maybeSingle<{ ai_personalization_enabled: boolean }>()
    const personalizedHistory = profile?.ai_personalization_enabled ? body.personalizationContext?.trim().slice(0, 8000) : ""
    const attachedStory = typeof body.storyContext === "string" ? body.storyContext.slice(0, 7000) : ""
    const attachedScore = typeof body.scoreContext === "string" ? body.scoreContext.slice(0, 2500) : ""

    const messages = Array.isArray(body.messages)
      ? body.messages.filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string").slice(-12)
      : []
    const latest = messages.at(-1)?.content?.trim() || ""
    if (!latest) return Response.json({ error: "Ask Weaver a question first." }, { status: 400 })

    const reply = await openAIText([
      {
        role: "system",
        content: `You are Weaver, StoryTuner's friendly, sophisticated storytelling coach. Answer the user's exact question directly before adding explanation. Use plain, natural language. Be thorough enough to be genuinely useful, but do not ramble.

When helpful, format your answer with short **bold headings**, bullets, and clear paragraph breaks. Never output raw markdown symbols without using them intentionally. If the user asks why a score was low, explain the score using exact moments from the story and acknowledge what still worked. If the user asks for strengths, give the requested number. If the user asks for a rewrite, preserve their meaning, events, personality, and voice. Do not invent details, dialogue, motivations, or emotions.

You can coach the full craft of storytelling, including finding material, choosing a point, structure, hooks, stakes, scenes, pacing, clarity, emotional honesty, language, delivery, interviews, presentations, arguments, difficult conversations, and endings. When no story is attached, act as a general craft coach rather than forcing the conversation back to a prior recording. Treat scores as useful coaching estimates, not mathematical facts. Never claim to remember material that is not supplied below.

STORY CONTEXT:
${attachedStory || "No story is attached to this conversation."}

PRIOR SCORE CONTEXT:
${attachedScore || "No prior score is attached."}

PRIVATE LONG-TERM COACHING CONTEXT:
${personalizedHistory || "Personalization from past recordings is disabled or no history was supplied."}`,
      },
      ...messages.map((item) => ({ role: item.role, content: item.content })),
    ])
    return Response.json({ reply })
  } catch (error) {
    console.error("StoryTuner coach error", error)
    const message = error instanceof Error && error.message.includes("OPENAI_API_KEY")
      ? "Weaver's AI connection is not configured yet. Add OPENAI_API_KEY in Vercel, then redeploy."
      : "Weaver could not respond right now."
    return Response.json({ error: message }, { status: 500 })
  }
}
