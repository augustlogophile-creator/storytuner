import { MobileShell } from "@/components/mobile-shell"
import { ProfileClient } from "@/components/profile/profile-client"
import { isCommunityModerator } from "@/lib/community/moderation"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function ProfilePage() {
  const user = await requireStoryTunerUser("/profile")
  const moderatorRole = await isCommunityModerator(user.id)
  return <MobileShell><ProfileClient moderatorRole={moderatorRole} /></MobileShell>
}
