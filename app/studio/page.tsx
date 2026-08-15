import { MobileShell } from "@/components/mobile-shell"
import { ArenaClient } from "@/components/arena/arena-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function StudioPage() {
  await requireStoryTunerUser("/studio")
  return <MobileShell><ArenaClient /></MobileShell>
}
