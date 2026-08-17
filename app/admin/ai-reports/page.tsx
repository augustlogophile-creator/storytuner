import { notFound } from "next/navigation"
import { AiResponseReportsClient } from "@/components/admin/ai-response-reports-client"
import { MobileShell } from "@/components/mobile-shell"
import { verifiedModeratorRole } from "@/lib/community/moderation"
import { requireStoryTunerUser } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export default async function AiResponseReportsPage() {
  const user = await requireStoryTunerUser("/admin/ai-reports")
  if (await verifiedModeratorRole(user) !== "admin") notFound()
  return <MobileShell><AiResponseReportsClient /></MobileShell>
}
