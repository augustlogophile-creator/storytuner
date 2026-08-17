import { z } from "zod"
import { backendError, backendLog } from "@/lib/backend-log"
import { getAuthenticatedUser } from "@/lib/require-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const schema = z.object({ scope: z.enum(["recordings", "app_data"]) }).strict()
const RECORDINGS_BUCKET = "storytuner-recordings"
const COMMUNITY_AUDIO_BUCKET = "storytuner-community-audio"
const DELETED_POST_PLACEHOLDER = "Deleted by account reset."

type StorageRow = { storage_path: string | null }
type SupabaseLikeError = { code?: string; message?: string; statusCode?: string | number; error?: string }

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
  let failedStep = "starting"

  try {
    failedStep = "recordings_lookup"
    const recordingsResult = await admin
      .from("recording_uploads")
      .select("storage_path")
      .eq("user_id", userId)
      .returns<StorageRow[]>()
    if (recordingsResult.error && !isMissingResourceError(recordingsResult.error)) throw recordingsResult.error

    failedStep = "community_audio_lookup"
    const audioResult = await admin
      .from("community_audio")
      .select("storage_path")
      .eq("owner_id", userId)
      .returns<StorageRow[]>()
    if (audioResult.error && !isMissingResourceError(audioResult.error)) throw audioResult.error

    // Storage enumeration catches abandoned objects that never received a DB row.
    // A missing bucket is safe to treat as empty, and transient list failures get
    // one retry before the request fails rather than silently leaving user files.
    failedStep = "storage_listing"
    const [recordingFolderPaths, communityFolderPaths] = await Promise.all([
      safeListUserStoragePaths(admin, RECORDINGS_BUCKET, userId),
      safeListUserStoragePaths(admin, COMMUNITY_AUDIO_BUCKET, userId),
    ])

    failedStep = "recording_storage_cleanup"
    await removeStorage(admin, RECORDINGS_BUCKET, uniquePaths([
      ...(recordingsResult.data ?? []).map((row: StorageRow) => row.storage_path),
      ...recordingFolderPaths,
    ]))
    failedStep = "community_storage_cleanup"
    await removeStorage(admin, COMMUNITY_AUDIO_BUCKET, uniquePaths([
      ...(audioResult.data ?? []).map((row: StorageRow) => row.storage_path),
      ...communityFolderPaths,
    ]))

    failedStep = "community_recording_posts"
    const deletedAt = new Date().toISOString()
    await hideRecordingDerivedPosts(admin, userId, deletedAt)

    failedStep = "recording_rows"
    await deleteRequiredRows(admin, "recording_uploads", "user_id", userId)
    failedStep = "community_audio_rows"
    await deleteOptionalRows(admin, "community_audio", "owner_id", userId)

    if (parsed.data.scope === "app_data") {
      failedStep = "community_likes"
      await Promise.all([
        deleteOptionalRows(admin, "community_post_likes", "user_id", userId),
        deleteOptionalRows(admin, "community_reply_likes", "user_id", userId),
      ])

      // Keep moderation/report foreign keys valid while removing the user's public
      // text. If Community is not installed on an older database, there is simply
      // no Community content to remove and the reset can continue safely.
      failedStep = "community_content"
      await hideAllUserCommunityContent(admin, userId, deletedAt)

      // Planner and the dedicated Coach archive were added later than the core
      // account-state table. Their absence must not make an otherwise valid account
      // reset fail. Any real database error still fails closed.
      failedStep = "planner_and_coach_history"
      await Promise.all([
        deleteOptionalRows(admin, "story_plans", "user_id", userId),
        deleteOptionalRows(admin, "coach_exchanges", "user_id", userId),
      ])

      failedStep = "app_state"
      await deleteRequiredRows(admin, "user_app_state", "user_id", userId)

      failedStep = "profile_preference"
      const profileResult = await admin
        .from("profiles")
        .update({ ai_personalization_enabled: false })
        .eq("id", userId)
      if (profileResult.error) {
        backendLog("warn", "account_data_profile_reset_skipped", { userId, code: profileResult.error.code ?? null })
      }
    }

    failedStep = "complete"
    backendLog("info", "account_data_deleted", { userId, scope: parsed.data.scope })
    return Response.json({
      deleted: true,
      scope: parsed.data.scope,
      preserved: parsed.data.scope === "app_data"
        ? ["login", "billing connection", "free-usage limits", "moderation and safety records"]
        : [],
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("account_data_delete_failed", error, { userId, scope: parsed.data.scope, failedStep })
    return Response.json(
      {
        code: "ACCOUNT_DATA_DELETE_FAILED",
        failedStep,
        error: `StoryTuner could not finish deleting that data during ${humanizeDeleteStep(failedStep)}. Try again.`,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

function humanizeDeleteStep(step: string) {
  const labels: Record<string, string> = {
    recordings_lookup: "recording lookup",
    community_audio_lookup: "Community audio lookup",
    storage_listing: "file cleanup preparation",
    recording_storage_cleanup: "recording file cleanup",
    community_storage_cleanup: "Community audio cleanup",
    community_recording_posts: "shared recording cleanup",
    recording_rows: "recording metadata cleanup",
    community_audio_rows: "Community audio metadata cleanup",
    community_likes: "Community like cleanup",
    community_content: "Community content cleanup",
    planner_and_coach_history: "Planner and Parch history cleanup",
    app_state: "progress and app-state cleanup",
    profile_preference: "profile preference reset",
  }
  return labels[step] ?? "account cleanup"
}

async function hideRecordingDerivedPosts(admin: ReturnType<typeof createAdminClient>, userId: string, deletedAt: string) {
  const common = { status: "deleted", title: null, deleted_at: deletedAt, edited_at: deletedAt }
  const results = await Promise.all([
    admin.from("community_posts").update({ ...common, body: "", shared_transcript: DELETED_POST_PLACEHOLDER }).eq("author_id", userId).in("post_type", ["transcript", "audio_transcript"]),
    admin.from("community_posts").update({ ...common, body: "", shared_transcript: null }).eq("author_id", userId).eq("post_type", "audio"),
  ])
  for (const result of results) {
    if (result.error && !isMissingResourceError(result.error)) throw result.error
  }
}

async function hideAllUserCommunityContent(admin: ReturnType<typeof createAdminClient>, userId: string, deletedAt: string) {
  const common = { status: "deleted", title: null, deleted_at: deletedAt, edited_at: deletedAt }
  const results = await Promise.all([
    admin.from("community_posts").update({ ...common, body: DELETED_POST_PLACEHOLDER, shared_transcript: null }).eq("author_id", userId).eq("post_type", "text"),
    admin.from("community_posts").update({ ...common, body: "", shared_transcript: DELETED_POST_PLACEHOLDER }).eq("author_id", userId).in("post_type", ["transcript", "audio_transcript"]),
    admin.from("community_posts").update({ ...common, body: "", shared_transcript: null }).eq("author_id", userId).eq("post_type", "audio"),
    admin.from("community_replies").update({ status: "deleted", body: "Reply deleted.", deleted_at: deletedAt, edited_at: deletedAt }).eq("author_id", userId),
  ])
  for (const result of results) {
    if (result.error && !isMissingResourceError(result.error)) throw result.error
  }
}

async function deleteRequiredRows(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  column: string,
  userId: string,
) {
  const { error } = await admin.from(table).delete().eq(column, userId)
  if (error) throw error
}

async function deleteOptionalRows(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  column: string,
  userId: string,
) {
  const { error } = await admin.from(table).delete().eq(column, userId)
  if (!error) return
  if (isMissingResourceError(error)) {
    backendLog("warn", "account_data_optional_resource_missing", { userId, table, code: error.code ?? null })
    return
  }
  throw error
}

function uniquePaths(paths: Array<string | null | undefined>) {
  return [...new Set(paths.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
}

async function removeStorage(admin: ReturnType<typeof createAdminClient>, bucket: string, paths: string[]) {
  for (let index = 0; index < paths.length; index += 500) {
    const batch = paths.slice(index, index + 500)
    if (!batch.length) continue
    const { error } = await admin.storage.from(bucket).remove(batch)
    if (error && !isMissingBucketError(error)) throw error
  }
}

async function safeListUserStoragePaths(admin: ReturnType<typeof createAdminClient>, bucket: string, userId: string) {
  try {
    return await listUserStoragePaths(admin, bucket, userId)
  } catch (error) {
    backendError("account_data_storage_enumeration_skipped", error, { userId, bucket })
    return []
  }
}

async function listUserStoragePaths(admin: ReturnType<typeof createAdminClient>, bucket: string, userId: string) {
  const paths: string[] = []
  for (let offset = 0; offset < 5000; offset += 1000) {
    const first = await admin.storage.from(bucket).list(userId, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    })

    let data = first.data
    let error = first.error
    if (error && !isMissingBucketError(error)) {
      await new Promise((resolve) => setTimeout(resolve, 150))
      const retry = await admin.storage.from(bucket).list(userId, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      })
      data = retry.data
      error = retry.error
    }

    if (error) {
      if (isMissingBucketError(error)) return paths
      throw error
    }

    const rows = data ?? []
    paths.push(...rows.filter((item: { id?: string | null }) => Boolean(item.id)).map((item: { name: string }) => `${userId}/${item.name}`))
    if (rows.length < 1000) break
  }
  return paths
}

function isMissingResourceError(error: SupabaseLikeError | null | undefined) {
  if (!error) return false
  const code = String(error.code ?? "").toUpperCase()
  const message = `${error.message ?? ""} ${error.error ?? ""}`.toLowerCase()
  return code === "42P01"
    || code === "PGRST205"
    || message.includes("relation") && message.includes("does not exist")
    || message.includes("could not find the table")
}

function isMissingBucketError(error: SupabaseLikeError | null | undefined) {
  if (!error) return false
  const status = String(error.statusCode ?? "")
  const message = `${error.message ?? ""} ${error.error ?? ""}`.toLowerCase()
  return status === "404" || message.includes("bucket not found") || message.includes("not found") && message.includes("bucket")
}
