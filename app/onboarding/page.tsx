import { Suspense } from "react"
import { redirect } from "next/navigation"
import { AccountSetup } from "@/components/auth/account-setup"
import { safeInternalPath } from "@/lib/auth/redirects"
import { requireStoryTunerUser } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export default async function AccountSetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next
  const destination = safeInternalPath(rawNext, "/home")
  const { supabase, id } = await requireStoryTunerUser("/onboarding", { requireProfile: false })
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, onboarding_completed")
    .eq("id", id)
    .maybeSingle<{ username: string; onboarding_completed: boolean }>()

  if (!profile?.username?.trim()) {
    redirect(`/choose-username?next=${encodeURIComponent(destination)}`)
  }
  if (profile.onboarding_completed) redirect(destination === "/onboarding" ? "/home" : destination)

  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <AccountSetup />
    </Suspense>
  )
}
