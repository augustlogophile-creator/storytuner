import { MobileShell } from "@/components/mobile-shell"
import { MembershipClient } from "@/components/profile/membership-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function MembershipPage() {
  await requireStoryTunerUser("/membership")
  return <MobileShell nav={false}><MembershipClient /></MobileShell>
}
