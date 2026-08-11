import { backendError, backendLog } from "@/lib/backend-log"
import { createAdminClient } from "@/lib/supabase/admin"
import { writeVerifiedModerationStatus } from "@/lib/community/moderation-status"

const RECORDINGS_BUCKET = "storytuner-recordings"
const COMMUNITY_BUCKET = "storytuner-community-audio"
const DAY_MS = 24 * 60 * 60 * 1000

type StaleRecording = { id: string; storage_path: string }
type FailedCommunityAudio = { id: string; storage_path: string }
type ModerationStatus = {
  user_id: string
  account_status: "active" | "suspended" | "banned"
  account_suspended_until: string | null
  community_suspended_until: string | null
  public_message: string | null
  internal_note: string | null
  updated_by: string | null
}

export type MaintenanceResult = {
  staleRecordingsRemoved: number
  failedCommunityAudioRemoved: number
  expiredAccountSuspensionsCleared: number
  expiredCommunitySuspensionsCleared: number
}

export async function runStoryTunerMaintenance(): Promise<MaintenanceResult> {
  const admin = createAdminClient()
  const now = new Date()
  const staleCutoff = new Date(now.getTime() - DAY_MS).toISOString()
  const result: MaintenanceResult = {
    staleRecordingsRemoved: 0,
    failedCommunityAudioRemoved: 0,
    expiredAccountSuspensionsCleared: 0,
    expiredCommunitySuspensionsCleared: 0,
  }

  try {
    const { data, error } = await admin
      .from("recording_uploads")
      .select("id,storage_path")
      .in("status", ["uploading", "uploaded", "transcribing", "failed"])
      .lt("updated_at", staleCutoff)
      .limit(500)
      .returns<StaleRecording[]>()
    if (error) throw error
    const rows = data ?? []
    const paths = rows.map((row) => row.storage_path).filter(Boolean)
    if (paths.length) {
      const { error: storageError } = await admin.storage.from(RECORDINGS_BUCKET).remove(paths)
      if (storageError) throw storageError
    }
    if (rows.length) {
      const { error: deleteError } = await admin.from("recording_uploads").delete().in("id", rows.map((row) => row.id))
      if (deleteError) throw deleteError
      result.staleRecordingsRemoved = rows.length
    }
  } catch (error) {
    backendError("maintenance_recording_cleanup_failed", error)
  }

  try {
    const { data, error } = await admin
      .from("community_audio")
      .select("id,storage_path")
      .in("status", ["deleting", "failed"])
      .lt("created_at", staleCutoff)
      .limit(300)
      .returns<FailedCommunityAudio[]>()
    if (error) throw error
    const rows = data ?? []
    const paths = rows.map((row) => row.storage_path).filter(Boolean)
    if (paths.length) {
      const { error: storageError } = await admin.storage.from(COMMUNITY_BUCKET).remove(paths)
      if (storageError) throw storageError
    }
    if (rows.length) {
      const { error: deleteError } = await admin.from("community_audio").delete().in("id", rows.map((row) => row.id))
      if (deleteError) throw deleteError
      result.failedCommunityAudioRemoved = rows.length
    }
  } catch (error) {
    backendError("maintenance_community_audio_cleanup_failed", error)
  }

  try {
    const { data, error } = await admin
      .from("community_moderation_status")
      .select("user_id,account_status,account_suspended_until,community_suspended_until,public_message,internal_note,updated_by")
      .or(`account_suspended_until.lte.${now.toISOString()},community_suspended_until.lte.${now.toISOString()}`)
      .limit(500)
      .returns<ModerationStatus[]>()
    if (error) throw error

    for (const row of data ?? []) {
      const accountExpired = row.account_status === "suspended" && Boolean(row.account_suspended_until) && new Date(row.account_suspended_until!).getTime() <= now.getTime()
      const communityExpired = Boolean(row.community_suspended_until) && new Date(row.community_suspended_until!).getTime() <= now.getTime()
      if (!accountExpired && !communityExpired) continue

      const publicMessage = accountExpired
        ? "Your StoryTuner access has been restored automatically because the suspension ended."
        : "Your Community access has been restored automatically because the suspension ended."
      await writeVerifiedModerationStatus(admin, row.user_id, {
        accountStatus: accountExpired ? "active" : row.account_status,
        accountSuspendedUntil: accountExpired ? null : row.account_suspended_until,
        communitySuspendedUntil: communityExpired ? null : row.community_suspended_until,
        publicMessage,
        internalNote: accountExpired ? "Account suspension expired automatically" : "Community suspension expired automatically",
        updatedBy: null,
      })
      const { error: actionError } = await admin.from("community_moderation_actions").insert({
        user_id: row.user_id,
        moderator_id: null,
        report_id: null,
        action_type: "restriction_cleared",
        duration_days: null,
        note: accountExpired ? "Account suspension expired automatically" : "Community suspension expired automatically",
      })
      if (actionError) backendError("maintenance_moderation_audit_failed", actionError, { userId: row.user_id })
      if (accountExpired) result.expiredAccountSuspensionsCleared += 1
      if (communityExpired) result.expiredCommunitySuspensionsCleared += 1
    }
  } catch (error) {
    backendError("maintenance_moderation_expiration_failed", error)
  }

  backendLog("info", "maintenance_completed", result)
  return result
}
