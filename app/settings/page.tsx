import { MobileShell } from "@/components/mobile-shell"
import { SettingsClient } from "@/components/profile/settings-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function SettingsPage() {
  const user = await requireStoryTunerUser("/settings")
  return <MobileShell><SettingsClient username={user.profile?.username ?? "storyteller"} /></MobileShell>
}
