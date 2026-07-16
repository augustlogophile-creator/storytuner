import { redirect } from "next/navigation"
import { safeInternalPath } from "@/lib/auth/redirects"
import { createClient } from "@/lib/supabase/server"

export type StoryTunerProfile = {
  id: string
  username: string
  display_name: string
  confirmed_age_13_plus: boolean
  onboarding_completed: boolean
}

export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims ?? null
  const userId = typeof claims?.sub === "string" ? claims.sub : null
  if (error || !userId || !claims) return null
  return { id: userId, claims, supabase }
}

export async function requireStoryTunerUser(
  returnBackUrl: string,
  options: { requireProfile?: boolean } = {},
) {
  const safeReturn = safeInternalPath(returnBackUrl)
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) redirect(`/sign-in?next=${encodeURIComponent(safeReturn)}`)

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
  const { data } = await authenticated.supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", authenticated.id)
    .maybeSingle<{ onboarding_completed: boolean }>()
  return data?.onboarding_completed ? "/home" : "/onboarding"
}
