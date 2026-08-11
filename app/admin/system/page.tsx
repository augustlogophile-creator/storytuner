import { redirect } from "next/navigation"
import { SystemOperationsClient } from "@/components/admin/system-operations-client"
import { MobileShell } from "@/components/mobile-shell"
import { moderatorRoleFromClaims } from "@/lib/community/moderation"
import { requireStoryTunerUser } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export default async function SystemOperationsPage() {
  const user = await requireStoryTunerUser("/admin/system")
  if (!moderatorRoleFromClaims(user.claims)) redirect("/profile")
  return <MobileShell><SystemOperationsClient /></MobileShell>
}
