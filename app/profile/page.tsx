import { MobileShell } from "@/components/mobile-shell"
import { ProfileClient } from "@/components/profile/profile-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function ProfilePage() {
  await requireStoryTunerUser("/profile")
  return <MobileShell><ProfileClient /></MobileShell>
}
