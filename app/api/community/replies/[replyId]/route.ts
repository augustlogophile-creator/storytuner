import { z } from "zod"
import { getCommunityApiContext, noStoreJson } from "@/lib/community/server"
import type { CommunityReply, CommunityContentStatus } from "@/lib/community/types"
import { COMMUNITY_AI_HOLD_MESSAGE, createAiModerationReport, moderateCommunityText } from "@/lib/community/ai-moderation"
import { backendError } from "@/lib/backend-log"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser, rejectLargeRequest } from "@/lib/request-protection"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const paramsSchema = z.object({ replyId: z.string().uuid() }).strict()
const editSchema = z.object({
  body: z.string().trim().min(1, "A reply cannot be empty.").max(2000, "Replies can be at most 2,000 characters."),
}).strict()

type RouteContext = { params: Promise<{ replyId: string }> }
type ReplyRow = {
  id: string
  post_id: string
  parent_reply_id: string | null
  author_id: string
  body: string
  status: CommunityContentStatus
  created_at: string
  edited_at: string | null
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response
  const oversized = rejectLargeRequest(request, 10000)
  if (oversized) return oversized
  const limited = rateLimitResponse(rateLimitUser(context.userId, "community_reply_mutation", [{ limit: 20, windowMs: 10 * 60 * 1000, label: "20/10m" }]), "Too many Community changes. Wait a few minutes and try again.")
  if (limited) return limited

  const parsedParams = paramsSchema.safeParse(await routeContext.params)
  if (!parsedParams.success) return noStoreJson({ error: "That reply could not be found." }, { status: 404 })
  const { replyId } = parsedParams.data
  const json = await readJsonBody(request, 10_000)
  if (!json.ok) return json.response
  const parsedBody = editSchema.safeParse(json.value)
  if (!parsedBody.success) {
    return noStoreJson({ error: parsedBody.error.issues[0]?.message ?? "The update is not valid." }, { status: 400 })
  }

  const { data: existing, error: existingError } = await context.admin
    .from("community_replies")
    .select("id, post_id, parent_reply_id, author_id, body, status, created_at, edited_at")
    .eq("id", parsedParams.data.replyId)
    .maybeSingle<ReplyRow>()

  if (existingError) {
    backendError("community_reply_edit_lookup_failed", existingError, { userId: context.userId, replyId })
    return noStoreJson({ error: "The reply could not be updated." }, { status: 500 })
  }
  if (!existing || existing.status !== "active") return noStoreJson({ error: "That reply is no longer available." }, { status: 404 })
  if (existing.author_id !== context.userId) return noStoreJson({ error: "You can edit only your own replies." }, { status: 403 })

  let moderation
  try {
    moderation = await moderateCommunityText(parsedBody.data.body)
  } catch (moderationError) {
    backendError("community_reply_edit_moderation_unavailable", moderationError, { userId: context.userId, replyId })
    return noStoreJson(
      { error: "Community safety checks are temporarily unavailable. Please try saving again in a moment." },
      { status: 503 },
    )
  }

  const editedAt = new Date().toISOString()
  const { data: updated, error: updateError } = await context.admin
    .from("community_replies")
    .update({ body: parsedBody.data.body, edited_at: editedAt, status: moderation.flagged ? "removed" : "active" })
    .eq("id", existing.id)
    .eq("author_id", context.userId)
    .eq("status", "active")
    .select("id, post_id, parent_reply_id, author_id, body, status, created_at, edited_at")
    .single<ReplyRow>()

  if (updateError) {
    backendError("community_reply_edit_failed", updateError, { userId: context.userId, replyId })
    return noStoreJson({ error: "The reply could not be updated." }, { status: 500 })
  }

  if (moderation.flagged) {
    try {
      await createAiModerationReport({
        admin: context.admin,
        userId: context.userId,
        replyId: updated.id,
        moderation,
      })
    } catch (reportError) {
      backendError("community_reply_edit_ai_report_create_failed", reportError, { userId: context.userId, replyId })
      await context.admin
        .from("community_replies")
        .update({ body: existing.body, edited_at: existing.edited_at, status: "active" })
        .eq("id", existing.id)
      return noStoreJson({ error: "The safety review could not be saved. Please try again." }, { status: 500 })
    }
    return noStoreJson({ heldForReview: true, message: COMMUNITY_AI_HOLD_MESSAGE }, { status: 202 })
  }

  const [{ count: likeCount }, { data: ownLike }] = await Promise.all([
    context.admin.from("community_reply_likes").select("reply_id", { count: "exact", head: true }).eq("reply_id", updated.id),
    context.admin.from("community_reply_likes").select("reply_id").eq("reply_id", updated.id).eq("user_id", context.userId).maybeSingle<{ reply_id: string }>(),
  ])

  const reply: CommunityReply = {
    id: updated.id,
    postId: updated.post_id,
    parentReplyId: updated.parent_reply_id,
    body: updated.body,
    status: updated.status,
    createdAt: updated.created_at,
    editedAt: updated.edited_at,
    author: {
      id: context.userId,
      displayName: context.profile.display_name,
      username: context.profile.username,
    },
    likeCount: likeCount ?? 0,
    likedByViewer: Boolean(ownLike),
    mine: true,
  }

  return noStoreJson({ reply })
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response
  const limited = rateLimitResponse(rateLimitUser(context.userId, "community_reply_mutation", [{ limit: 20, windowMs: 10 * 60 * 1000, label: "20/10m" }]), "Too many Community changes. Wait a few minutes and try again.")
  if (limited) return limited

  const parsedParams = paramsSchema.safeParse(await routeContext.params)
  if (!parsedParams.success) return noStoreJson({ error: "That reply could not be found." }, { status: 404 })
  const { replyId } = parsedParams.data

  const { data: existing, error: existingError } = await context.admin
    .from("community_replies")
    .select("id, author_id, status")
    .eq("id", parsedParams.data.replyId)
    .maybeSingle<{ id: string; author_id: string; status: string }>()

  if (existingError) {
    backendError("community_reply_delete_lookup_failed", existingError, { userId: context.userId, replyId })
    return noStoreJson({ error: "The reply could not be deleted." }, { status: 500 })
  }
  if (!existing || existing.status !== "active") return noStoreJson({ error: "That reply is no longer available." }, { status: 404 })
  if (existing.author_id !== context.userId) return noStoreJson({ error: "You can delete only your own replies." }, { status: 403 })

  const { error: deleteError } = await context.admin
    .from("community_replies")
    .update({ status: "deleted", body: "Reply deleted.", deleted_at: new Date().toISOString() })
    .eq("id", existing.id)
    .eq("author_id", context.userId)
    .eq("status", "active")

  if (deleteError) {
    backendError("community_reply_delete_failed", deleteError, { userId: context.userId, replyId })
    return noStoreJson({ error: "The reply could not be deleted." }, { status: 500 })
  }

  return noStoreJson({ deleted: true, replyId: existing.id })
}
