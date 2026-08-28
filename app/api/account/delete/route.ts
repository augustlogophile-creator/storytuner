import { z } from "zod"
import { createAccountDeletionCooldown, removeAccountDeletionCooldown } from "@/lib/account-deletion-cooldown"
import { backendError, backendLog } from "@/lib/backend-log"
import { matchesConfiguredOwner } from "@/lib/community/moderation"
import { getAccountRestriction, getAuthenticatedUser } from "@/lib/require-auth"
import { stripeDelete } from "@/lib/stripe-rest"
import { createAdminClient } from "@/lib/supabase/admin"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser, rejectLargeRequest } from "@/lib/request-protection"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const schema = z.object({ confirmation: z.literal("DELETE") }).strict()
const RECORDINGS_BUCKET = "storytuner-recordings"
const COMMUNITY_AUDIO_BUCKET = "storytuner-community-audio"

type SubscriptionRow = { stripe_customer_id: string | null }
type StorageRow = { storage_path: string }

export async function POST(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return Response.json({ error: "Authentication required." }, { status: 401 })

  const restriction = await getAccountRestriction(authenticated.id)
  if (restriction.lookupFailed) {
    return Response.json(
      { code: "ACCOUNT_STATUS_UNAVAILABLE", error: "Tellwise could not verify your account status right now. Try again in a moment." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
  if (restriction.restricted) {
    return Response.json(
      { code: "RESTRICTED_ACCOUNT_DELETE_BLOCKED", error: "A restricted account cannot be self-deleted while its safety record is active. Contact Tellwise support for account-deletion help." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    )
  }

  const oversized = rejectLargeRequest(request, 10_000)
  if (oversized) return oversized
  const rate = rateLimitUser(authenticated.id, "account_delete", [{ limit: 3, windowMs: 60 * 60 * 1000, label: "3/hour" }])
  const blocked = rateLimitResponse(rate, "Too many account-deletion attempts. Wait and try again.")
  if (blocked) return blocked

  const json = await readJsonBody(request, 10_000)
  if (!json.ok) return json.response
  const parsed = schema.safeParse(json.value)
  if (!parsed.success) return Response.json({ error: "Type DELETE to confirm permanent account deletion." }, { status: 400 })

  if (matchesConfiguredOwner(authenticated)) {
    return Response.json({ error: "The Tellwise owner account cannot be deleted from inside the app." }, { status: 403 })
  }

  const { data: verifiedUserData, error: verifiedUserError } = await authenticated.supabase.auth.getUser()
  const verifiedEmail = verifiedUserData.user?.email?.trim() ?? ""
  if (verifiedUserError || !verifiedUserData.user || !verifiedEmail) {
    return Response.json(
      { code: "VERIFIED_EMAIL_REQUIRED", error: "Tellwise could not verify the email on this account, so permanent deletion was stopped for security." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  const admin = createAdminClient()
  let cooldownRecorded = false
  let authDeleted = false
  let reRegistrationAvailableAt = ""

  try {
    // Record the security tombstone before any destructive work. If a later step
    // fails while the auth account still exists, the catch block rolls it back.
    // Once deletion succeeds, the HMAC digest remains for 14 days so the same
    // mailbox cannot immediately recreate a fresh account and bypass safeguards.
    reRegistrationAvailableAt = await createAccountDeletionCooldown(admin, verifiedEmail)
    cooldownRecorded = true

    const [subscriptionResult, recordingsResult, communityAudioResult] = await Promise.all([
      admin.from("subscriptions").select("stripe_customer_id").eq("user_id", authenticated.id).maybeSingle<SubscriptionRow>(),
      admin.from("recording_uploads").select("storage_path").eq("user_id", authenticated.id).returns<StorageRow[]>(),
      admin.from("community_audio").select("storage_path").eq("owner_id", authenticated.id).returns<StorageRow[]>(),
    ])

    if (subscriptionResult.error) throw subscriptionResult.error
    if (recordingsResult.error) throw recordingsResult.error
    if (communityAudioResult.error) throw communityAudioResult.error

    const stripeCustomerId = subscriptionResult.data?.stripe_customer_id?.trim() || ""
    if (stripeCustomerId) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("Tellwise could not safely cancel billing before deleting this account.")
      }
      try {
        await stripeDelete<{ id: string; deleted?: boolean }>(`/customers/${encodeURIComponent(stripeCustomerId)}`)
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : ""
        if (!message.includes("no such customer") && !message.includes("resource_missing")) {
          backendError("account_delete_stripe_failed", error, { userId: authenticated.id })
          throw error
        }
        backendLog("info", "account_delete_stripe_already_removed", { userId: authenticated.id })
      }
    }

    const [recordingFolderPaths, communityFolderPaths] = await Promise.all([
      listUserStoragePaths(admin, RECORDINGS_BUCKET, authenticated.id),
      listUserStoragePaths(admin, COMMUNITY_AUDIO_BUCKET, authenticated.id),
    ])
    const recordingPaths = uniquePaths([
      ...(recordingsResult.data ?? []).map((row) => row.storage_path),
      ...recordingFolderPaths,
    ])
    const communityPaths = uniquePaths([
      ...(communityAudioResult.data ?? []).map((row) => row.storage_path),
      ...communityFolderPaths,
    ])

    if (recordingPaths.length) {
      const { error } = await admin.storage.from(RECORDINGS_BUCKET).remove(recordingPaths)
      if (error) throw error
    }
    if (communityPaths.length) {
      const { error } = await admin.storage.from(COMMUNITY_AUDIO_BUCKET).remove(communityPaths)
      if (error) throw error
    }

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(authenticated.id)
    if (deleteUserError) throw deleteUserError
    authDeleted = true

    backendLog("info", "account_deleted", {
      userId: authenticated.id,
      recordingObjects: recordingPaths.length,
      communityAudioObjects: communityPaths.length,
      stripeCustomerDeleted: Boolean(stripeCustomerId),
      reRegistrationCooldownDays: 14,
    })

    return Response.json(
      { deleted: true, reRegistrationAvailableAt },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    if (cooldownRecorded && !authDeleted) {
      await removeAccountDeletionCooldown(admin, verifiedEmail)
    }
    backendError("account_delete_failed", error, { userId: authenticated.id })
    return Response.json(
      { error: "Tellwise could not completely finish account deletion. Nothing should be retried rapidly. Try once more, then contact support if the problem continues." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}

function uniquePaths(paths: Array<string | null | undefined>) {
  return [...new Set(paths.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
}

async function listUserStoragePaths(admin: ReturnType<typeof createAdminClient>, bucket: string, userId: string) {
  const paths: string[] = []
  for (let offset = 0; offset < 5000; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } })
    if (error) {
      backendError("account_delete_storage_list_failed", error, { userId, bucket, offset })
      throw error
    }
    const rows = data ?? []
    paths.push(...rows.filter((item) => item.id).map((item) => `${userId}/${item.name}`))
    if (rows.length < 1000) break
  }
  return paths
}
