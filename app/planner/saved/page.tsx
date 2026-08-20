import { redirect } from "next/navigation"
import { getMembershipByUserId } from "@/lib/membership-server"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function SavedPlansPage() {
  const user = await requireStoryTunerUser("/planner#saved-plans")
  const membership = await getMembershipByUserId(user.id)
  if (!membership.active) redirect("/membership")
  redirect("/planner#saved-plans")
}
