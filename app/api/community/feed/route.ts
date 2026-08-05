import { getCommunityApiContext, noStoreJson } from "@/lib/community/server"
import type { CommunityFeedPost, CommunityPostType } from "@/lib/community/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PAGE_SIZE = 20
const MAX_PAGE = 500

type PostRow = {
  id: string
  author_id: string
  post_type: CommunityPostType
  title: string | null
  body: string
  shared_transcript: string | null
  created_at: string
  edited_at: string | null
}

type ProfileRow = {
  id: string
  username: string
  display_name: string
}

type PostLikeRow = {
  post_id: string
  user_id: string
}

type ReplyRow = {
  post_id: string
}

function parsePage(request: Request) {
  const raw = new URL(request.url).searchParams.get("page")
  const parsed = Number.parseInt(raw ?? "0", 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.min(parsed, MAX_PAGE)
}

function logCommunityQueryError(label: string, error: unknown) {
  if (error && typeof error === "object") {
    const value = error as {
      code?: string
      message?: string
      details?: string
      hint?: string
    }
    console.error(label, {
      code: value.code,
      message: value.message,
      details: value.details,
      hint: value.hint,
    })
    return
  }
  console.error(label, error)
}

export async function GET(request: Request) {
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response

  try {
    const page = parsePage(request)
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE

    // Use the signed-in user's Supabase client for the primary feed query.
    // This makes the database's paid-member and block RLS policies the source
    // of truth instead of rebuilding those rules in a fragile API filter.
    const { data: rawPosts, error: postsError } = await context.userClient
      .from("community_posts")
      .select("id, author_id, post_type, title, body, shared_transcript, created_at, edited_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)
      .returns<PostRow[]>()

    if (postsError) {
      logCommunityQueryError("Community posts query failed", postsError)
      return noStoreJson(
        { error: "Community posts could not be loaded." },
        { status: 500 },
      )
    }

    const hasMore = (rawPosts?.length ?? 0) > PAGE_SIZE
    const posts = (rawPosts ?? []).slice(0, PAGE_SIZE)
    const postIds = posts.map((post) => post.id)
    const authorIds = Array.from(new Set(posts.map((post) => post.author_id)))

    // Secondary metadata must never take down the actual feed. A temporary
    // author, like-count, or reply-count query failure falls back gracefully.
    const [profilesResult, likesResult, repliesResult] = await Promise.all([
      authorIds.length > 0
        ? context.admin
            .from("profiles")
            .select("id, username, display_name")
            .in("id", authorIds)
            .returns<ProfileRow[]>()
        : Promise.resolve({ data: [] as ProfileRow[], error: null }),
      postIds.length > 0
        ? context.admin
            .from("community_post_likes")
            .select("post_id, user_id")
            .in("post_id", postIds)
            .returns<PostLikeRow[]>()
        : Promise.resolve({ data: [] as PostLikeRow[], error: null }),
      postIds.length > 0
        ? context.admin
            .from("community_replies")
            .select("post_id")
            .in("post_id", postIds)
            .eq("status", "active")
            .returns<ReplyRow[]>()
        : Promise.resolve({ data: [] as ReplyRow[], error: null }),
    ])

    if (profilesResult.error) logCommunityQueryError("Community author lookup failed", profilesResult.error)
    if (likesResult.error) logCommunityQueryError("Community like-count lookup failed", likesResult.error)
    if (repliesResult.error) logCommunityQueryError("Community reply-count lookup failed", repliesResult.error)

    const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]))
    const likeCounts = new Map<string, number>()
    const likedByViewer = new Set<string>()
    for (const like of likesResult.data ?? []) {
      likeCounts.set(like.post_id, (likeCounts.get(like.post_id) ?? 0) + 1)
      if (like.user_id === context.userId) likedByViewer.add(like.post_id)
    }

    const replyCounts = new Map<string, number>()
    for (const reply of repliesResult.data ?? []) {
      replyCounts.set(reply.post_id, (replyCounts.get(reply.post_id) ?? 0) + 1)
    }

    const safePosts: CommunityFeedPost[] = posts.map((post) => {
      const author = profiles.get(post.author_id)
      return {
        id: post.id,
        postType: post.post_type,
        title: post.title,
        body: post.body,
        sharedTranscript: post.shared_transcript,
        createdAt: post.created_at,
        editedAt: post.edited_at,
        author: {
          id: post.author_id,
          displayName: author?.display_name ?? "StoryTuner member",
          username: author?.username ?? "member",
        },
        likeCount: likeCounts.get(post.id) ?? 0,
        replyCount: replyCounts.get(post.id) ?? 0,
        likedByViewer: likedByViewer.has(post.id),
        mine: post.author_id === context.userId,
      }
    })

    return noStoreJson({ posts: safePosts, page, hasMore })
  } catch (error) {
    logCommunityQueryError("Community feed error", error)
    return noStoreJson({ error: "Community posts could not be loaded." }, { status: 500 })
  }
}
