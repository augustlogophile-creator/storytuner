import { MobileShell } from "@/components/mobile-shell"
import { CommunityClient } from "@/components/community/community-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function CommunityPage() {
  await requireStoryTunerUser("/community")
  return <MobileShell><CommunityClient /></MobileShell>
}
