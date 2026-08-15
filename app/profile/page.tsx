import { MobileShell } from "@/components/mobile-shell"
import { ProfileClient } from "@/components/profile/profile-client"
import { moderatorRoleFromClaims } from "@/lib/community/moderation"
import { validateDisplayName } from "@/lib/profile/public-name"
import { requireStoryTunerUser } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

const GENERIC_PROFILE_NAMES = new Set(["storytuner member", "storyteller"])

export default async function ProfilePage() {
  const user = await requireStoryTunerUser("/profile")
  const moderatorRole = moderatorRoleFromClaims(user.claims)
  let displayName = user.profile?.display_name?.trim().slice(0, 15) || "Storyteller"

  // Older moderation/test migrations could replace an unsafe public name with
  // the generic placeholder "StoryTuner member". If Google already provides a
  // safe real name, heal the profile once so the same name appears everywhere.
  if (GENERIC_PROFILE_NAMES.has(displayName.toLowerCase())) {
    const { data } = await user.supabase.auth.getUser()
    const metadata = data.user?.user_metadata
    const candidate = typeof metadata?.full_name === "string"
      ? metadata.full_name.trim().slice(0, 15)
      : typeof metadata?.name === "string"
        ? metadata.name.trim().slice(0, 15)
        : ""

    if (candidate && !GENERIC_PROFILE_NAMES.has(candidate.toLowerCase()) && !validateDisplayName(candidate)) {
      const { error } = await user.supabase.from("profiles").update({ display_name: candidate }).eq("id", user.id)
      if (!error) displayName = candidate
    }
  }

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
