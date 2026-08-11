import { z } from "zod"
import { getCommunityApiContext, noStoreJson } from "@/lib/community/server"
import { backendError } from "@/lib/backend-log"
import { rateLimitResponse, rateLimitUser } from "@/lib/request-protection"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const COMMUNITY_BUCKET = "storytuner-community-audio"
const paramsSchema = z.object({ postId: z.string().uuid() })
type RouteContext = { params: Promise<{ postId: string }> }

type AudioRow = {
  post_id: string
  storage_path: string
  content_type: string
  duration_seconds: number
  status: string
}

export async function GET(_request: Request, routeContext: RouteContext) {
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response
  const limited = rateLimitResponse(rateLimitUser(context.userId, "community_audio_url", [{ limit: 40, windowMs: 60 * 1000, label: "40/min" }]), "Too many audio requests. Wait a moment and try again.")
  if (limited) return limited

  const parsed = paramsSchema.safeParse(await routeContext.params)
  if (!parsed.success) return noStoreJson({ error: "That shared audio could not be found." }, { status: 404 })

  const { data: audio, error } = await context.userClient
    .from("community_audio")
    .select("post_id,storage_path,content_type,duration_seconds,status")
    .eq("post_id", parsed.data.postId)
    .eq("status", "ready")
    .maybeSingle<AudioRow>()

  if (error) {
    backendError("community_audio_lookup_failed", error, { userId: context.userId, postId: parsed.data.postId })
    return noStoreJson({ error: "Shared audio could not be loaded." }, { status: 500 })
  }
  if (!audio) return noStoreJson({ error: "That shared audio is no longer available." }, { status: 404 })

  const { data: signed, error: signError } = await context.admin.storage
    .from(COMMUNITY_BUCKET)
    .createSignedUrl(audio.storage_path, 15 * 60)
  if (signError || !signed?.signedUrl) {
    backendError("community_audio_signing_failed", signError, { userId: context.userId, postId: parsed.data.postId })
    return noStoreJson({ error: "Shared audio could not be played right now." }, { status: 500 })
  }

  return noStoreJson({
    url: signed.signedUrl,
    contentType: audio.content_type,
    durationSeconds: audio.duration_seconds,
    expiresInSeconds: 15 * 60,
  })
}
