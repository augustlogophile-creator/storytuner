import { z } from "zod"
import { getCommunityApiContext, noStoreJson, type CommunityApiContext } from "@/lib/community/server"
import type { CommunityReply, CommunityContentStatus } from "@/lib/community/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const paramsSchema = z.object({ postId: z.string().uuid() })
const createReplySchema = z.object({
  body: z.string().trim().min(1, "Write a reply before posting.").max(2000, "Replies can be at most 2,000 characters."),
  parentReplyId: z.string().uuid().nullable().optional(),
})

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
type ReplyLikeRow = { reply_id: string; user_id: string }

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
      .returns<ReplyRow[]>()

    if (repliesError) throw repliesError

    const replyRows: ReplyRow[] = rows ?? []
    const authorIds = Array.from(new Set(replyRows.filter((reply: ReplyRow) => reply.status === "active").map((reply: ReplyRow) => reply.author_id)))
    const replyIds = replyRows.map((reply: ReplyRow) => reply.id)

    const [profilesResult, likesResult] = await Promise.all([
      authorIds.length
        ? context.userClient.rpc("community_public_profiles", {
            requested_user_ids: authorIds,
          }) as PromiseLike<{ data: ProfileRow[] | null; error: unknown }>
        : Promise.resolve({ data: [] as ProfileRow[], error: null }),
      replyIds.length
        ? context.admin.from("community_reply_likes").select("reply_id, user_id").in("reply_id", replyIds).returns<ReplyLikeRow[]>()
        : Promise.resolve({ data: [] as ReplyLikeRow[], error: null }),
    ])

    if (profilesResult.error) console.error("Community reply author lookup failed", profilesResult.error)
    if (likesResult.error) console.error("Community reply-like lookup failed", likesResult.error)

    const profileRows: ProfileRow[] = profilesResult.data ?? []
    const profiles = new Map<string, ProfileRow>(profileRows.map((profile: ProfileRow) => [profile.id, profile]))
    const likeCounts = new Map<string, number>()
    const likedByViewer = new Set<string>()
    for (const like of likesResult.data ?? []) {
      likeCounts.set(like.reply_id, (likeCounts.get(like.reply_id) ?? 0) + 1)
      if (like.user_id === context.userId) likedByViewer.add(like.reply_id)
    }

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

    return noStoreJson({ replies })
  } catch (error) {
    console.error("Community replies loading failed", error)
    return noStoreJson({ error: "Replies could not be loaded." }, { status: 500 })
  }
}

export async function POST(request: Request, routeContext: RouteContext) {
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response

  const parsedParams = paramsSchema.safeParse(await routeContext.params)
  if (!parsedParams.success) return noStoreJson({ error: "That post could not be found." }, { status: 404 })
  const parsedBody = createReplySchema.safeParse(await request.json().catch(() => null))
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

    const { data: inserted, error: insertError } = await context.admin
      .from("community_replies")
      .insert({
        post_id: postId,
        author_id: context.userId,
        parent_reply_id: parentReplyId,
        body: parsedBody.data.body,
        status: "active",
      })
      .select("id, post_id, parent_reply_id, author_id, body, status, created_at, edited_at")
      .single<ReplyRow>()

    if (insertError) throw insertError

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
    console.error("Community reply creation failed", error)
    return noStoreJson({ error: "Your reply could not be posted." }, { status: 500 })
  }
}
