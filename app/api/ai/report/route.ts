import { createHash } from "node:crypto"
import { backendError } from "@/lib/backend-log"
import { getActiveAuthenticatedUser } from "@/lib/require-auth"
import { readJsonBody, rejectLargeRequest, requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const sources = new Set(["coach", "arena", "lesson", "checkpoint", "planner"])

export async function POST(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite

  const auth = await getActiveAuthenticatedUser()
  if (!auth.ok) return auth.response

  const oversized = rejectLargeRequest(request, 20_000)
  if (oversized) return oversized

  const blocked = rateLimitResponse(rateLimitUser(auth.user.id, "ai_output_report", [
    { limit: 12, windowMs: 60 * 60 * 1000, label: "12/hour" },
  ]), "Too many AI reports were submitted recently. Try again later.")
  if (blocked) return blocked

  const json = await readJsonBody(request, 20_000)
  if (!json.ok) return json.response
  const body = json.value as Record<string, unknown>

  const source = typeof body.source === "string" ? body.source.trim().toLowerCase() : ""
  const content = typeof body.content === "string" ? body.content.trim().slice(0, 12_000) : ""
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : ""
  if (!sources.has(source) || !content || reason.length < 3) {
    return Response.json({ error: "That AI response could not be reported." }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  const contentHash = createHash("sha256").update(`${source}\n${content}\n${reason}`).digest("hex")
  const storedContent = `AI response:\n${content}\n\nUser report reason:\n${reason}`
  try {
    const admin = createAdminClient()
    const { error } = await admin.from("ai_output_reports").insert({
      reporter_id: auth.user.id,
      source,
      content: storedContent,
      content_hash: contentHash,
      status: "open",
    })

    if (error) {
      if (error.code === "23505") return Response.json({ reported: true, alreadyReported: true }, { headers: { "Cache-Control": "no-store" } })
      backendError("ai_output_report_create_failed", error, { userId: auth.user.id, source })
      return Response.json({ error: "The AI response could not be reported right now." }, { status: 500, headers: { "Cache-Control": "no-store" } })
    }

    return Response.json({ reported: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("ai_output_report_unavailable", error, { userId: auth.user.id, source })
    return Response.json({ error: "The AI response could not be reported right now." }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
