import { MobileShell } from "@/components/mobile-shell"
import { MembershipClient, type MembershipStatus } from "@/components/profile/membership-client"
import { getMembershipByUserId } from "@/lib/membership-server"
import { requireStoryTunerUser } from "@/lib/require-auth"

type MembershipSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function MembershipPage({ searchParams }: { searchParams?: MembershipSearchParams }) {
  const user = await requireStoryTunerUser("/membership")
  const membership = await getMembershipByUserId(user.id)
  const params = searchParams ? await searchParams : {}
  const checkoutValue = Array.isArray(params.checkout) ? params.checkout[0] : params.checkout
  const initialStatus: MembershipStatus = {
    active: membership.active,
    status: membership.subscription?.status ?? "inactive",
    cancelAtPeriodEnd: membership.subscription?.cancel_at_period_end ?? false,
    currentPeriodEnd: membership.subscription?.current_period_end ?? null,
  }

  return <MobileShell><MembershipClient initialStatus={initialStatus} checkoutSuccess={checkoutValue === "success"} /></MobileShell>
}
