import { z } from "zod"
import { backendError, backendLog } from "@/lib/backend-log"
import { getAuthenticatedUser } from "@/lib/require-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const schema = z.object({ scope: z.enum(["recordings", "app_data"]) })
const RECORDINGS_BUCKET = "storytuner-recordings"
const COMMUNITY_AUDIO_BUCKET = "storytuner-community-audio"
const DELETED_POST_PLACEHOLDER = "Deleted by account reset."

type StorageRow = { storage_path: string | null }

export async function POST(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite

  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return Response.json({ error: "Authentication required." }, { status: 401 })

  const blocked = rateLimitResponse(
    rateLimitUser(authenticated.id, "account_data_delete", [{ limit: 5, windowMs: 60 * 60 * 1000, label: "5/hour" }]),
    "Too many data-deletion attempts. Wait and try again.",
  )
  if (blocked) return blocked

  const json = await readJsonBody(request, 5_000)
  if (!json.ok) return json.response
  const parsed = schema.safeParse(json.value)
  if (!parsed.success) return Response.json({ error: "Choose which StoryTuner data to delete." }, { status: 400 })

  const admin = createAdminClient()
  const userId = authenticated.id

  try {
    const [recordingsResult, audioResult] = await Promise.all([
      admin.from("recording_uploads").select("storage_path").eq("user_id", userId).returns<StorageRow[]>(),
      admin.from("community_audio").select("storage_path").eq("owner_id", userId).returns<StorageRow[]>(),
    ])
    if (recordingsResult.error) throw recordingsResult.error
    if (audioResult.error) throw audioResult.error

    const [recordingFolderPaths, communityFolderPaths] = await Promise.all([
      listUserStoragePaths(admin, RECORDINGS_BUCKET, userId),
      listUserStoragePaths(admin, COMMUNITY_AUDIO_BUCKET, userId),
    ])
    await removeStorage(admin, RECORDINGS_BUCKET, uniquePaths([
      ...(recordingsResult.data ?? []).map((row: StorageRow) => row.storage_path),
      ...recordingFolderPaths,
    ]))
    await removeStorage(admin, COMMUNITY_AUDIO_BUCKET, uniquePaths([
      ...(audioResult.data ?? []).map((row: StorageRow) => row.storage_path),
      ...communityFolderPaths,
    ]))

    const deletedAt = new Date().toISOString()
    await hideRecordingDerivedPosts(admin, userId, deletedAt)

    const { error: recordingsDeleteError } = await admin.from("recording_uploads").delete().eq("user_id", userId)
    if (recordingsDeleteError) throw recordingsDeleteError
    const { error: audioDeleteError } = await admin.from("community_audio").delete().eq("owner_id", userId)
    if (audioDeleteError) throw audioDeleteError

    if (parsed.data.scope === "app_data") {
      const likeResults = await Promise.all([
        admin.from("community_post_likes").delete().eq("user_id", userId),
        admin.from("community_reply_likes").delete().eq("user_id", userId),
      ])
      const failedLikeDelete = likeResults.find((result: { error: unknown }) => result.error)
      if (failedLikeDelete?.error) throw failedLikeDelete.error

      // Keep safety/audit foreign keys valid while removing the user's public
      // text. The hidden placeholder rows can later be purged only when they
      // are not referenced by a report.
      await hideAllUserCommunityContent(admin, userId, deletedAt)

      const results = await Promise.all([
        admin.from("story_plans").delete().eq("user_id", userId),
        admin.from("coach_exchanges").delete().eq("user_id", userId),
        admin.from("user_app_state").delete().eq("user_id", userId),
        admin.from("profiles").update({ ai_personalization_enabled: false }).eq("id", userId),
      ])
      const failed = results.find((result: { error: unknown }) => result.error)
      if (failed?.error) throw failed.error
    }

    backendLog("info", "account_data_deleted", { userId, scope: parsed.data.scope })
    return Response.json({
      deleted: true,
      scope: parsed.data.scope,
      preserved: parsed.data.scope === "app_data"
        ? ["login", "billing connection", "free-usage limits", "moderation and safety records"]
        : [],
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("account_data_delete_failed", error, { userId, scope: parsed.data.scope })
    return Response.json({ error: "StoryTuner could not finish deleting that data. Try again." }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}

async function hideRecordingDerivedPosts(admin: ReturnType<typeof createAdminClient>, userId: string, deletedAt: string) {
  const common = { status: "deleted", title: null, deleted_at: deletedAt, edited_at: deletedAt }
  const updates = [
    admin.from("community_posts").update({ ...common, body: "", shared_transcript: DELETED_POST_PLACEHOLDER }).eq("author_id", userId).in("post_type", ["transcript", "audio_transcript"]),
    admin.from("community_posts").update({ ...common, body: "", shared_transcript: null }).eq("author_id", userId).eq("post_type", "audio"),
  ]
  const results = await Promise.all(updates)
  const failed = results.find((result: { error: unknown }) => result.error)
  if (failed?.error) throw failed.error
}

async function hideAllUserCommunityContent(admin: ReturnType<typeof createAdminClient>, userId: string, deletedAt: string) {
  const common = { status: "deleted", title: null, deleted_at: deletedAt, edited_at: deletedAt }
  const results = await Promise.all([
    admin.from("community_posts").update({ ...common, body: DELETED_POST_PLACEHOLDER, shared_transcript: null }).eq("author_id", userId).eq("post_type", "text"),
    admin.from("community_posts").update({ ...common, body: "", shared_transcript: DELETED_POST_PLACEHOLDER }).eq("author_id", userId).in("post_type", ["transcript", "audio_transcript"]),
    admin.from("community_posts").update({ ...common, body: "", shared_transcript: null }).eq("author_id", userId).eq("post_type", "audio"),
    admin.from("community_replies").update({ status: "deleted", body: "Reply deleted.", deleted_at: deletedAt, edited_at: deletedAt }).eq("author_id", userId),
  ])
  const failed = results.find((result: { error: unknown }) => result.error)
  if (failed?.error) throw failed.error
}

function uniquePaths(paths: Array<string | null | undefined>) {
  return [...new Set(paths.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
}

async function removeStorage(admin: ReturnType<typeof createAdminClient>, bucket: string, paths: string[]) {
  for (let index = 0; index < paths.length; index += 500) {
    const batch = paths.slice(index, index + 500)
    if (!batch.length) continue
    const { error } = await admin.storage.from(bucket).remove(batch)
    if (error) throw error
  }
}

async function listUserStoragePaths(admin: ReturnType<typeof createAdminClient>, bucket: string, userId: string) {
  const paths: string[] = []
  for (let offset = 0; offset < 5000; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(userId, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    })
    if (error) throw error
    const rows = data ?? []
    paths.push(...rows.filter((item: { id?: string | null }) => Boolean(item.id)).map((item: { name: string }) => `${userId}/${item.name}`))
    if (rows.length < 1000) break
  }
  return paths
}
