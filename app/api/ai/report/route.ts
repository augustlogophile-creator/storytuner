import { backendError } from "@/lib/backend-log"
import { getAuthenticatedUser } from "@/lib/require-auth"
import { readJsonBody, rejectLargeRequest, requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"

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

  // Reporting should only depend on the user's normal Supabase session. The
  // ai_response_reports RLS policy created during setup already permits an
  // authenticated user to insert a row whose reporter_id is auth.uid().
  // Using that session here also means reporting does not fail just because a
  // service-role environment variable or an unrelated moderation lookup is
  // unavailable.
  const auth = await getAuthenticatedUser()
  if (!auth) {
    return Response.json(
      { code: "AUTH_REQUIRED", error: "Please sign in again before reporting this reply." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  const oversized = rejectLargeRequest(request, 24_000)
  if (oversized) return oversized

  const blocked = rateLimitResponse(rateLimitUser(auth.id, "ai_response_report", [
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
      { code: "INVALID_REPORT", error: "That AI response could not be reported." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const row = {
    reporter_id: auth.id,
    surface,
    response_text: responseText,
    reason,
    response_id: cleanOptionalId(body.responseId),
    lesson_id: cleanOptionalId(body.lessonId),
    recording_id: cleanOptionalId(body.recordingId),
    conversation_id: cleanOptionalId(body.conversationId),
    status: "open",
  }

  try {
    const { error } = await auth.supabase.from("ai_response_reports").insert(row)

    if (error) {
      backendError("ai_response_report_session_insert_failed", error, {
        userId: auth.id,
        surface,
        supabaseCode: typeof error.code === "string" ? error.code : null,
      })

      // Most installations can insert through the authenticated RLS policy.
      // If table privileges were customized, fall back to the already-existing
      // server-only service-role client when it is configured. This keeps the
      // report button reliable without making service-role access a requirement.
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const { createAdminClient } = await import("@/lib/supabase/admin")
          const admin = createAdminClient()
          const { error: adminError } = await admin.from("ai_response_reports").insert(row)
          if (!adminError) {
            return Response.json({ reported: true }, { headers: { "Cache-Control": "no-store" } })
          }
          backendError("ai_response_report_admin_fallback_failed", adminError, {
            userId: auth.id,
            surface,
            supabaseCode: typeof adminError.code === "string" ? adminError.code : null,
          })
        } catch (fallbackError) {
          backendError("ai_response_report_admin_fallback_unavailable", fallbackError, { userId: auth.id, surface })
        }
      }

      const tableMissing = error.code === "42P01" || error.code === "PGRST205"
      const permissionDenied = error.code === "42501"
      return Response.json(
        {
          code: tableMissing ? "AI_REPORTS_TABLE_MISSING" : permissionDenied ? "AI_REPORTS_PERMISSION_DENIED" : "AI_REPORT_SAVE_FAILED",
          error: tableMissing
            ? "AI reporting is not fully configured yet."
            : permissionDenied
              ? "StoryTuner could not save this report with your current database permissions."
              : "The AI response could not be reported right now.",
        },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      )
    }

    return Response.json({ reported: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("ai_response_report_unavailable", error, { userId: auth.id, surface })
    return Response.json(
      { code: "AI_REPORT_UNAVAILABLE", error: "The AI response could not be reported right now." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
