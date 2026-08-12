import { z } from "zod"
import { getCommunityApiContext, noStoreJson } from "@/lib/community/server"
import { requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"
import { backendError } from "@/lib/backend-log"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const paramsSchema = z.object({ replyId: z.string().uuid() })
type RouteContext = { params: Promise<{ replyId: string }> }

async function handleLike(routeContext: RouteContext, liked: boolean) {
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response
  const blocked = rateLimitResponse(rateLimitUser(context.userId, "community_like", [
    { limit: 60, windowMs: 60_000, label: "60/min" },
  ]), "Too many reactions are being sent at once. Wait a moment and try again.")
  if (blocked) return blocked

  const parsedParams = paramsSchema.safeParse(await routeContext.params)
  if (!parsedParams.success) return noStoreJson({ error: "That reply could not be found." }, { status: 404 })
  const { replyId } = parsedParams.data

  const { data: visibleReply, error: visibilityError } = await context.userClient
    .from("community_replies")
    .select("id")
    .eq("id", replyId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>()

  if (visibilityError) {
    backendError("community_reply_like_visibility_failed", visibilityError, { userId: context.userId, replyId })
    return noStoreJson({ error: "The reply could not be updated." }, { status: 500 })
  }
  if (!visibleReply) return noStoreJson({ error: "That reply is no longer available." }, { status: 404 })

  const mutation = liked
    ? context.admin.from("community_reply_likes").upsert(
        { reply_id: replyId, user_id: context.userId },
        { onConflict: "reply_id,user_id", ignoreDuplicates: true },
      )
    : context.admin
        .from("community_reply_likes")
        .delete()
        .eq("reply_id", replyId)
        .eq("user_id", context.userId)

  const { error: mutationError } = await mutation
  if (mutationError) {
    backendError("community_reply_like_mutation_failed", mutationError, { userId: context.userId, replyId, liked })
    return noStoreJson({ error: "The like could not be updated." }, { status: 500 })
  }

  const { count, error: countError } = await context.admin
    .from("community_reply_likes")
    .select("reply_id", { count: "exact", head: true })
    .eq("reply_id", replyId)

  if (countError) {
    backendError("community_reply_like_count_failed", countError, { userId: context.userId, replyId })
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
