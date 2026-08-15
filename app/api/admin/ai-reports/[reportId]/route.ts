import { z } from "zod"
import { backendError } from "@/lib/backend-log"
import { getModeratorContext } from "@/lib/community/moderation"
import { readJsonBody, requireSameOrigin } from "@/lib/request-protection"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const paramsSchema = z.object({ reportId: z.string().uuid() })
const bodySchema = z.object({
  status: z.enum(["open", "reviewed", "dismissed", "actioned"]),
  adminNote: z.string().trim().max(2000).default(""),
})

type RouteContext = { params: Promise<{ reportId: string }> }

export async function PATCH(request: Request, routeContext: RouteContext) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite

  const context = await getModeratorContext()
  if (!context.ok) return context.response

  const params = paramsSchema.safeParse(await routeContext.params)
  const json = await readJsonBody(request, 8_000)
  if (!json.ok) return json.response
  const body = bodySchema.safeParse(json.value)

  if (!params.success || !body.success) {
    return Response.json({ error: "That AI report update is invalid." }, { status: 400 })
  }

  const now = new Date().toISOString()
  const reviewedAt = body.data.status === "open" ? null : now
  const { data, error } = await context.admin
    .from("ai_response_reports")
    .update({
      status: body.data.status,
      admin_note: body.data.adminNote || null,
      reviewed_at: reviewedAt,
    })
    .eq("id", params.data.reportId)
    .select("id")
    .maybeSingle<{ id: string }>()

  if (error) {
    backendError("ai_response_report_admin_update_failed", error, { adminId: context.userId, reportId: params.data.reportId })
    return Response.json({ error: "The AI report could not be updated." }, { status: 500 })
  }
  if (!data) return Response.json({ error: "That AI report could not be found." }, { status: 404 })

  return Response.json({ updated: true, status: body.data.status }, { headers: { "Cache-Control": "no-store" } })
}
