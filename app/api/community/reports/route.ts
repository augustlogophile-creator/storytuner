import { z } from "zod"
import { getCommunityApiContext, noStoreJson } from "@/lib/community/server"
import type { CommunityReportReason } from "@/lib/community/types"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser, rejectLargeRequest } from "@/lib/request-protection"
import { backendError } from "@/lib/backend-log"
import { sanitizePlainText } from "@/lib/security/plain-text"

export const dynamic = "force-dynamic"

const reasons = new Set<CommunityReportReason>([
  "harassment",
  "hate",
  "sexual_content",
  "violence",
  "self_harm",
  "personal_information",
  "spam",
  "other",
])

const reportSchema = z.object({
  postId: z.string().uuid().nullable().optional(),
  replyId: z.string().uuid().nullable().optional(),
  reason: z.enum(["harassment", "hate", "sexual_content", "violence", "self_harm", "personal_information", "spam", "other"]),
  details: z.string().trim().max(1000).optional().default(""),
}).strict().refine((value) => Boolean(value.postId) !== Boolean(value.replyId), { message: "Choose one post or reply to report." })

export async function POST(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response
  const oversized = rejectLargeRequest(request, 8_000)
  if (oversized) return oversized
  const blocked = rateLimitResponse(rateLimitUser(context.userId, "community_report", [
    { limit: 10, windowMs: 60 * 60 * 1000, label: "10/hour" },
  ]), "Too many reports were submitted recently. Try again later.")
  if (blocked) return blocked

  const json = await readJsonBody(request, 8_000)
  if (!json.ok) return json.response
  const parsed = reportSchema.safeParse(json.value)
  if (!parsed.success) return noStoreJson({ error: parsed.error.issues[0]?.message ?? "That report is invalid." }, { status: 400 })
  const payload = parsed.data

  const postId = payload.postId ?? null
  const replyId = payload.replyId ?? null
  const reason = payload.reason as CommunityReportReason
  const details = sanitizePlainText(payload.details, { maxLength: 1000 })

  const recentSince = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await context.admin
    .from("community_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", context.userId)
    .gte("created_at", recentSince)

  if ((recentCount ?? 0) >= 10) {
    return noStoreJson({ error: "Too many reports were submitted recently. Try again later." }, { status: 429 })
  }

  let authorId: string | null = null
  if (postId) {
    const { data, error } = await context.admin
      .from("community_posts")
      .select("author_id, status")
      .eq("id", postId)
      .maybeSingle<{ author_id: string; status: string }>()
    if (error || !data || data.status !== "active") {
      return noStoreJson({ error: "That post is no longer available." }, { status: 404 })
    }
    authorId = data.author_id
  } else if (replyId) {
    const { data, error } = await context.admin
      .from("community_replies")
      .select("author_id, status")
      .eq("id", replyId)
      .maybeSingle<{ author_id: string; status: string }>()
    if (error || !data || data.status !== "active") {
      return noStoreJson({ error: "That reply is no longer available." }, { status: 404 })
    }
    authorId = data.author_id
  }

  if (authorId === context.userId) {
    return noStoreJson({ error: "You cannot report your own content." }, { status: 400 })
  }

  const { error } = await context.admin.from("community_reports").insert({
    reporter_id: context.userId,
    source: "user",
    post_id: postId,
    reply_id: replyId,
    reason,
    details: details || null,
    status: "open",
  })

  if (error) {
    if (error.code === "23505") return noStoreJson({ reported: true, alreadyReported: true })
    backendError("community_report_create_failed", error, { userId: context.userId })
    return noStoreJson({ error: "The report could not be submitted." }, { status: 500 })
  }

  return noStoreJson({ reported: true })
}
