import { createAdminClient } from "@/lib/supabase/admin"
import { getMembershipByUserId } from "@/lib/membership-server"
import { getAuthenticatedUser } from "@/lib/require-auth"

export type CommunityProfile = {
  id: string
  username: string
  display_name: string
  onboarding_completed: boolean
}

export async function getCommunityApiContext() {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) {
    return {
      ok: false as const,
      response: Response.json({ error: "Authentication required." }, { status: 401 }),
    }
  }

  const membership = await getMembershipByUserId(authenticated.id)
  if (!membership.active) {
    return {
      ok: false as const,
      response: Response.json(
        { error: "A paid StoryTuner Membership is required to use Community." },
        { status: 403 },
      ),
    }
  }

  // Read the signed-in user's own profile through their authenticated session.
  // This uses the same profile access path as the rest of StoryTuner and avoids
  // relying on the service-role client for a user-owned profile lookup.
  const { data: profile, error: profileError } = await authenticated.supabase
    .from("profiles")
    .select("id, username, display_name, onboarding_completed")
    .eq("id", authenticated.id)
    .maybeSingle<CommunityProfile>()

  if (profileError) {
    console.error("Community profile lookup failed", {
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
    })
    return {
      ok: false as const,
      response: Response.json(
        { error: "Your membership is active, but Community could not verify your profile." },
        { status: 500 },
      ),
    }
  }

  if (!profile?.onboarding_completed) {
    return {
      ok: false as const,
      response: Response.json(
        { error: "Complete StoryTuner onboarding before using Community." },
        { status: 403 },
      ),
    }
  }

  return {
    ok: true as const,
    userId: authenticated.id,
    profile,
    admin: createAdminClient(),
  }
}

export function noStoreJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "private, no-store, max-age=0")
  return Response.json(data, { ...init, headers })
}
