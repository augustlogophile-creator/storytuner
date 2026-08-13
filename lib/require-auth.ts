import { redirect } from "next/navigation"
import { safeInternalPath } from "@/lib/auth/redirects"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { writeVerifiedModerationStatus } from "@/lib/community/moderation-status"
import { backendError } from "@/lib/backend-log"

export type StoryTunerProfile = {
  id: string
  username: string
  display_name: string
  confirmed_age_13_plus: boolean
  onboarding_completed: boolean
}

export type AccountRestriction = {
  restricted: boolean
  accountStatus: "active" | "suspended" | "banned"
  accountSuspendedUntil: string | null
  communitySuspendedUntil: string | null
  publicMessage: string | null
  updatedAt: string | null
  lookupFailed: boolean
}

export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims ?? null
  const userId = typeof claims?.sub === "string" ? claims.sub : null
  if (error || !userId || !claims) return null
  return { id: userId, claims, supabase }
}


export async function getActiveAuthenticatedUser() {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) {
    return { ok: false as const, response: Response.json({ error: "Authentication required." }, { status: 401 }) }
  }
  const restriction = await getAccountRestriction(authenticated.id)
  if (restriction.lookupFailed) {
    return {
      ok: false as const,
      response: Response.json(
        { code: "ACCOUNT_STATUS_UNAVAILABLE", error: "StoryTuner could not verify your account status right now. Try again in a moment." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      ),
    }
  }
  if (restriction.restricted) {
    return {
      ok: false as const,
      response: Response.json({ error: restriction.publicMessage || "This account is currently restricted." }, { status: 403 }),
    }
  }
  return { ok: true as const, user: authenticated }
}

export async function getAccountRestriction(userId: string): Promise<AccountRestriction> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("community_moderation_status")
    .select("account_status, account_suspended_until, community_suspended_until, public_message, internal_note, updated_by, updated_at")
    .eq("user_id", userId)
    .maybeSingle<{
      account_status: "active" | "suspended" | "banned"
      account_suspended_until: string | null
      community_suspended_until: string | null
      public_message: string | null
      internal_note: string | null
      updated_by: string | null
      updated_at: string | null
    }>()

  if (error) {
    // The moderation migration may not have been run yet. Do not lock users out
    // because a new optional table is temporarily unavailable.
    backendError("account_restriction_lookup_failed", error, { userId })
    return {
      restricted: false,
      accountStatus: "active",
      accountSuspendedUntil: null,
      communitySuspendedUntil: null,
      publicMessage: null,
      updatedAt: null,
      lookupFailed: true,
    }
  }

  if (!data) {
    return {
      restricted: false,
      accountStatus: "active",
      accountSuspendedUntil: null,
      communitySuspendedUntil: null,
      publicMessage: null,
      updatedAt: null,
      lookupFailed: false,
    }
  }

  const now = Date.now()
  const suspendedUntil = data.account_suspended_until ? new Date(data.account_suspended_until).getTime() : null
  const communityUntil = data.community_suspended_until ? new Date(data.community_suspended_until).getTime() : null
  const accountExpired = data.account_status === "suspended" && suspendedUntil !== null && suspendedUntil <= now
  const communityExpired = communityUntil !== null && communityUntil <= now

  if (accountExpired || communityExpired) {
    const nextMessage = accountExpired
      ? "Your StoryTuner access has been restored automatically because the suspension ended."
      : "Your Community access has been restored automatically because the suspension ended."
    try {
      const normalized = await writeVerifiedModerationStatus(admin, userId, {
        accountStatus: accountExpired ? "active" : data.account_status,
        accountSuspendedUntil: accountExpired ? null : data.account_suspended_until,
        communitySuspendedUntil: communityExpired ? null : data.community_suspended_until,
        publicMessage: nextMessage,
        internalNote: data.internal_note,
        updatedBy: data.updated_by,
      })
      return {
        restricted: normalized.account_status === "banned" || (normalized.account_status === "suspended" && (!normalized.account_suspended_until || new Date(normalized.account_suspended_until).getTime() > now)),
        accountStatus: normalized.account_status,
        accountSuspendedUntil: normalized.account_suspended_until,
        communitySuspendedUntil: normalized.community_suspended_until,
        publicMessage: normalized.public_message,
        updatedAt: normalized.updated_at,
        lookupFailed: false,
      }
    } catch (normalizeError) {
      backendError("moderation_expiry_normalization_failed", normalizeError, { userId })
    }
  }

  const activeSuspension = data.account_status === "suspended" && (suspendedUntil === null || suspendedUntil > now)
  const restricted = data.account_status === "banned" || activeSuspension

  return {
    restricted,
    accountStatus: accountExpired ? "active" : data.account_status,
    accountSuspendedUntil: accountExpired ? null : data.account_suspended_until,
    communitySuspendedUntil: communityExpired ? null : data.community_suspended_until,
    publicMessage: (accountExpired || communityExpired) ? (accountExpired ? "Your StoryTuner access has been restored automatically because the suspension ended." : "Your Community access has been restored automatically because the suspension ended.") : data.public_message,
    updatedAt: data.updated_at,
    lookupFailed: false,
  }
}

export async function requireStoryTunerUser(
  returnBackUrl: string,
  options: { requireProfile?: boolean; allowRestricted?: boolean } = {},
) {
  const safeReturn = safeInternalPath(returnBackUrl)
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) redirect(`/sign-up?mode=sign-in&next=${encodeURIComponent(safeReturn)}`)

  const needsProfile = options.requireProfile !== false
  const restrictionPromise: Promise<AccountRestriction | null> = options.allowRestricted
    ? Promise.resolve(null)
    : getAccountRestriction(authenticated.id)

  let profile: StoryTunerProfile | null = null
  if (needsProfile) {
    const { data } = await authenticated.supabase
      .from("profiles")
      .select("id, username, display_name, confirmed_age_13_plus, onboarding_completed")
      .eq("id", authenticated.id)
      .maybeSingle<StoryTunerProfile>()
    profile = data ?? null
  }

  const restriction = await restrictionPromise

  if (restriction?.restricted) redirect("/account-restricted")

  if (needsProfile && !profile?.onboarding_completed) {
    redirect(`/onboarding?next=${encodeURIComponent(safeReturn)}`)
  }

  return { ...authenticated, profile, restriction }
}

export async function signedInDestination() {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return null
  const restriction = await getAccountRestriction(authenticated.id)
  if (restriction.restricted) return "/account-restricted"
  const { data } = await authenticated.supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", authenticated.id)
    .maybeSingle<{ onboarding_completed: boolean }>()
  return data?.onboarding_completed ? "/home" : "/onboarding"
}

export type AccountRestrictionDecisionContext = {
  content: string | null
  note: string | null
  actionType: "account_suspension" | "account_ban" | null
}

export async function getAccountRestrictionDecisionContext(
  userId: string,
  accountStatus: "active" | "suspended" | "banned",
): Promise<AccountRestrictionDecisionContext> {
  if (accountStatus === "active") return { content: null, note: null, actionType: null }

  const admin = createAdminClient()
  const wantedAction = accountStatus === "banned" ? "account_ban" : "account_suspension"
  const { data: action, error: actionError } = await admin
    .from("community_moderation_actions")
    .select("report_id, note, action_type")
    .eq("user_id", userId)
    .eq("action_type", wantedAction)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ report_id: string | null; note: string | null; action_type: "account_suspension" | "account_ban" }>()

  if (actionError || !action) {
    if (actionError) backendError("restriction_decision_lookup_failed", actionError, { userId })
    return { content: null, note: null, actionType: null }
  }

  let content: string | null = null
  if (action.report_id) {
    const { data: report, error: reportError } = await admin
      .from("community_reports")
      .select("post_id, reply_id")
      .eq("id", action.report_id)
      .maybeSingle<{ post_id: string | null; reply_id: string | null }>()

    if (reportError) {
      backendError("restriction_report_lookup_failed", reportError, { userId, reportId: action.report_id })
    } else if (report?.post_id) {
      const { data } = await admin
        .from("community_posts")
        .select("body")
        .eq("id", report.post_id)
        .maybeSingle<{ body: string }>()
      content = data?.body ?? null
    } else if (report?.reply_id) {
      const { data } = await admin
        .from("community_replies")
        .select("body")
        .eq("id", report.reply_id)
        .maybeSingle<{ body: string }>()
      content = data?.body ?? null
    }
  }

  return {
    content,
    note: action.note,
    actionType: action.action_type,
  }
}
