import { z } from "zod"
import { getCommunityApiContext, noStoreJson } from "@/lib/community/server"
import type { CommunityFeedPost } from "@/lib/community/types"

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
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response

  try {
    const parsed = createPostSchema.safeParse(await request.json())
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

    const { data, error } = await context.admin
      .from("community_posts")
      .insert({
        author_id: context.userId,
        post_type: "text",
        body: parsed.data.body,
        status: "active",
      })
      .select("id, created_at")
      .single<InsertedPost>()

    if (error) throw error

    const post: CommunityFeedPost = {
      id: data.id,
      postType: "text",
      title: null,
      body: parsed.data.body,
      sharedTranscript: null,
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
    console.error("Community post creation error", error)
    return noStoreJson({ error: "Your post could not be published." }, { status: 500 })
  }
}
