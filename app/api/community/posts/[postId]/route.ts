import { z } from "zod"
import { getCommunityApiContext, noStoreJson } from "@/lib/community/server"
import type { CommunityFeedPost } from "@/lib/community/types"
import { COMMUNITY_AI_HOLD_MESSAGE, createAiModerationReport, moderateCommunityText } from "@/lib/community/ai-moderation"
import { backendError } from "@/lib/backend-log"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser, rejectLargeRequest } from "@/lib/request-protection"
import { countActiveRenderableReplies } from "@/lib/community/visible-replies"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const paramsSchema = z.object({ postId: z.string().uuid() }).strict()
const editSchema = z.object({
  title: z.string().trim().max(120, "Titles can be at most 120 characters.").optional(),
  body: z.string().trim().max(5000, "Posts can be at most 5,000 characters."),
}).strict()

type RouteContext = { params: Promise<{ postId: string }> }
type OwnedPostRow = {
  id: string
  author_id: string
  post_type: "text" | "transcript" | "audio" | "audio_transcript"
  title: string | null
  body: string
  shared_transcript: string | null
  status: "active" | "deleted" | "removed"
  created_at: string
  edited_at: string | null
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response
  const oversized = rejectLargeRequest(request, 15000)
  if (oversized) return oversized
  const limited = rateLimitResponse(rateLimitUser(context.userId, "community_post_mutation", [{ limit: 20, windowMs: 10 * 60 * 1000, label: "20/10m" }]), "Too many Community changes. Wait a few minutes and try again.")
  if (limited) return limited

  const parsedParams = paramsSchema.safeParse(await routeContext.params)
  if (!parsedParams.success) return noStoreJson({ error: "That post could not be found." }, { status: 404 })
  const { postId } = parsedParams.data

  const json = await readJsonBody(request, 15_000)
  if (!json.ok) return json.response
  const parsedBody = editSchema.safeParse(json.value)
  if (!parsedBody.success) {
    return noStoreJson({ error: parsedBody.error.issues[0]?.message ?? "The update is not valid." }, { status: 400 })
  }

  const { data: existing, error: existingError } = await context.admin
    .from("community_posts")
    .select("id, author_id, post_type, title, body, shared_transcript, status, created_at, edited_at")
    .eq("id", parsedParams.data.postId)
    .maybeSingle<OwnedPostRow>()

  if (existingError) {
    backendError("community_post_edit_lookup_failed", existingError, { userId: context.userId, postId })
    return noStoreJson({ error: "The post could not be updated." }, { status: 500 })
  }
  if (!existing || existing.status !== "active") return noStoreJson({ error: "That post is no longer available." }, { status: 404 })
  if (existing.author_id !== context.userId) return noStoreJson({ error: "You can edit only your own posts." }, { status: 403 })
  if (existing.post_type === "text" && !parsedBody.data.body) {
    return noStoreJson({ error: "A text post cannot be empty." }, { status: 400 })
  }

  const nextTitle = parsedBody.data.title === undefined ? existing.title : (parsedBody.data.title || null)
  let moderation: Awaited<ReturnType<typeof moderateCommunityText>> | null = null
  const textForModeration = [nextTitle, parsedBody.data.body].filter(Boolean).join("\n\n")
  if (textForModeration) {
    try {
      moderation = await moderateCommunityText(textForModeration)
    } catch (moderationError) {
      backendError("community_post_edit_moderation_unavailable", moderationError, { userId: context.userId, postId })
      return noStoreJson(
        { error: "Community safety checks are temporarily unavailable. Please try saving again in a moment." },
        { status: 503 },
      )
    }
  }

  const editedAt = new Date().toISOString()
  const { data: updated, error: updateError } = await context.admin
    .from("community_posts")
    .update({ title: nextTitle, body: parsedBody.data.body, edited_at: editedAt, status: moderation?.flagged ? "removed" : "active" })
    .eq("id", existing.id)
    .eq("author_id", context.userId)
    .eq("status", "active")
    .select("id, author_id, post_type, title, body, shared_transcript, status, created_at, edited_at")
    .single<OwnedPostRow>()

  if (updateError) {
    backendError("community_post_edit_failed", updateError, { userId: context.userId, postId })
    return noStoreJson({ error: "The post could not be updated." }, { status: 500 })
  }

  if (moderation?.flagged) {
    try {
      await createAiModerationReport({
        admin: context.admin,
        userId: context.userId,
        postId: updated.id,
        moderation,
      })
    } catch (reportError) {
      backendError("community_post_edit_ai_report_create_failed", reportError, { userId: context.userId, postId })
      await context.admin
        .from("community_posts")
        .update({ title: existing.title, body: existing.body, edited_at: existing.edited_at, status: "active" })
        .eq("id", existing.id)
      return noStoreJson({ error: "The safety review could not be saved. Please try again." }, { status: 500 })
    }
    return noStoreJson({ heldForReview: true, message: COMMUNITY_AI_HOLD_MESSAGE }, { status: 202 })
  }

  const [{ count: likeCount }, repliesResult, audioResult] = await Promise.all([
    context.admin.from("community_post_likes").select("post_id", { count: "exact", head: true }).eq("post_id", updated.id),
    context.userClient
      .from("community_replies")
      .select("id, parent_reply_id, status")
      .eq("post_id", updated.id)
      .returns<Array<{ id: string; parent_reply_id: string | null; status: string }>>(),
    context.admin
      .from("community_audio")
      .select("duration_seconds,status")
      .eq("post_id", updated.id)
      .eq("status", "ready")
      .maybeSingle<{ duration_seconds: number; status: string }>(),
  ])
  if (repliesResult.error) backendError("community_post_reply_count_refresh_failed", repliesResult.error, { userId: context.userId, postId })
  if (audioResult.error) backendError("community_post_audio_refresh_failed", audioResult.error, { userId: context.userId, postId })
  const replyCount = countActiveRenderableReplies(repliesResult.data ?? [])

  const post: CommunityFeedPost = {
    id: updated.id,
    postType: updated.post_type,
    title: updated.title,
    body: updated.body,
    sharedTranscript: updated.shared_transcript,
    hasAudio: Boolean(audioResult.data),
    audioDurationSeconds: audioResult.data?.duration_seconds ?? null,
    createdAt: updated.created_at,
    editedAt: updated.edited_at,
    author: {
      id: context.userId,
      displayName: context.profile.display_name,
      username: context.profile.username,
    },
    likeCount: likeCount ?? 0,
    replyCount,
    likedByViewer: false,
    mine: true,
  }

  const { data: ownLike } = await context.admin
    .from("community_post_likes")
    .select("post_id")
    .eq("post_id", updated.id)
    .eq("user_id", context.userId)
    .maybeSingle<{ post_id: string }>()
  post.likedByViewer = Boolean(ownLike)

  return noStoreJson({ post })
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response
  const limited = rateLimitResponse(rateLimitUser(context.userId, "community_post_mutation", [{ limit: 20, windowMs: 10 * 60 * 1000, label: "20/10m" }]), "Too many Community changes. Wait a few minutes and try again.")
  if (limited) return limited

  const parsedParams = paramsSchema.safeParse(await routeContext.params)
  if (!parsedParams.success) return noStoreJson({ error: "That post could not be found." }, { status: 404 })
  const { postId } = parsedParams.data

  const { data: existing, error: existingError } = await context.admin
    .from("community_posts")
    .select("id, author_id, status")
    .eq("id", parsedParams.data.postId)
    .maybeSingle<{ id: string; author_id: string; status: string }>()

  if (existingError) {
    backendError("community_post_delete_lookup_failed", existingError, { userId: context.userId, postId })
    return noStoreJson({ error: "The post could not be deleted." }, { status: 500 })
  }
  if (!existing || existing.status !== "active") return noStoreJson({ error: "That post is no longer available." }, { status: 404 })
  if (existing.author_id !== context.userId) return noStoreJson({ error: "You can delete only your own posts." }, { status: 403 })

  const { data: sharedAudio, error: audioLookupError } = await context.admin
    .from("community_audio")
    .select("storage_path")
    .eq("post_id", existing.id)
    .maybeSingle<{ storage_path: string }>()

  if (audioLookupError) backendError("community_audio_delete_lookup_failed", audioLookupError, { userId: context.userId, postId })

  const deletedAt = new Date().toISOString()
  const { error: deleteError } = await context.admin
    .from("community_posts")
    .update({ status: "deleted", deleted_at: deletedAt })
    .eq("id", existing.id)
    .eq("author_id", context.userId)
    .eq("status", "active")

  if (deleteError) {
    backendError("community_post_delete_failed", deleteError, { userId: context.userId, postId })
    return noStoreJson({ error: "The post could not be deleted." }, { status: 500 })
  }

  // Once the post is inactive, RLS makes any lingering audio inaccessible.
  // Storage cleanup is best-effort so a temporary storage error cannot keep a
  // post visible after its owner chose to delete it.
  if (sharedAudio?.storage_path) {
    const { error: storageDeleteError } = await context.admin.storage
      .from("storytuner-community-audio")
      .remove([sharedAudio.storage_path])
    if (storageDeleteError) {
      backendError("community_audio_storage_cleanup_failed", storageDeleteError, { userId: context.userId, postId })
    } else {
      const { error: audioRowDeleteError } = await context.admin.from("community_audio").delete().eq("post_id", existing.id)
      if (audioRowDeleteError) backendError("community_audio_metadata_cleanup_failed", audioRowDeleteError, { userId: context.userId, postId })
    }
  }

  return noStoreJson({ deleted: true, postId: existing.id })
}
