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
        { error: "An active StoryTuner Membership is required to use Community." },
        { status: 403 },
      ),
    }
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, username, display_name, onboarding_completed")
    .eq("id", authenticated.id)
    .maybeSingle<CommunityProfile>()

  if (profileError) {
    console.error("Community profile lookup failed", profileError)
    return {
      ok: false as const,
      response: Response.json({ error: "Community could not verify your profile." }, { status: 500 }),
    }
  }

  if (!profile?.onboarding_completed) {
    return {
      ok: false as const,
      response: Response.json({ error: "Complete StoryTuner onboarding before using Community." }, { status: 403 }),
    }
  }

  return {
    ok: true as const,
    userId: authenticated.id,
    profile,
    admin,
  }
}

export function noStoreJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set("Cache-Control", "private, no-store, max-age=0")
  return Response.json(data, { ...init, headers })
}
