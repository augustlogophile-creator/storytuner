import { getCommunityApiContext, noStoreJson } from "@/lib/community/server"
import type { CommunityReportReason } from "@/lib/community/types"

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

type ReportRequest = {
  postId?: string | null
  replyId?: string | null
  reason?: CommunityReportReason
  details?: string
}

export async function POST(request: Request) {
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response

  let payload: ReportRequest
  try {
    payload = await request.json() as ReportRequest
  } catch {
    return noStoreJson({ error: "The report could not be read." }, { status: 400 })
  }

  const postId = typeof payload.postId === "string" ? payload.postId : null
  const replyId = typeof payload.replyId === "string" ? payload.replyId : null
  const reason = payload.reason
  const details = typeof payload.details === "string" ? payload.details.trim().slice(0, 1000) : ""

  if ((!postId && !replyId) || (postId && replyId)) {
    return noStoreJson({ error: "Choose one post or reply to report." }, { status: 400 })
  }
  if (!reason || !reasons.has(reason)) {
    return noStoreJson({ error: "Choose a reason for the report." }, { status: 400 })
  }

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
    post_id: postId,
    reply_id: replyId,
    reason,
    details: details || null,
    status: "open",
  })

  if (error) {
    if (error.code === "23505") return noStoreJson({ reported: true, alreadyReported: true })
    console.error("Community report creation failed", error)
    return noStoreJson({ error: "The report could not be submitted." }, { status: 500 })
  }

  return noStoreJson({ reported: true })
}
