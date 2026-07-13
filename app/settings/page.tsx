import { MobileShell } from "@/components/mobile-shell"
import { SettingsClient } from "@/components/profile/settings-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function SettingsPage() {
  await requireStoryTunerUser("/settings")
  return <MobileShell nav={false}><SettingsClient /></MobileShell>
}
