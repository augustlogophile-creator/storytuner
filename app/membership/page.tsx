import { MobileShell } from "@/components/mobile-shell"
import { MembershipClient, type MembershipStatus } from "@/components/profile/membership-client"
import { getMembershipByUserId } from "@/lib/membership-server"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function MembershipPage() {
  const user = await requireStoryTunerUser("/membership")
  const membership = await getMembershipByUserId(user.id)
  const initialStatus: MembershipStatus = {
    active: membership.active,
    status: membership.subscription?.status ?? "inactive",
    cancelAtPeriodEnd: membership.subscription?.cancel_at_period_end ?? false,
    currentPeriodEnd: membership.subscription?.current_period_end ?? null,
  }

  return <MobileShell nav={false}><MembershipClient initialStatus={initialStatus} /></MobileShell>
}
