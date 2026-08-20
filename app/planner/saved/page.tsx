import { redirect } from "next/navigation"
import { MobileShell } from "@/components/mobile-shell"
import { SavedPlansClient } from "@/components/planner/saved-plans-client"
import { getMembershipByUserId } from "@/lib/membership-server"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function SavedPlansPage() {
  const user = await requireStoryTunerUser("/planner/saved")
  const membership = await getMembershipByUserId(user.id)
  if (!membership.active) redirect("/membership")
  return <MobileShell><SavedPlansClient /></MobileShell>
}
