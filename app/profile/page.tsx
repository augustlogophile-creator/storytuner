import { MobileShell } from "@/components/mobile-shell"
import { ProfileClient } from "@/components/profile/profile-client"
import { moderatorRoleFromClaims } from "@/lib/community/moderation"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function ProfilePage() {
  const user = await requireStoryTunerUser("/profile")
  const moderatorRole = moderatorRoleFromClaims(user.claims)
  return <MobileShell><ProfileClient moderatorRole={moderatorRole} /></MobileShell>
}
