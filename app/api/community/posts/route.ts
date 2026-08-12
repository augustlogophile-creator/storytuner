import { z } from "zod"
import { getCommunityApiContext, noStoreJson } from "@/lib/community/server"
import type { CommunityFeedPost } from "@/lib/community/types"
import { COMMUNITY_AI_HOLD_MESSAGE, createAiModerationReport, moderateCommunityText } from "@/lib/community/ai-moderation"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser, rejectLargeRequest } from "@/lib/request-protection"
import { backendError } from "@/lib/backend-log"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const createPostSchema = z.object({
  body: z.string().trim().min(1, "Write something before publishing.").max(5000, "Posts can be at most 5,000 characters."),
})

type InsertedPost = {
  id: string
  created_at: string
}

export async function POST(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response
  const oversized = rejectLargeRequest(request, 15_000)
  if (oversized) return oversized
  const blocked = rateLimitResponse(rateLimitUser(context.userId, "community_post", [
    { limit: 6, windowMs: 10 * 60 * 1000, label: "6/10min" },
  ]), "You have published several posts recently. Wait a few minutes before posting again.")
  if (blocked) return blocked

  try {
    const json = await readJsonBody(request, 15_000)
    if (!json.ok) return json.response
    const parsed = createPostSchema.safeParse(json.value)
    if (!parsed.success) {
      return noStoreJson(
        { error: parsed.error.issues[0]?.message ?? "The post is not valid." },
        { status: 400 },
      )
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count, error: countError } = await context.admin
      .from("community_posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", context.userId)
      .gte("created_at", tenMinutesAgo)

    if (countError) throw countError
    if ((count ?? 0) >= 5) {
      return noStoreJson(
        { error: "You have published several posts recently. Wait a few minutes before posting again." },
        { status: 429 },
      )
    }

    let moderation
    try {
      moderation = await moderateCommunityText(parsed.data.body)
    } catch (moderationError) {
      backendError("community_post_moderation_unavailable", moderationError, { userId: context.userId })
      return noStoreJson(
        { error: "Community safety checks are temporarily unavailable. Please try publishing again in a moment." },
        { status: 503 },
      )
    }

    const { data, error } = await context.admin
      .from("community_posts")
      .insert({
        author_id: context.userId,
        post_type: "text",
        body: parsed.data.body,
        status: moderation.flagged ? "removed" : "active",
      })
      .select("id, created_at")
      .single<InsertedPost>()

    if (error) throw error

    if (moderation.flagged) {
      try {
        await createAiModerationReport({
          admin: context.admin,
          userId: context.userId,
          postId: data.id,
          moderation,
        })
      } catch (reportError) {
        backendError("community_post_ai_report_create_failed", reportError, { userId: context.userId })
        await context.admin.from("community_posts").delete().eq("id", data.id)
        return noStoreJson({ error: "The safety review could not be saved. Please try again." }, { status: 500 })
      }
      return noStoreJson(
        { heldForReview: true, message: COMMUNITY_AI_HOLD_MESSAGE },
        { status: 202 },
      )
    }

    const post: CommunityFeedPost = {
      id: data.id,
      postType: "text",
      title: null,
      body: parsed.data.body,
      sharedTranscript: null,
      hasAudio: false,
      audioDurationSeconds: null,
      createdAt: data.created_at,
      editedAt: null,
      author: {
        id: context.userId,
        displayName: context.profile.display_name,
        username: context.profile.username,
      },
      likeCount: 0,
      replyCount: 0,
      likedByViewer: false,
      mine: true,
    }

    return noStoreJson({ post }, { status: 201 })
  } catch (error) {
    backendError("community_post_create_failed", error, { userId: context.userId })
    return noStoreJson({ error: "Your post could not be published." }, { status: 500 })
  }
}
