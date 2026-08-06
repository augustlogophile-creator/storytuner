import { redirect } from "next/navigation"
import { safeInternalPath } from "@/lib/auth/redirects"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

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
    .select("account_status, account_suspended_until, community_suspended_until, public_message")
    .eq("user_id", userId)
    .maybeSingle<{
      account_status: "active" | "suspended" | "banned"
      account_suspended_until: string | null
      community_suspended_until: string | null
      public_message: string | null
    }>()

  if (error) {
    // The moderation migration may not have been run yet. Do not lock users out
    // because a new optional table is temporarily unavailable.
    console.error("Account restriction lookup failed", error)
    return {
      restricted: false,
      accountStatus: "active",
      accountSuspendedUntil: null,
      communitySuspendedUntil: null,
      publicMessage: null,
    }
  }

  if (!data) {
    return {
      restricted: false,
      accountStatus: "active",
      accountSuspendedUntil: null,
      communitySuspendedUntil: null,
      publicMessage: null,
    }
  }

  const suspendedUntil = data.account_suspended_until ? new Date(data.account_suspended_until).getTime() : null
  const activeSuspension = data.account_status === "suspended" && (suspendedUntil === null || suspendedUntil > Date.now())
  const restricted = data.account_status === "banned" || activeSuspension

  return {
    restricted,
    accountStatus: data.account_status,
    accountSuspendedUntil: data.account_suspended_until,
    communitySuspendedUntil: data.community_suspended_until,
    publicMessage: data.public_message,
  }
}

export async function requireStoryTunerUser(
  returnBackUrl: string,
  options: { requireProfile?: boolean; allowRestricted?: boolean } = {},
) {
  const safeReturn = safeInternalPath(returnBackUrl)
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) redirect(`/sign-up?mode=sign-in&next=${encodeURIComponent(safeReturn)}`)

  if (!options.allowRestricted) {
    const restriction = await getAccountRestriction(authenticated.id)
    if (restriction.restricted) redirect("/account-restricted")
  }

  let profile: StoryTunerProfile | null = null
  if (options.requireProfile !== false) {
    const { data } = await authenticated.supabase
      .from("profiles")
      .select("id, username, display_name, confirmed_age_13_plus, onboarding_completed")
      .eq("id", authenticated.id)
      .maybeSingle<StoryTunerProfile>()

    profile = data ?? null
    if (!profile?.onboarding_completed) {
      redirect(`/onboarding?next=${encodeURIComponent(safeReturn)}`)
    }
  }

  return { ...authenticated, profile }
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
