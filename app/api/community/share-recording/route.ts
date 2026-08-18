import { z } from "zod"
import { getCommunityApiContext, noStoreJson } from "@/lib/community/server"
import type { CommunityFeedPost, CommunityPostType } from "@/lib/community/types"
import { COMMUNITY_AI_HOLD_MESSAGE, createAiModerationReport, moderateCommunityText } from "@/lib/community/ai-moderation"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser, rejectLargeRequest } from "@/lib/request-protection"
import { backendError } from "@/lib/backend-log"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SOURCE_BUCKET = "storytuner-recordings"
const COMMUNITY_BUCKET = "storytuner-community-audio"
const MAX_COMMUNITY_AUDIO_BYTES = 24 * 1024 * 1024
const MAX_COMMUNITY_AUDIO_SECONDS = 1800

const schema = z.object({
  mode: z.enum(["transcript", "audio"]),
  recordingId: z.string().uuid().nullable().optional(),
  title: z.string().trim().max(120).optional().default(""),
  transcript: z.string().trim().max(30000).optional().default(""),
  message: z.string().trim().max(1000).optional().default(""),
}).strict()

type RecordingRow = {
  id: string
  user_id: string
  storage_path: string
  content_type: string
  size_bytes: number
  duration_seconds: number
  status: string
  transcript: string | null
  title: string | null
}

type InsertedPost = { id: string; created_at: string }

export async function POST(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite
  const context = await getCommunityApiContext()
  if (!context.ok) return context.response
  const oversized = rejectLargeRequest(request, 40_000)
  if (oversized) return oversized
  const blocked = rateLimitResponse(rateLimitUser(context.userId, "community_recording_share", [
    { limit: 6, windowMs: 10 * 60 * 1000, label: "6/10min" },
  ]), "You have shared several stories recently. Wait a few minutes before sharing again.")
  if (blocked) return blocked

  let uploadedCommunityPath: string | null = null
  let createdPostId: string | null = null

  try {
    const json = await readJsonBody(request, 40_000)
    if (!json.ok) return json.response
    const parsed = schema.safeParse(json.value)
    if (!parsed.success) {
      return noStoreJson({ error: parsed.error.issues[0]?.message ?? "That recording cannot be shared." }, { status: 400 })
    }

    const { mode } = parsed.data
    const needsAudio = mode === "audio"
    const includesTranscript = mode === "transcript"

    let source: RecordingRow | null = null
    if (parsed.data.recordingId) {
      const { data, error } = await context.admin
        .from("recording_uploads")
        .select("id,user_id,storage_path,content_type,size_bytes,duration_seconds,status,transcript,title")
        .eq("id", parsed.data.recordingId)
        .eq("user_id", context.userId)
        .maybeSingle<RecordingRow>()
      if (error) throw error
      source = data
    }

    if (needsAudio && (!source || source.status !== "ready")) {
      return noStoreJson({ error: "Audio sharing is available only for a finished private recording." }, { status: 400 })
    }

    if (source && source.status !== "ready") {
      return noStoreJson({ error: "This recording is still processing. Try sharing it after transcription finishes." }, { status: 400 })
    }

    if (needsAudio && source) {
      if (source.duration_seconds > MAX_COMMUNITY_AUDIO_SECONDS) {
        return noStoreJson({ error: "Community audio can be at most 30 minutes. You can still share the transcript." }, { status: 400 })
      }
      if (source.size_bytes > MAX_COMMUNITY_AUDIO_BYTES) {
        return noStoreJson({ error: "This audio file is too large for Community. You can still share the transcript." }, { status: 400 })
      }
    }

    const trustedSourceTranscript = source?.transcript?.trim() || ""
    if (needsAudio && !trustedSourceTranscript) {
      return noStoreJson({ error: "Audio sharing requires the server-saved transcript so Tellwise can run its safety check." }, { status: 400 })
    }
    const transcript = (trustedSourceTranscript || parsed.data.transcript).trim()
    if (!transcript) {
      return noStoreJson({ error: "This recording needs a transcript before it can be shared." }, { status: 400 })
    }

    // Every share is screened using the story transcript plus the optional
    // public message. Audio-only shares still keep the transcript private.
    const publicMessage = parsed.data.message.trim()
    const moderationInput = publicMessage ? `${transcript}\n\nMember message: ${publicMessage}` : transcript
    let moderation
    try {
      moderation = await moderateCommunityText(moderationInput)
    } catch (error) {
      backendError("community_recording_moderation_unavailable", error, { userId: context.userId })
      return noStoreJson({ error: "Community safety checks are temporarily unavailable. Try again in a moment." }, { status: 503 })
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count, error: countError } = await context.admin
      .from("community_posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", context.userId)
      .gte("created_at", tenMinutesAgo)
    if (countError) throw countError
    if ((count ?? 0) >= 5) {
      return noStoreJson({ error: "You have shared several posts recently. Wait a few minutes before sharing again." }, { status: 429 })
    }

    const postType = mode as CommunityPostType
    const title = (source?.title || parsed.data.title).trim().slice(0, 120) || null
    const { data: post, error: postError } = await context.admin
      .from("community_posts")
      .insert({
        author_id: context.userId,
        post_type: postType,
        title,
        body: publicMessage,
        shared_transcript: includesTranscript ? transcript : null,
        status: moderation.flagged ? "removed" : "active",
      })
      .select("id,created_at")
      .single<InsertedPost>()
    if (postError) throw postError
    createdPostId = post.id

    if (needsAudio && source) {
      const extension = extensionFor(source.content_type)
      const communityPath = `${context.userId}/${post.id}.${extension}`
      const { data: sourceBlob, error: downloadError } = await context.admin.storage
        .from(SOURCE_BUCKET)
        .download(source.storage_path)
      if (downloadError || !sourceBlob) throw new Error(downloadError?.message || "The private audio could not be read.")

      const bytes = await sourceBlob.arrayBuffer()
      if (bytes.byteLength <= 0 || bytes.byteLength > MAX_COMMUNITY_AUDIO_BYTES) {
        throw new Error("The audio file is not eligible for Community sharing.")
      }

      const { error: uploadError } = await context.admin.storage
        .from(COMMUNITY_BUCKET)
        .upload(communityPath, bytes, {
          contentType: normalizeAudioContentType(source.content_type),
          cacheControl: "3600",
          upsert: false,
        })
      if (uploadError) throw new Error(uploadError.message)
      uploadedCommunityPath = communityPath

      const { error: audioRowError } = await context.admin.from("community_audio").insert({
        post_id: post.id,
        owner_id: context.userId,
        source_recording_id: source.id,
        storage_path: communityPath,
        content_type: normalizeAudioContentType(source.content_type),
        size_bytes: bytes.byteLength,
        duration_seconds: source.duration_seconds,
        status: "ready",
      })
      if (audioRowError) throw audioRowError
    }

    if (moderation.flagged) {
      try {
        await createAiModerationReport({
          admin: context.admin,
          userId: context.userId,
          postId: post.id,
          moderation,
        })
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : "The safety review could not be saved.")
      }
      return noStoreJson({ heldForReview: true, message: COMMUNITY_AI_HOLD_MESSAGE }, { status: 202 })
    }

    const responsePost: CommunityFeedPost = {
      id: post.id,
      postType,
      title,
      body: publicMessage,
      sharedTranscript: includesTranscript ? transcript : null,
      hasAudio: needsAudio,
      audioDurationSeconds: needsAudio && source ? source.duration_seconds : null,
      createdAt: post.created_at,
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

    return noStoreJson({ post: responsePost }, { status: 201 })
  } catch (error) {
    backendError("community_recording_share_failed", error, { userId: context.userId })
    if (uploadedCommunityPath) {
      await context.admin.storage.from(COMMUNITY_BUCKET).remove([uploadedCommunityPath]).catch(() => undefined)
    }
    if (createdPostId) {
      await context.admin.from("community_posts").delete().eq("id", createdPostId)
    }
    return noStoreJson({ error: "This recording could not be shared to Community." }, { status: 500 })
  }
}


function normalizeAudioContentType(value: string) {
  const base = value.split(";")[0]?.trim().toLowerCase()
  if (["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav"].includes(base)) return base
  return "audio/webm"
}

function extensionFor(value: string) {
  const type = normalizeAudioContentType(value)
  if (type === "audio/ogg") return "ogg"
  if (type === "audio/mpeg") return "mp3"
  if (type === "audio/mp4") return "m4a"
  if (type === "audio/wav" || type === "audio/x-wav") return "wav"
  return "webm"
}
