import { MobileShell } from "@/components/mobile-shell"
import { CommunityClient } from "@/components/community/community-client"
import { getMembershipByUserId } from "@/lib/membership-server"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function CommunityPage() {
  const user = await requireStoryTunerUser("/community")
  const membership = await getMembershipByUserId(user.id)

  return (
    <MobileShell>
      <CommunityClient
        membershipActive={membership.active}
        currentUsername={user.profile?.username ?? "member"}
      />
    </MobileShell>
  )
}
