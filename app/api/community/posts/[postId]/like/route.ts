import { z } from "zod"
import { getCommunityApiContext, noStoreJson } from "@/lib/community/server"
import { requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"
import { backendError } from "@/lib/backend-log"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const paramsSchema = z.object({ postId: z.string().uuid() }).strict()

type RouteContext = { params: Promise<{ postId: string }> }

async function handleLike(requestContext: RouteContext, liked: boolean) {
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response
  const blocked = rateLimitResponse(rateLimitUser(context.userId, "community_like", [
    { limit: 60, windowMs: 60_000, label: "60/min" },
  ]), "Too many reactions are being sent at once. Wait a moment and try again.")
  if (blocked) return blocked

  const parsedParams = paramsSchema.safeParse(await requestContext.params)
  if (!parsedParams.success) return noStoreJson({ error: "That post could not be found." }, { status: 404 })
  const { postId } = parsedParams.data

  const { data: visiblePost, error: visibilityError } = await context.userClient
    .from("community_posts")
    .select("id")
    .eq("id", postId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>()

  if (visibilityError) {
    backendError("community_post_like_visibility_failed", visibilityError, { userId: context.userId, postId })
    return noStoreJson({ error: "The post could not be updated." }, { status: 500 })
  }
  if (!visiblePost) return noStoreJson({ error: "That post is no longer available." }, { status: 404 })

  const mutation = liked
    ? context.admin.from("community_post_likes").upsert(
        { post_id: postId, user_id: context.userId },
        { onConflict: "post_id,user_id", ignoreDuplicates: true },
      )
    : context.admin
        .from("community_post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", context.userId)

  const { error: mutationError } = await mutation
  if (mutationError) {
    backendError("community_post_like_mutation_failed", mutationError, { userId: context.userId, postId, liked })
    return noStoreJson({ error: "The like could not be updated." }, { status: 500 })
  }

  const { count, error: countError } = await context.admin
    .from("community_post_likes")
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", postId)

  if (countError) {
    backendError("community_post_like_count_failed", countError, { userId: context.userId, postId })
    return noStoreJson({ error: "The like was saved, but its count could not be refreshed." }, { status: 500 })
  }

  return noStoreJson({ likedByViewer: liked, likeCount: count ?? 0 })
}

export async function POST(request: Request, routeContext: RouteContext) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite
  return handleLike(routeContext, true)
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite
  return handleLike(routeContext, false)
}
