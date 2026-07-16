import { Suspense } from "react"
import { redirect } from "next/navigation"
import { AccountSetup } from "@/components/auth/account-setup"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function AccountSetupPage() {
  const { supabase, id } = await requireStoryTunerUser("/onboarding", { requireProfile: false })
  const [{ data: userData }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("username, display_name, confirmed_age_13_plus, onboarding_completed").eq("id", id).maybeSingle(),
  ])

  if (profile?.onboarding_completed) redirect("/home")
  const metadataName = typeof userData.user?.user_metadata?.full_name === "string"
    ? userData.user.user_metadata.full_name
    : typeof userData.user?.user_metadata?.name === "string"
      ? userData.user.user_metadata.name
      : userData.user?.email?.split("@")[0] ?? ""

  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <AccountSetup initialName={metadataName} initialProfile={profile ?? null} />
    </Suspense>
  )
}
