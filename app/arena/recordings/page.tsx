import { MobileShell } from "@/components/mobile-shell"
import { RecordingsClient } from "@/components/arena/recordings-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function RecordingsPage() {
  await requireStoryTunerUser("/arena/recordings")
  return <MobileShell><RecordingsClient /></MobileShell>
}
