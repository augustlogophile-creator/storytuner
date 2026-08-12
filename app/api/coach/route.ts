import { getActiveAuthenticatedUser } from "@/lib/require-auth"
import { openAIText } from "@/lib/openai-server"
import { getMembershipByUserId } from "@/lib/membership-server"
import { enforceDurableUsageRate, isUuid, recordUsageEvent, releaseUsage, reserveUsage, type UsageReservation } from "@/lib/usage-server"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser, rejectLargeRequest, runIdempotent } from "@/lib/request-protection"
import { backendError } from "@/lib/backend-log"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 30

type IncomingMessage = { role: "user" | "assistant"; content: string }

export async function POST(req: Request) {
  const crossSite = requireSameOrigin(req)
  if (crossSite) return crossSite
  const auth = await getActiveAuthenticatedUser()
  if (!auth.ok) return auth.response
  const user = auth.user
  const oversized = rejectLargeRequest(req, 80_000)
  if (oversized) return oversized
  const rate = rateLimitUser(user.id, "coach", [
    { limit: 12, windowMs: 60_000, label: "12/min" },
    { limit: 120, windowMs: 60 * 60 * 1000, label: "120/hour" },
  ])
  const blocked = rateLimitResponse(rate, "Weaver is receiving too many messages from this account. Wait a moment and try again.")
  if (blocked) return blocked

  try {
    const json = await readJsonBody(req, 80_000)
    if (!json.ok) return json.response
    const body = json.value as {
      messages?: IncomingMessage[]
      storyContext?: string
      scoreContext?: string
      personalizationContext?: string
      requestKey?: unknown
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
      ? body.messages.filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
          .slice(-12)
          .map((item) => ({ ...item, content: item.content.slice(0, 5000) }))
      : []
    const latest = messages.at(-1)?.content?.trim() || ""
    if (!latest) return Response.json({ error: "Ask Weaver a question first." }, { status: 400 })
    if (latest.length > 5000) return Response.json({ error: "Keep each Weaver message under 5,000 characters." }, { status: 400 })

    const requestKey = body.requestKey ?? null
    if (!isUuid(requestKey)) return Response.json({ error: "This coaching request is missing a valid request key. Refresh and try again." }, { status: 400 })

    // Durable replay protection. A serverless retry with the same request key
    // returns the already-saved answer before reserving usage or calling OpenAI.
    const admin = createAdminClient()
    const { data: priorExchange, error: priorExchangeError } = await admin
      .from("coach_exchanges")
      .select("assistant_message")
      .eq("user_id", user.id)
      .eq("request_key", requestKey)
      .maybeSingle<{ assistant_message: string }>()
    if (priorExchangeError) backendError("coach_replay_lookup_failed", priorExchangeError, { userId: user.id, requestKey })
    if (priorExchange?.assistant_message) {
      return Response.json(
        { reply: priorExchange.assistant_message, usage: null, historySaved: true, replayed: true },
        { headers: { "Cache-Control": "no-store" } },
      )
    }

    let membership
    try {
      membership = await getMembershipByUserId(user.id)
    } catch (error) {
      backendError("coach_membership_lookup_failed", error, { userId: user.id })
      return Response.json({ code: "MEMBERSHIP_STATUS_UNAVAILABLE", error: "Weaver could not verify your membership right now. Try again in a moment." }, { status: 503, headers: { "Cache-Control": "no-store" } })
    }
    let reservation: UsageReservation | null = null
    if (!membership.active) {
      reservation = await reserveUsage(user.id, "coach_message", requestKey)
      if (!reservation.allowed) {
        return Response.json({
          code: "COACH_LIMIT_REACHED",
          error: "You have used all five free Weaver messages. Membership unlocks unlimited coaching.",
          usage: reservation,
        }, { status: 403, headers: { "Cache-Control": "no-store" } })
      }
    } else {
      await recordUsageEvent(user.id, "coach_message", requestKey)
    }

    const durableRate = await enforceDurableUsageRate(user.id, "coach_message", [
      { limit: 120, windowMs: 60 * 60 * 1000, label: "120/hour" },
      { limit: 500, windowMs: 24 * 60 * 60 * 1000, label: "500/day" },
    ])
    if (!durableRate.allowed) {
      if (reservation && !reservation.alreadyReserved) await releaseUsage(user.id, "coach_message", requestKey).catch(() => undefined)
      return Response.json({ code: "RATE_LIMITED", error: "Weaver has received unusually many requests from this account. Wait and try again later." }, { status: 429, headers: { "Cache-Control": "no-store" } })
    }

    try {
      const reply = await runIdempotent(`coach:${user.id}:${requestKey}`, () => openAIText([
        {
          role: "system",
          content: `You are Weaver, StoryTuner's friendly, sophisticated storytelling coach. Answer the user's exact question directly and conversationally. Default to concise answers: usually 120-220 words, and 60-140 words for simple questions. Only go longer when the user explicitly asks for a detailed breakdown, full rewrite, or comprehensive critique. Avoid filler and repetitive conclusions.

STORYTUNER PRODUCT KNOWLEDGE:
StoryTuner is a storytelling practice app, especially for spoken and personal storytelling. It helps people learn storytelling craft, plan stories before telling them, record spoken stories in Arena, receive AI transcript-based coaching and Hook/Development/Landing feedback, revisit recordings, ask Weaver follow-up questions, and intentionally share selected stories with the Community for responses. The Learn curriculum teaches concrete story skills. Story Planner helps organize a story before recording. Arena is where users practice and record. Ask Weaver is the personalized story coach. Community is optional sharing, never automatic. Progress, XP, Weaver customization, and Membership support the learning experience. When asked what StoryTuner is or how a feature works, answer from this product context instead of describing it as a generic writing app. Never invent features not stated here.

COACHING RULES:
- Focus on storytelling and telling, not generic fiction-writing advice unless the user is actually writing fiction.
- Use the attached story when one is selected. Quote or reference exact moments when useful.
- If the user asks why a score was low, explain it using exact moments and acknowledge what still worked.
- If the user asks for strengths, give the requested number.
- If the user asks for a rewrite, preserve meaning, events, personality, and voice. Never invent details, dialogue, motivations, or emotions.
- Use short bold headings or bullets only when they improve clarity.
- If you use a numbered list, number it sequentially 1, 2, 3, 4. Never restart every item at 1.
- Prefer specific advice over broad textbook lists. Give the strongest few ideas instead of every possible tip.
- Treat scores as coaching estimates, not mathematical facts. Never claim to remember material that is not supplied below.

STORY CONTEXT:
${attachedStory || "No story is attached to this conversation."}

PRIOR SCORE CONTEXT:
${attachedScore || "No prior score is attached."}

PRIVATE LONG-TERM COACHING CONTEXT:
${personalizedHistory || "Personalization from past recordings is disabled or no history was supplied."}`,
        },
        ...messages.map((item) => ({ role: item.role, content: item.content })),
      ], "coach"), 2 * 60 * 1000)
      const { error: historyError } = await admin.from("coach_exchanges").upsert({
        user_id: user.id,
        request_key: requestKey,
        user_message: latest,
        assistant_message: reply,
      }, { onConflict: "user_id,request_key" })

      if (historyError) {
        // The user already received a valid AI response, so a secondary archive failure
        // must never turn the successful coaching request into an error. The client
        // immediately stores the exchange in user_app_state, and /api/coach/history
        // also reads that state as a fallback.
        backendError("coach_history_save_failed", historyError, { userId: user.id, requestKey })
        return Response.json({ reply, usage: reservation, historySaved: false }, { headers: { "Cache-Control": "no-store" } })
      }

      return Response.json({ reply, usage: reservation, historySaved: true }, { headers: { "Cache-Control": "no-store" } })
    } catch (error) {
      if (reservation && !reservation.alreadyReserved) {
        await releaseUsage(user.id, "coach_message", requestKey).catch((releaseError) =>
          backendError("coach_usage_rollback_failed", releaseError, { userId: user.id, requestKey }),
        )
      }
      throw error
    }
  } catch (error) {
    backendError("coach_route_failed", error, { userId: user.id })
    const message = error instanceof Error && error.message.includes("OPENAI_API_KEY")
      ? "Weaver's AI connection is not configured yet. Add OPENAI_API_KEY in Vercel, then redeploy."
      : "Weaver could not respond right now."
    return Response.json({ error: message }, { status: 500 })
  }
}
