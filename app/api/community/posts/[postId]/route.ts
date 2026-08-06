import { z } from "zod"
import { getCommunityApiContext, noStoreJson } from "@/lib/community/server"
import type { CommunityFeedPost } from "@/lib/community/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const paramsSchema = z.object({ postId: z.string().uuid() })
const editSchema = z.object({
  body: z.string().trim().min(1, "A post cannot be empty.").max(5000, "Posts can be at most 5,000 characters."),
})

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
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response

  const parsedParams = paramsSchema.safeParse(await routeContext.params)
  if (!parsedParams.success) return noStoreJson({ error: "That post could not be found." }, { status: 404 })

  const parsedBody = editSchema.safeParse(await request.json().catch(() => null))
  if (!parsedBody.success) {
    return noStoreJson({ error: parsedBody.error.issues[0]?.message ?? "The update is not valid." }, { status: 400 })
  }

  const { data: existing, error: existingError } = await context.admin
    .from("community_posts")
    .select("id, author_id, post_type, title, body, shared_transcript, status, created_at, edited_at")
    .eq("id", parsedParams.data.postId)
    .maybeSingle<OwnedPostRow>()

  if (existingError) {
    console.error("Community post edit lookup failed", existingError)
    return noStoreJson({ error: "The post could not be updated." }, { status: 500 })
  }
  if (!existing || existing.status !== "active") return noStoreJson({ error: "That post is no longer available." }, { status: 404 })
  if (existing.author_id !== context.userId) return noStoreJson({ error: "You can edit only your own posts." }, { status: 403 })
  if (existing.post_type !== "text") return noStoreJson({ error: "This shared item cannot be edited here." }, { status: 400 })

  const editedAt = new Date().toISOString()
  const { data: updated, error: updateError } = await context.admin
    .from("community_posts")
    .update({ body: parsedBody.data.body, edited_at: editedAt })
    .eq("id", existing.id)
    .eq("author_id", context.userId)
    .eq("status", "active")
    .select("id, author_id, post_type, title, body, shared_transcript, status, created_at, edited_at")
    .single<OwnedPostRow>()

  if (updateError) {
    console.error("Community post edit failed", updateError)
    return noStoreJson({ error: "The post could not be updated." }, { status: 500 })
  }

  const [{ count: likeCount }, { count: replyCount }] = await Promise.all([
    context.admin.from("community_post_likes").select("post_id", { count: "exact", head: true }).eq("post_id", updated.id),
    context.admin.from("community_replies").select("id", { count: "exact", head: true }).eq("post_id", updated.id).eq("status", "active"),
  ])

  const post: CommunityFeedPost = {
    id: updated.id,
    postType: updated.post_type,
    title: updated.title,
    body: updated.body,
    sharedTranscript: updated.shared_transcript,
    createdAt: updated.created_at,
    editedAt: updated.edited_at,
    author: {
      id: context.userId,
      displayName: context.profile.display_name,
      username: context.profile.username,
    },
    likeCount: likeCount ?? 0,
    replyCount: replyCount ?? 0,
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

export async function DELETE(_request: Request, routeContext: RouteContext) {
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response

  const parsedParams = paramsSchema.safeParse(await routeContext.params)
  if (!parsedParams.success) return noStoreJson({ error: "That post could not be found." }, { status: 404 })

  const { data: existing, error: existingError } = await context.admin
    .from("community_posts")
    .select("id, author_id, status")
    .eq("id", parsedParams.data.postId)
    .maybeSingle<{ id: string; author_id: string; status: string }>()

  if (existingError) {
    console.error("Community post deletion lookup failed", existingError)
    return noStoreJson({ error: "The post could not be deleted." }, { status: 500 })
  }
  if (!existing || existing.status !== "active") return noStoreJson({ error: "That post is no longer available." }, { status: 404 })
  if (existing.author_id !== context.userId) return noStoreJson({ error: "You can delete only your own posts." }, { status: 403 })

  const deletedAt = new Date().toISOString()
  const { error: deleteError } = await context.admin
    .from("community_posts")
    .update({ status: "deleted", deleted_at: deletedAt })
    .eq("id", existing.id)
    .eq("author_id", context.userId)
    .eq("status", "active")

  if (deleteError) {
    console.error("Community post deletion failed", deleteError)
    return noStoreJson({ error: "The post could not be deleted." }, { status: 500 })
  }

  return noStoreJson({ deleted: true, postId: existing.id })
}
