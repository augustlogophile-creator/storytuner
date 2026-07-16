import { MobileShell } from "@/components/mobile-shell"
import { ArenaClient } from "@/components/arena/arena-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function ArenaPage() {
  await requireStoryTunerUser("/arena")
  return <MobileShell><ArenaClient /></MobileShell>
}
