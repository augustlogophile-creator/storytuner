import { z } from "zod"
import { backendError } from "@/lib/backend-log"
import { getActiveAuthenticatedUser } from "@/lib/require-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"
import { sanitizePlainText } from "@/lib/security/plain-text"

export const dynamic = "force-dynamic"

const reportSchema = z.object({
  surface: z.enum(["coach", "practice", "check", "studio", "planner", "other"]),
  responseText: z.string().trim().min(1).max(20_000),
  reason: z.string().trim().min(3).max(1_000),
  responseId: z.string().trim().max(160).optional().nullable(),
  lessonId: z.string().trim().max(160).optional().nullable(),
  recordingId: z.string().trim().max(160).optional().nullable(),
  conversationId: z.string().trim().max(160).optional().nullable(),
}).strict()

export async function POST(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite

  const active = await getActiveAuthenticatedUser()
  if (!active.ok) return active.response
  const auth = active.user

  const blocked = rateLimitResponse(rateLimitUser(auth.id, "ai_response_report", [
    { limit: 12, windowMs: 60 * 60 * 1000, label: "12/hour" },
  ]), "Too many AI reports were submitted recently. Try again later.")
  if (blocked) return blocked

  const json = await readJsonBody(request, 24_000)
  if (!json.ok) return json.response
  const parsed = reportSchema.safeParse(json.value)
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_REPORT", error: "That AI response could not be reported." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const body = parsed.data
  const row = {
    reporter_id: auth.id,
    surface: body.surface,
    response_text: sanitizePlainText(body.responseText, { maxLength: 20_000 }),
    reason: sanitizePlainText(body.reason, { maxLength: 1_000 }),
    response_id: cleanOptionalId(body.responseId),
    lesson_id: cleanOptionalId(body.lessonId),
    recording_id: cleanOptionalId(body.recordingId),
    conversation_id: cleanOptionalId(body.conversationId),
    status: "open",
  }

  try {
    // Reports are deliberately service-role written. Normal authenticated users
    // have no direct table INSERT grant, so they cannot bypass validation/rate
    // limits by talking to Supabase's Data API themselves.
    const admin = createAdminClient()
    const { error } = await admin.from("ai_response_reports").insert(row)
    if (error) {
      backendError("ai_response_report_insert_failed", error, {
        userId: auth.id,
        surface: body.surface,
        supabaseCode: typeof error.code === "string" ? error.code : null,
      })
      const tableMissing = error.code === "42P01" || error.code === "PGRST205"
      return Response.json(
        {
          code: tableMissing ? "AI_REPORTS_TABLE_MISSING" : "AI_REPORT_SAVE_FAILED",
          error: tableMissing ? "AI reporting is not fully configured yet." : "The AI response could not be reported right now.",
        },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      )
    }
    return Response.json({ reported: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("ai_response_report_unavailable", error, { userId: auth.id, surface: body.surface })
    return Response.json(
      { code: "AI_REPORT_UNAVAILABLE", error: "The AI response could not be reported right now." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

function cleanOptionalId(value: string | null | undefined) {
  const clean = value?.trim() ?? ""
  return clean || null
}
