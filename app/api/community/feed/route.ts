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

type BlockRow = {
  blocker_id: string
  blocked_id: string
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

export async function GET(request: Request) {
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response

  try {
    const page = parsePage(request)
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE

    const { data: blockRows, error: blockError } = await context.admin
      .from("community_user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${context.userId},blocked_id.eq.${context.userId}`)
      .returns<BlockRow[]>()

    if (blockError) throw blockError

    const blockedUserIds = new Set<string>()
    for (const block of blockRows ?? []) {
      blockedUserIds.add(block.blocker_id === context.userId ? block.blocked_id : block.blocker_id)
    }

    let postsQuery = context.admin
      .from("community_posts")
      .select("id, author_id, post_type, title, body, shared_transcript, created_at, edited_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)

    if (blockedUserIds.size > 0) {
      postsQuery = postsQuery.not("author_id", "in", `(${Array.from(blockedUserIds).join(",")})`)
    }

    const { data: rawPosts, error: postsError } = await postsQuery.returns<PostRow[]>()
    if (postsError) throw postsError

    const hasMore = (rawPosts?.length ?? 0) > PAGE_SIZE
    const posts = (rawPosts ?? []).slice(0, PAGE_SIZE)
    const postIds = posts.map((post) => post.id)
    const authorIds = Array.from(new Set(posts.map((post) => post.author_id)))

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

    if (profilesResult.error) throw profilesResult.error
    if (likesResult.error) throw likesResult.error
    if (repliesResult.error) throw repliesResult.error

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
    console.error("Community feed error", error)
    return noStoreJson({ error: "Community posts could not be loaded." }, { status: 500 })
  }
}
