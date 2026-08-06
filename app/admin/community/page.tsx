import { redirect } from "next/navigation"
import { CommunityModerationClient } from "@/components/admin/community-moderation-client"
import { MobileShell } from "@/components/mobile-shell"
import { isCommunityModerator } from "@/lib/community/moderation"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function CommunityModerationPage() {
  const user = await requireStoryTunerUser("/admin/community")
  const role = await isCommunityModerator(user.id)
  if (!role) redirect("/profile")
  return <MobileShell wide><CommunityModerationClient role={role} /></MobileShell>
}
