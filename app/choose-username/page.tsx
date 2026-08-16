import { redirect } from "next/navigation"
import { ChooseUsername } from "@/components/auth/choose-username"
import { safeInternalPath } from "@/lib/auth/redirects"
import { requireStoryTunerUser } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export default async function ChooseUsernamePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next
  const destination = safeInternalPath(rawNext, "/home")
  const { supabase, id } = await requireStoryTunerUser("/choose-username", { requireProfile: false })

  const [{ data: userData }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("username, onboarding_completed")
      .eq("id", id)
      .maybeSingle<{ username: string; onboarding_completed: boolean }>(),
  ])

  if (!userData.user) redirect(`/sign-up?mode=sign-in&next=${encodeURIComponent(destination)}`)

  if (profile?.username?.trim()) {
    if (profile.onboarding_completed) redirect(destination === "/choose-username" ? "/home" : destination)
    redirect(`/onboarding?mode=login-recovery&next=${encodeURIComponent(destination)}`)
  }

  return <ChooseUsername email={userData.user.email ?? ""} destination={destination === "/choose-username" ? "/home" : destination} />
}
