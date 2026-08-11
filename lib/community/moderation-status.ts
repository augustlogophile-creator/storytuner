import type { SupabaseClient } from "@supabase/supabase-js"
import { backendError, backendLog } from "@/lib/backend-log"

export type ModerationStatusRow = {
  user_id: string
  account_status: "active" | "suspended" | "banned"
  account_suspended_until: string | null
  community_suspended_until: string | null
  public_message: string | null
  internal_note: string | null
  updated_by: string | null
  updated_at: string
}

type StatusWrite = {
  accountStatus: "active" | "suspended" | "banned"
  accountSuspendedUntil: string | null
  communitySuspendedUntil: string | null
  publicMessage: string | null
  internalNote: string | null
  updatedBy: string | null
}

export async function writeVerifiedModerationStatus(
  admin: SupabaseClient,
  userId: string,
  next: StatusWrite,
): Promise<ModerationStatusRow> {
  const payload = {
    user_id: userId,
    account_status: next.accountStatus,
    account_suspended_until: next.accountSuspendedUntil,
    community_suspended_until: next.communitySuspendedUntil,
    public_message: next.publicMessage,
    internal_note: next.internalNote,
    updated_by: next.updatedBy,
  }

  const write = async () => {
    const { error } = await admin.from("community_moderation_status").upsert(payload, { onConflict: "user_id" })
    if (error) throw error
    const { data, error: readError } = await admin
      .from("community_moderation_status")
      .select("user_id,account_status,account_suspended_until,community_suspended_until,public_message,internal_note,updated_by,updated_at")
      .eq("user_id", userId)
      .single<ModerationStatusRow>()
    if (readError || !data) throw readError || new Error("Moderation status could not be verified after saving.")
    return data
  }

  let row = await write()
  if (!matches(row, payload)) {
    backendLog("warn", "moderation_status_verify_retry", { userId })
    row = await write()
  }
  if (!matches(row, payload)) {
    const error = new Error("Moderation status did not match the saved decision after verification.")
    backendError("moderation_status_verify_failed", error, { userId, expected: payload, actual: row })
    throw error
  }
  backendLog("info", "moderation_status_saved", {
    userId,
    accountStatus: row.account_status,
    accountSuspendedUntil: row.account_suspended_until,
    communitySuspendedUntil: row.community_suspended_until,
  })
  return row
}

function matches(row: ModerationStatusRow, payload: Record<string, unknown>) {
  return row.account_status === payload.account_status
    && normalize(row.account_suspended_until) === normalize(payload.account_suspended_until)
    && normalize(row.community_suspended_until) === normalize(payload.community_suspended_until)
    && (row.public_message ?? null) === (payload.public_message ?? null)
    && (row.internal_note ?? null) === (payload.internal_note ?? null)
    && (row.updated_by ?? null) === (payload.updated_by ?? null)
}

function normalize(value: unknown) {
  if (!value) return null
  const timestamp = new Date(String(value)).getTime()
  return Number.isFinite(timestamp) ? timestamp : String(value)
}
