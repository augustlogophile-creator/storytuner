import { notFound } from "next/navigation"
import { CommunityModerationClient } from "@/components/admin/community-moderation-client"
import { MobileShell } from "@/components/mobile-shell"
import { verifiedModeratorRole } from "@/lib/community/moderation"
import { requireStoryTunerUser } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export default async function CommunityModerationPage() {
  const user = await requireStoryTunerUser("/admin/community")
  const role = await verifiedModeratorRole(user)
  if (role !== "admin") notFound()
  return <MobileShell><CommunityModerationClient role={role} /></MobileShell>
}
