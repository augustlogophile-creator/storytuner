import { MobileShell } from "@/components/mobile-shell"
import { DraftsClient } from "@/components/arena/drafts-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function StudioDraftsPage() {
  await requireStoryTunerUser("/studio/recordings/drafts")
  return <MobileShell><DraftsClient /></MobileShell>
}
