import { MobileShell } from "@/components/mobile-shell"
import { ProgressClient } from "@/components/profile/progress-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function ProgressPage() {
  await requireStoryTunerUser("/progress")
  return <MobileShell nav={false}><ProgressClient /></MobileShell>
}
