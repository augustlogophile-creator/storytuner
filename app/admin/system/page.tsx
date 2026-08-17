import { notFound } from "next/navigation"
import { SystemOperationsClient } from "@/components/admin/system-operations-client"
import { MobileShell } from "@/components/mobile-shell"
import { verifiedModeratorRole } from "@/lib/community/moderation"
import { requireStoryTunerUser } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export default async function SystemOperationsPage() {
  const user = await requireStoryTunerUser("/admin/system")
  if (await verifiedModeratorRole(user) !== "admin") notFound()
  return <MobileShell><SystemOperationsClient /></MobileShell>
}
