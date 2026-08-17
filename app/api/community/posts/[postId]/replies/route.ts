import { z } from "zod"
import { getCommunityApiContext, noStoreJson, type CommunityApiContext } from "@/lib/community/server"
import type { CommunityReply, CommunityContentStatus } from "@/lib/community/types"
import { renderableCommunityReplies } from "@/lib/community/visible-replies"
import { COMMUNITY_AI_HOLD_MESSAGE, createAiModerationReport, moderateCommunityText } from "@/lib/community/ai-moderation"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser, rejectLargeRequest } from "@/lib/request-protection"
import { backendError } from "@/lib/backend-log"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const paramsSchema = z.object({ postId: z.string().uuid() }).strict()
const createReplySchema = z.object({
  body: z.string().trim().min(1, "Write a reply before posting.").max(2000, "Replies can be at most 2,000 characters."),
  parentReplyId: z.string().uuid().nullable().optional(),
}).strict()

type RouteContext = { params: Promise<{ postId: string }> }
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
type ProfileRow = { id: string; username: string; display_name: string }
type ReplyLikeRow = { reply_id: string }

async function verifyVisiblePost(postId: string, context: CommunityApiContext) {
  const { data, error } = await context.userClient
    .from("community_posts")
    .select("id")
    .eq("id", postId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>()

  if (error) throw error
  return Boolean(data)
}

export async function GET(_request: Request, routeContext: RouteContext) {
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response

  const parsedParams = paramsSchema.safeParse(await routeContext.params)
  if (!parsedParams.success) return noStoreJson({ error: "That post could not be found." }, { status: 404 })
  const { postId } = parsedParams.data

  try {
    if (!(await verifyVisiblePost(postId, context))) {
      return noStoreJson({ error: "That post is no longer available." }, { status: 404 })
    }

    const { data: rows, error: repliesError } = await context.userClient
      .from("community_replies")
      .select("id, post_id, parent_reply_id, author_id, body, status, created_at, edited_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(500)
      .returns<ReplyRow[]>()

    if (repliesError) throw repliesError

    const replyRows: ReplyRow[] = renderableCommunityReplies(rows ?? [])
    const authorIds = Array.from(new Set(replyRows.filter((reply: ReplyRow) => reply.status === "active").map((reply: ReplyRow) => reply.author_id)))
    const replyIds = replyRows.map((reply: ReplyRow) => reply.id)

    const [profilesResult, likesResult, viewerLikesResult] = await Promise.all([
      authorIds.length
        ? context.userClient.rpc("community_public_profiles", {
            requested_user_ids: authorIds,
          }) as PromiseLike<{ data: ProfileRow[] | null; error: unknown }>
        : Promise.resolve({ data: [] as ProfileRow[], error: null }),
      replyIds.length
        ? context.admin.from("community_reply_likes").select("reply_id").in("reply_id", replyIds).returns<ReplyLikeRow[]>()
        : Promise.resolve({ data: [] as ReplyLikeRow[], error: null }),
      replyIds.length
        ? context.userClient.from("community_reply_likes").select("reply_id").in("reply_id", replyIds).returns<ReplyLikeRow[]>()
        : Promise.resolve({ data: [] as ReplyLikeRow[], error: null }),
    ])

    if (profilesResult.error) backendError("community_reply_author_lookup_failed", profilesResult.error, { userId: context.userId, postId })
    if (likesResult.error) backendError("community_reply_like_lookup_failed", likesResult.error, { userId: context.userId, postId })
    if (viewerLikesResult.error) backendError("community_reply_viewer_like_lookup_failed", viewerLikesResult.error, { userId: context.userId, postId })

    const profileRows: ProfileRow[] = profilesResult.data ?? []
    const profiles = new Map<string, ProfileRow>(profileRows.map((profile: ProfileRow) => [profile.id, profile]))
    const likeCounts = new Map<string, number>()
    for (const like of likesResult.data ?? []) {
      likeCounts.set(like.reply_id, (likeCounts.get(like.reply_id) ?? 0) + 1)
    }
    const likedByViewer = new Set<string>((viewerLikesResult.data ?? []).map((like) => like.reply_id))

    const replies: CommunityReply[] = replyRows.map((reply: ReplyRow) => {
      const deleted = reply.status !== "active"
      const author = deleted ? undefined : profiles.get(reply.author_id)
      return {
        id: reply.id,
        postId: reply.post_id,
        parentReplyId: reply.parent_reply_id,
        body: deleted ? "" : reply.body,
        status: reply.status,
        createdAt: reply.created_at,
        editedAt: reply.edited_at,
        author: {
          id: deleted ? "" : reply.author_id,
          displayName: deleted ? "StoryTuner member" : author?.display_name ?? "StoryTuner member",
          username: deleted ? "member" : author?.username ?? "member",
        },
        likeCount: deleted ? 0 : likeCounts.get(reply.id) ?? 0,
        likedByViewer: !deleted && likedByViewer.has(reply.id),
        mine: !deleted && reply.author_id === context.userId,
      }
    })

    const activeReplyCount = replyRows.filter(
      (reply: ReplyRow) => reply.status === "active",
    ).length
    return noStoreJson({ replies, activeReplyCount })
  } catch (error) {
    backendError("community_replies_load_failed", error, { userId: context.userId, postId })
    return noStoreJson({ error: "Replies could not be loaded." }, { status: 500 })
  }
}

export async function POST(request: Request, routeContext: RouteContext) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response
  const oversized = rejectLargeRequest(request, 10_000)
  if (oversized) return oversized
  const blocked = rateLimitResponse(rateLimitUser(context.userId, "community_reply", [
    { limit: 12, windowMs: 10 * 60 * 1000, label: "12/10min" },
  ]), "You have posted several replies recently. Wait a few minutes before replying again.")
  if (blocked) return blocked

  const parsedParams = paramsSchema.safeParse(await routeContext.params)
  if (!parsedParams.success) return noStoreJson({ error: "That post could not be found." }, { status: 404 })
  const json = await readJsonBody(request, 10_000)
  if (!json.ok) return json.response
  const parsedBody = createReplySchema.safeParse(json.value)
  if (!parsedBody.success) {
    return noStoreJson({ error: parsedBody.error.issues[0]?.message ?? "The reply is not valid." }, { status: 400 })
  }

  const { postId } = parsedParams.data
  const parentReplyId = parsedBody.data.parentReplyId ?? null

  try {
    if (!(await verifyVisiblePost(postId, context))) {
      return noStoreJson({ error: "That post is no longer available." }, { status: 404 })
    }

    if (parentReplyId) {
      const { data: parent, error: parentError } = await context.userClient
        .from("community_replies")
        .select("id")
        .eq("id", parentReplyId)
        .eq("post_id", postId)
        .eq("status", "active")
        .maybeSingle<{ id: string }>()

      if (parentError) throw parentError
      if (!parent) return noStoreJson({ error: "The reply you selected is no longer available." }, { status: 404 })
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count, error: countError } = await context.admin
      .from("community_replies")
      .select("id", { count: "exact", head: true })
      .eq("author_id", context.userId)
      .gte("created_at", tenMinutesAgo)

    if (countError) throw countError
    if ((count ?? 0) >= 10) {
      return noStoreJson({ error: "You have posted several replies recently. Wait a few minutes before replying again." }, { status: 429 })
    }

    let moderation
    try {
      moderation = await moderateCommunityText(parsedBody.data.body)
    } catch (moderationError) {
      backendError("community_reply_moderation_unavailable", moderationError, { userId: context.userId, postId })
      return noStoreJson(
        { error: "Community safety checks are temporarily unavailable. Please try replying again in a moment." },
        { status: 503 },
      )
    }

    const { data: inserted, error: insertError } = await context.admin
      .from("community_replies")
      .insert({
        post_id: postId,
        author_id: context.userId,
        parent_reply_id: parentReplyId,
        body: parsedBody.data.body,
        status: moderation.flagged ? "removed" : "active",
      })
      .select("id, post_id, parent_reply_id, author_id, body, status, created_at, edited_at")
      .single<ReplyRow>()

    if (insertError) throw insertError

    if (moderation.flagged) {
      try {
        await createAiModerationReport({
          admin: context.admin,
          userId: context.userId,
          replyId: inserted.id,
          moderation,
        })
      } catch (reportError) {
        backendError("community_reply_ai_report_create_failed", reportError, { userId: context.userId, postId })
        await context.admin.from("community_replies").delete().eq("id", inserted.id)
        return noStoreJson({ error: "The safety review could not be saved. Please try again." }, { status: 500 })
      }
      return noStoreJson(
        { heldForReview: true, message: COMMUNITY_AI_HOLD_MESSAGE },
        { status: 202 },
      )
    }

    const reply: CommunityReply = {
      id: inserted.id,
      postId: inserted.post_id,
      parentReplyId: inserted.parent_reply_id,
      body: inserted.body,
      status: inserted.status,
      createdAt: inserted.created_at,
      editedAt: inserted.edited_at,
      author: {
        id: context.userId,
        displayName: context.profile.display_name,
        username: context.profile.username,
      },
      likeCount: 0,
      likedByViewer: false,
      mine: true,
    }

    return noStoreJson({ reply }, { status: 201 })
  } catch (error) {
    backendError("community_reply_create_failed", error, { userId: context.userId })
    return noStoreJson({ error: "Your reply could not be posted." }, { status: 500 })
  }
}
