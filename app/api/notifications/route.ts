import { getActiveAuthenticatedUser } from "@/lib/require-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMembershipByUserId } from "@/lib/membership-server"
import { backendError } from "@/lib/backend-log"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type NotificationKind = "post_like" | "post_reply" | "reply_like" | "reply_reply"

type NotificationItem = {
  id: string
  kind: NotificationKind
  actor: { username: string; displayName: string }
  text: string
  createdAt: string
  href: string
}

type PostRow = { id: string; title: string | null }
type ReplyRow = { id: string; post_id: string; parent_reply_id: string | null; author_id: string; body: string; created_at: string }
type LikePostRow = { post_id: string; user_id: string; created_at: string }
type LikeReplyRow = { reply_id: string; user_id: string; created_at: string }
type ProfileRow = { id: string; username: string; display_name: string }

function noStore(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "private, no-store, max-age=0")
  return Response.json(data, { ...init, headers })
}

function safeLabel(value: string | null | undefined, fallback: string) {
  const cleaned = (value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim()
  return cleaned ? cleaned.slice(0, 90) : fallback
}

export async function GET(request: Request) {
  const active = await getActiveAuthenticatedUser()
  if (!active.ok) return active.response

  const url = new URL(request.url)
  const requestedLimit = Number(url.searchParams.get("limit") ?? 40)
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(60, Math.floor(requestedLimit))) : 40

  let membership
  try {
    membership = await getMembershipByUserId(active.user.id)
  } catch (error) {
    backendError("notifications_membership_lookup_failed", error, { userId: active.user.id })
    return noStore({ items: [], latestAt: null, communityAvailable: false })
  }

  if (!membership.active) {
    return noStore({ items: [], latestAt: null, communityAvailable: false })
  }

  const admin = createAdminClient()
  const userId = active.user.id

  try {
    const [{ data: posts, error: postsError }, { data: ownReplies, error: ownRepliesError }] = await Promise.all([
      admin
        .from("community_posts")
        .select("id, title")
        .eq("author_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(100)
        .returns<PostRow[]>(),
      admin
        .from("community_replies")
        .select("id, post_id, parent_reply_id, author_id, body, created_at")
        .eq("author_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(150)
        .returns<ReplyRow[]>(),
    ])

    if (postsError || ownRepliesError) throw postsError || ownRepliesError

    const postRows = posts ?? []
    const replyRows = ownReplies ?? []
    const postIds = postRows.map((post) => post.id)
    const replyIds = replyRows.map((reply) => reply.id)
    const postById = new Map(postRows.map((post) => [post.id, post]))
    const ownReplyById = new Map(replyRows.map((reply) => [reply.id, reply]))

    const [postLikesResult, repliesOnPostsResult, replyLikesResult, repliesToRepliesResult] = await Promise.all([
      postIds.length
        ? admin.from("community_post_likes").select("post_id, user_id, created_at").in("post_id", postIds).neq("user_id", userId).order("created_at", { ascending: false }).limit(80).returns<LikePostRow[]>()
        : Promise.resolve({ data: [] as LikePostRow[], error: null }),
      postIds.length
        ? admin.from("community_replies").select("id, post_id, parent_reply_id, author_id, body, created_at").in("post_id", postIds).neq("author_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(80).returns<ReplyRow[]>()
        : Promise.resolve({ data: [] as ReplyRow[], error: null }),
      replyIds.length
        ? admin.from("community_reply_likes").select("reply_id, user_id, created_at").in("reply_id", replyIds).neq("user_id", userId).order("created_at", { ascending: false }).limit(80).returns<LikeReplyRow[]>()
        : Promise.resolve({ data: [] as LikeReplyRow[], error: null }),
      replyIds.length
        ? admin.from("community_replies").select("id, post_id, parent_reply_id, author_id, body, created_at").in("parent_reply_id", replyIds).neq("author_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(80).returns<ReplyRow[]>()
        : Promise.resolve({ data: [] as ReplyRow[], error: null }),
    ])

    const queryErrors = [postLikesResult.error, repliesOnPostsResult.error, replyLikesResult.error, repliesToRepliesResult.error].filter(Boolean)
    if (queryErrors.length) throw queryErrors[0]

    const replyToReplyIds = new Set((repliesToRepliesResult.data ?? []).map((reply) => reply.id))
    const actors = new Set<string>()
    for (const row of postLikesResult.data ?? []) actors.add(row.user_id)
    for (const row of repliesOnPostsResult.data ?? []) actors.add(row.author_id)
    for (const row of replyLikesResult.data ?? []) actors.add(row.user_id)
    for (const row of repliesToRepliesResult.data ?? []) actors.add(row.author_id)

    const actorIds = Array.from(actors)
    const profilesResult = actorIds.length
      ? await admin.from("profiles").select("id, username, display_name").in("id", actorIds).returns<ProfileRow[]>()
      : { data: [] as ProfileRow[], error: null }

    if (profilesResult.error) throw profilesResult.error
    const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]))
    const actorFor = (id: string) => {
      const profile = profiles.get(id)
      return {
        username: profile?.username || "member",
        displayName: profile?.display_name || "Tellwise member",
      }
    }

    const items: NotificationItem[] = []

    for (const like of postLikesResult.data ?? []) {
      const post = postById.get(like.post_id)
      items.push({
        id: `post-like:${like.post_id}:${like.user_id}`,
        kind: "post_like",
        actor: actorFor(like.user_id),
        text: `liked your post${post?.title ? ` “${safeLabel(post.title, "your story")}”` : ""}.`,
        createdAt: like.created_at,
        href: "/community",
      })
    }

    for (const reply of repliesOnPostsResult.data ?? []) {
      // A direct reply to one of the user's replies is shown as the more specific
      // reply notification below rather than duplicated as a post reply.
      if (replyToReplyIds.has(reply.id)) continue
      const post = postById.get(reply.post_id)
      items.push({
        id: `post-reply:${reply.id}`,
        kind: "post_reply",
        actor: actorFor(reply.author_id),
        text: `replied to your post${post?.title ? ` “${safeLabel(post.title, "your story")}”` : ""}.`,
        createdAt: reply.created_at,
        href: "/community",
      })
    }

    for (const like of replyLikesResult.data ?? []) {
      items.push({
        id: `reply-like:${like.reply_id}:${like.user_id}`,
        kind: "reply_like",
        actor: actorFor(like.user_id),
        text: "liked your reply.",
        createdAt: like.created_at,
        href: "/community",
      })
    }

    for (const reply of repliesToRepliesResult.data ?? []) {
      const parent = reply.parent_reply_id ? ownReplyById.get(reply.parent_reply_id) : null
      items.push({
        id: `reply-reply:${reply.id}`,
        kind: "reply_reply",
        actor: actorFor(reply.author_id),
        text: `replied to your comment${parent?.body ? ` “${safeLabel(parent.body, "your reply")}”` : ""}.`,
        createdAt: reply.created_at,
        href: "/community",
      })
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const sliced = items.slice(0, limit)

    return noStore({
      items: sliced,
      latestAt: sliced[0]?.createdAt ?? null,
      communityAvailable: true,
    })
  } catch (error) {
    backendError("notifications_load_failed", error, { userId })
    return noStore({ error: "Notifications could not be loaded." }, { status: 500 })
  }
}
