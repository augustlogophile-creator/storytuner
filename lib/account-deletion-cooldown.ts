import "server-only"
import { createHmac } from "node:crypto"
import { backendError, backendLog } from "@/lib/backend-log"
import type { createAdminClient } from "@/lib/supabase/admin"

export const ACCOUNT_DELETION_COOLDOWN_DAYS = 14
const COOLDOWN_MS = ACCOUNT_DELETION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000

type AdminClient = ReturnType<typeof createAdminClient>

type CooldownRow = {
  email_hash: string
  deleted_at: string
  eligible_at: string
}

export type AccountDeletionCooldown = {
  eligibleAt: string
  remainingDays: number
}

function normalizedAccountEmail(email: string) {
  const clean = email.trim().toLowerCase()
  const at = clean.lastIndexOf("@")
  if (at <= 0) return clean

  let local = clean.slice(0, at)
  let domain = clean.slice(at + 1)

  // Google treats dots and +tags as aliases for the same Gmail mailbox. Canonicalizing
  // them prevents someone from bypassing a deletion cooldown with an equivalent alias.
  if (domain === "gmail.com" || domain === "googlemail.com") {
    domain = "gmail.com"
    local = local.split("+")[0]?.replaceAll(".", "") ?? local
  }

  return `${local}@${domain}`
}

function cooldownSecret() {
  const explicit = process.env.ACCOUNT_DELETION_COOLDOWN_SECRET?.trim()
  if (explicit) return explicit

  // The service-role key is already server-only and high entropy. Use it as a
  // deterministic fallback so the protection is active immediately, while still
  // allowing deployments to rotate this concern onto its own secret.
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!fallback) throw new Error("Account deletion cooldown hashing is unavailable.")
  return fallback
}

function emailHash(email: string) {
  return createHmac("sha256", cooldownSecret())
    .update(normalizedAccountEmail(email))
    .digest("hex")
}

export async function createAccountDeletionCooldown(admin: AdminClient, email: string) {
  const hash = emailHash(email)
  const deletedAt = new Date()
  const eligibleAt = new Date(deletedAt.getTime() + COOLDOWN_MS)

  const { error } = await admin.from("account_deletion_cooldowns").upsert({
    email_hash: hash,
    deleted_at: deletedAt.toISOString(),
    eligible_at: eligibleAt.toISOString(),
  }, { onConflict: "email_hash" })

  if (error) {
    backendError("account_deletion_cooldown_create_failed", error, {})
    throw error
  }

  return eligibleAt.toISOString()
}

export async function removeAccountDeletionCooldown(admin: AdminClient, email: string) {
  const hash = emailHash(email)
  const { error } = await admin
    .from("account_deletion_cooldowns")
    .delete()
    .eq("email_hash", hash)

  if (error) backendError("account_deletion_cooldown_rollback_failed", error, {})
}

export async function getAccountDeletionCooldown(admin: AdminClient, email: string): Promise<AccountDeletionCooldown | null> {
  if (!email.trim()) return null
  const hash = emailHash(email)
  const { data, error } = await admin
    .from("account_deletion_cooldowns")
    .select("email_hash, deleted_at, eligible_at")
    .eq("email_hash", hash)
    .maybeSingle<CooldownRow>()

  if (error) {
    backendError("account_deletion_cooldown_lookup_failed", error, {})
    throw error
  }
  if (!data) return null

  const eligibleTime = new Date(data.eligible_at).getTime()
  if (!Number.isFinite(eligibleTime)) {
    backendLog("warn", "account_deletion_cooldown_invalid_timestamp", {})
    throw new Error("Account deletion cooldown data is invalid.")
  }

  const remainingMs = eligibleTime - Date.now()
  if (remainingMs <= 0) {
    const { error: cleanupError } = await admin
      .from("account_deletion_cooldowns")
      .delete()
      .eq("email_hash", hash)
    if (cleanupError) backendError("account_deletion_cooldown_cleanup_failed", cleanupError, {})
    return null
  }

  return {
    eligibleAt: data.eligible_at,
    remainingDays: Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))),
  }
}

export function accountDeletionCooldownMessage(cooldown: AccountDeletionCooldown) {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(cooldown.eligibleAt))

  return `This email was recently used for a deleted Tellwise account. For security, it can create a new account again on ${date} (${cooldown.remainingDays} day${cooldown.remainingDays === 1 ? "" : "s"} remaining). The deleted account and its data cannot be restored.`
}
