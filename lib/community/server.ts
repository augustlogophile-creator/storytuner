import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMembershipByUserId } from "@/lib/membership-server"
import { getAccountRestriction, getAuthenticatedUser } from "@/lib/require-auth"
import { backendError } from "@/lib/backend-log"

export type CommunityProfile = {
  id: string
  username: string
  display_name: string
  onboarding_completed: boolean
}

export type CommunityApiContext = {
  ok: true
  userId: string
  profile: CommunityProfile
  userClient: SupabaseClient
  admin: SupabaseClient
}

export async function getCommunityApiContext() {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) {
    return {
      ok: false as const,
      response: Response.json({ error: "Authentication required." }, { status: 401 }),
    }
  }

  const restriction = await getAccountRestriction(authenticated.id)
  if (restriction.lookupFailed) {
    return {
      ok: false as const,
      response: Response.json(
        { code: "ACCOUNT_STATUS_UNAVAILABLE", error: "Community could not verify your account status right now. Try again in a moment." },
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

  const communityUntil = restriction.communitySuspendedUntil
    ? new Date(restriction.communitySuspendedUntil).getTime()
    : null
  if (communityUntil && communityUntil > Date.now()) {
    return {
      ok: false as const,
      response: Response.json(
        {
          error: restriction.publicMessage || "Community access is temporarily suspended.",
          suspendedUntil: restriction.communitySuspendedUntil,
        },
        { status: 403 },
      ),
    }
  }

  let membership
  try {
    membership = await getMembershipByUserId(authenticated.id)
  } catch (error) {
    backendError("community_membership_lookup_failed", error, { userId: authenticated.id })
    return {
      ok: false as const,
      response: Response.json(
        { code: "MEMBERSHIP_STATUS_UNAVAILABLE", error: "Community could not verify your membership right now. Try again in a moment." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      ),
    }
  }
  if (!membership.active) {
    return {
      ok: false as const,
      response: Response.json(
        { error: "A paid StoryTuner Membership is required to use Community." },
        { status: 403 },
      ),
    }
  }

  const { data: profile, error: profileError } = await authenticated.supabase
    .from("profiles")
    .select("id, username, display_name, onboarding_completed")
    .eq("id", authenticated.id)
    .maybeSingle<CommunityProfile>()

  if (profileError) {
    backendError("community_profile_lookup_failed", profileError, { userId: authenticated.id })
    return {
      ok: false as const,
      response: Response.json(
        { error: "Your membership is active, but Community could not verify your profile." },
        { status: 500 },
      ),
    }
  }

  if (!profile?.username?.trim()) {
    return {
      ok: false as const,
      response: Response.json(
        { code: "USERNAME_SETUP_REQUIRED", error: "Choose your StoryTuner username before using Community." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    }
  }

  if (!profile.onboarding_completed) {
    return {
      ok: false as const,
      response: Response.json(
        { code: "ACCOUNT_SETUP_REQUIRED", error: "Finish StoryTuner account setup before using Community." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    }
  }

  return {
    ok: true as const,
    userId: authenticated.id,
    profile,
    userClient: authenticated.supabase,
    admin: createAdminClient(),
  }
}

export function noStoreJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "private, no-store, max-age=0")
  return Response.json(data, { ...init, headers })
}
