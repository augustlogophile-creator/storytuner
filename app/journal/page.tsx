import { MobileShell } from "@/components/mobile-shell"
import { JournalClient } from "@/components/journal/journal-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export default async function JournalPage() {
  await requireStoryTunerUser("/journal")
  return <MobileShell scrollable><JournalClient /></MobileShell>
}
