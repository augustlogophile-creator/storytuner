import { backendError } from "@/lib/backend-log"
import { getActiveAuthenticatedUser } from "@/lib/require-auth"
import { readJsonBody, rejectLargeRequest, requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const surfaces = new Set(["coach", "practice", "check", "studio", "planner", "other"])

function cleanOptionalId(value: unknown) {
  if (typeof value !== "string") return null
  const clean = value.trim()
  return clean ? clean.slice(0, 160) : null
}

export async function POST(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite

  const auth = await getActiveAuthenticatedUser()
  if (!auth.ok) return auth.response

  const oversized = rejectLargeRequest(request, 24_000)
  if (oversized) return oversized

  const blocked = rateLimitResponse(rateLimitUser(auth.user.id, "ai_response_report", [
    { limit: 12, windowMs: 60 * 60 * 1000, label: "12/hour" },
  ]), "Too many AI reports were submitted recently. Try again later.")
  if (blocked) return blocked

  const json = await readJsonBody(request, 24_000)
  if (!json.ok) return json.response
  const body = json.value as Record<string, unknown>

  const surface = typeof body.surface === "string" ? body.surface.trim().toLowerCase() : ""
  const responseText = typeof body.responseText === "string" ? body.responseText.trim().slice(0, 20_000) : ""
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : ""

  if (!surfaces.has(surface) || !responseText || reason.length < 3) {
    return Response.json(
      { error: "That AI response could not be reported." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  try {
    // The service-role client stays server-side. The authenticated user id is
    // resolved by StoryTuner and never accepted from the browser.
    const admin = createAdminClient()
    const { error } = await admin.from("ai_response_reports").insert({
      reporter_id: auth.user.id,
      surface,
      response_text: responseText,
      reason,
      response_id: cleanOptionalId(body.responseId),
      lesson_id: cleanOptionalId(body.lessonId),
      recording_id: cleanOptionalId(body.recordingId),
      conversation_id: cleanOptionalId(body.conversationId),
      status: "open",
    })

    if (error) {
      backendError("ai_response_report_create_failed", error, { userId: auth.user.id, surface })
      return Response.json(
        { error: "The AI response could not be reported right now." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      )
    }

    return Response.json({ reported: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("ai_response_report_unavailable", error, { userId: auth.user.id, surface })
    return Response.json(
      { error: "The AI response could not be reported right now." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
