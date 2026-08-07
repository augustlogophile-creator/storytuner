import { redirect } from "next/navigation"
import { MobileShell } from "@/components/mobile-shell"
import { StoryPlannerClient } from "@/components/planner/story-planner-client"
import { getMembershipByUserId } from "@/lib/membership-server"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function StoryPlannerPage() {
  const user = await requireStoryTunerUser("/planner")
  const membership = await getMembershipByUserId(user.id)
  if (!membership.active) redirect("/membership")
  return <MobileShell><StoryPlannerClient /></MobileShell>
}
