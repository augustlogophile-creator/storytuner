import { MobileShell } from "@/components/mobile-shell"
import { CoachClient } from "@/components/coach/coach-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function CoachPage() {
  await requireStoryTunerUser("/coach")
  return <MobileShell><CoachClient /></MobileShell>
}
