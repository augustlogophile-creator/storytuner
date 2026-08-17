import { z } from "zod"
import { backendError } from "@/lib/backend-log"
import { getCommunityApiContext, noStoreJson } from "@/lib/community/server"
import { readJsonBody, rejectLargeRequest, requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ userId: z.string().uuid() }).strict()

export async function POST(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite

  const context = await getCommunityApiContext()
  if (!context.ok) return context.response

  const limited = rateLimitResponse(
    rateLimitUser(context.userId, "community_block", [{ limit: 30, windowMs: 60 * 60 * 1000, label: "30/hour" }]),
    "Too many block changes. Wait a while and try again.",
  )
  if (limited) return limited

  const oversized = rejectLargeRequest(request, 5_000)
  if (oversized) return oversized
  const body = await readJsonBody(request, 5_000)
  if (!body.ok) return body.response
  const parsed = schema.safeParse(body.value)
  if (!parsed.success) return noStoreJson({ error: "Choose a valid Community member." }, { status: 400 })
  if (parsed.data.userId === context.userId) return noStoreJson({ error: "You cannot block yourself." }, { status: 400 })

  try {
    const { error } = await context.admin.from("community_user_blocks").upsert({
      blocker_id: context.userId,
      blocked_id: parsed.data.userId,
    }, { onConflict: "blocker_id,blocked_id" })
    if (error) throw error
    return noStoreJson({ blocked: true })
  } catch (error) {
    backendError("community_block_create_failed", error, { userId: context.userId, blockedId: parsed.data.userId })
    return noStoreJson({ error: "The member could not be blocked right now." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite

  const context = await getCommunityApiContext()
  if (!context.ok) return context.response

  const oversized = rejectLargeRequest(request, 5_000)
  if (oversized) return oversized
  const body = await readJsonBody(request, 5_000)
  if (!body.ok) return body.response
  const parsed = schema.safeParse(body.value)
  if (!parsed.success) return noStoreJson({ error: "Choose a valid Community member." }, { status: 400 })

  try {
    const { error } = await context.admin
      .from("community_user_blocks")
      .delete()
      .eq("blocker_id", context.userId)
      .eq("blocked_id", parsed.data.userId)
    if (error) throw error
    return noStoreJson({ blocked: false })
  } catch (error) {
    backendError("community_block_delete_failed", error, { userId: context.userId, blockedId: parsed.data.userId })
    return noStoreJson({ error: "The member could not be unblocked right now." }, { status: 500 })
  }
}
