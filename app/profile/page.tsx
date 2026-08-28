import { MobileShell } from "@/components/mobile-shell"
import { ProfileClient } from "@/components/profile/profile-client"
import { verifiedModeratorRole } from "@/lib/community/moderation"
import { requireStoryTunerUser } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const user = await requireStoryTunerUser("/profile")
  const moderatorRole = await verifiedModeratorRole(user)
  const displayName = user.profile?.display_name?.trim().slice(0, 15) || "Storyteller"

  // Display names are changed only through the moderated profile endpoint. Do
  // not silently copy mutable Google profile metadata into Tellwise, because
  // that would create a second path around Tellwise's public-name moderation.
  return (
    <MobileShell fitViewport scrollable>
      <ProfileClient
        moderatorRole={moderatorRole}
        displayName={displayName}
        username={user.profile?.username ?? "storyteller"}
      />
    </MobileShell>
  )
}
