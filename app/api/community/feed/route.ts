import { getCommunityApiContext, noStoreJson } from "@/lib/community/server"
import type { CommunityFeedPost, CommunityPostType } from "@/lib/community/types"
import { renderableCommunityReplies } from "@/lib/community/visible-replies"
import { backendError } from "@/lib/backend-log"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PAGE_SIZE = 20
const MAX_PAGE = 500

type RankedPostRow = {
  id: string
  author_id: string
  post_type: CommunityPostType
  title: string | null
  body: string
  shared_transcript: string | null
  created_at: string
  edited_at: string | null
  like_count: number | string
  reply_count: number | string
}

type ProfileRow = {
  id: string
  username: string
  display_name: string
}

type ViewerLikeRow = { post_id: string }
type AudioRow = { post_id: string; duration_seconds: number; status: string }
type VisibleReplyRow = {
  id: string
  post_id: string
  parent_reply_id: string | null
  status: string
}

function parsePage(request: Request) {
  const raw = new URL(request.url).searchParams.get("page")
  const parsed = Number.parseInt(raw ?? "0", 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.min(parsed, MAX_PAGE)
}

function logCommunityQueryError(label: string, error: unknown) {
  backendError("community_feed_query_failed", error, { query: label })
}

export async function GET(request: Request) {
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response

  try {
    const page = parsePage(request)
    const offset = page * PAGE_SIZE

    const { data: rawPosts, error: postsError } = await context.userClient.rpc(
      "community_ranked_feed",
      { page_offset: offset, page_size: PAGE_SIZE + 1 },
    ) as { data: RankedPostRow[] | null; error: unknown }

    if (postsError) {
      logCommunityQueryError("Ranked Community feed query failed", postsError)
      return noStoreJson(
        { error: "Community ranking is not ready yet. Run the newest Supabase migration, then try again." },
        { status: 500 },
      )
    }

    const hasMore = (rawPosts?.length ?? 0) > PAGE_SIZE
    const posts = (rawPosts ?? []).slice(0, PAGE_SIZE)
    const postIds = posts.map((post) => post.id)
    const authorIds = Array.from(new Set(posts.map((post) => post.author_id)))

    const [profilesResult, viewerLikesResult, activeRepliesResult, audioResult] = await Promise.all([
      authorIds.length
        ? context.userClient.rpc("community_public_profiles", {
            requested_user_ids: authorIds,
          }) as PromiseLike<{ data: ProfileRow[] | null; error: unknown }>
        : Promise.resolve({ data: [] as ProfileRow[], error: null }),
      postIds.length
        ? context.userClient
            .from("community_post_likes")
            .select("post_id")
            .in("post_id", postIds)
            .returns<ViewerLikeRow[]>()
        : Promise.resolve({ data: [] as ViewerLikeRow[], error: null }),
      postIds.length
        ? context.userClient
            .from("community_replies")
            .select("id, post_id, parent_reply_id, status")
            .in("post_id", postIds)
            .returns<VisibleReplyRow[]>()
        : Promise.resolve({ data: [] as VisibleReplyRow[], error: null }),
      postIds.length
        ? context.userClient
            .from("community_audio")
            .select("post_id, duration_seconds, status")
            .in("post_id", postIds)
            .eq("status", "ready")
            .returns<AudioRow[]>()
        : Promise.resolve({ data: [] as AudioRow[], error: null }),
    ])

    if (profilesResult.error) logCommunityQueryError("Community author lookup failed", profilesResult.error)
    if (viewerLikesResult.error) logCommunityQueryError("Viewer Community likes lookup failed", viewerLikesResult.error)
    if (activeRepliesResult.error) logCommunityQueryError("Community active reply count lookup failed", activeRepliesResult.error)
    if (audioResult.error) logCommunityQueryError("Community audio metadata lookup failed", audioResult.error)

    const profileRows: ProfileRow[] = profilesResult.data ?? []
    const viewerLikeRows: ViewerLikeRow[] = viewerLikesResult.data ?? []
    const visibleReplyRows: VisibleReplyRow[] = activeRepliesResult.data ?? []
    const audioRows: AudioRow[] = audioResult.data ?? []
    const audioByPost = new Map(audioRows.map((audio) => [audio.post_id, audio]))
    const profiles = new Map<string, ProfileRow>(profileRows.map((profile: ProfileRow) => [profile.id, profile]))
    const likedByViewer = new Set<string>(viewerLikeRows.map((like: ViewerLikeRow) => like.post_id))
    const repliesByPost = new Map<string, VisibleReplyRow[]>()
    for (const reply of visibleReplyRows) {
      const list = repliesByPost.get(reply.post_id) ?? []
      list.push(reply)
      repliesByPost.set(reply.post_id, list)
    }
    const visibleReplyCounts = new Map<string, number>()
    for (const postId of postIds) {
      const renderableRows = renderableCommunityReplies(repliesByPost.get(postId) ?? [])
      const activeCount = renderableRows.reduce((count, reply) => count + (reply.status === "active" ? 1 : 0), 0)
      visibleReplyCounts.set(postId, activeCount)
    }

    const safePosts: CommunityFeedPost[] = posts.map((post) => {
      const author = profiles.get(post.author_id)
      return {
        id: post.id,
        postType: post.post_type,
        title: post.title,
        body: post.body,
        sharedTranscript: post.shared_transcript,
        hasAudio: audioByPost.has(post.id),
        audioDurationSeconds: audioByPost.get(post.id)?.duration_seconds ?? null,
        createdAt: post.created_at,
        editedAt: post.edited_at,
        author: {
          id: post.author_id,
          displayName: author?.display_name ?? "Tellwise member",
          username: author?.username ?? `member_${post.author_id.slice(0, 6)}`,
        },
        likeCount: Number(post.like_count) || 0,
        // Every active comment in the conversation counts as one response,
        // including replies to replies. Likes never count.
        replyCount: visibleReplyCounts.get(post.id) ?? 0,
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
