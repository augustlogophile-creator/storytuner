import { redirect } from "next/navigation"
import { CommunityModerationClient } from "@/components/admin/community-moderation-client"
import { MobileShell } from "@/components/mobile-shell"
import { moderatorRoleFromClaims } from "@/lib/community/moderation"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function CommunityModerationPage() {
  const user = await requireStoryTunerUser("/admin/community")
  const role = moderatorRoleFromClaims(user.claims)
  if (!role) redirect("/profile")
  return <MobileShell><CommunityModerationClient role={role} /></MobileShell>
}
