import { redirect } from "next/navigation"
import { MobileShell } from "@/components/mobile-shell"
import { StoryPlannerClient } from "@/components/planner/story-planner-client"
import { getMembershipByUserId } from "@/lib/membership-server"
import { requireStoryTunerUser } from "@/lib/require-auth"

type StoryPlannerSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function StoryPlannerPage({ searchParams }: { searchParams: StoryPlannerSearchParams }) {
  const params = await searchParams
  const from = Array.isArray(params.from) ? params.from[0] : params.from
  const fromStudio = from === "studio" || from === "arena"
  const user = await requireStoryTunerUser(fromStudio ? "/planner?from=studio" : "/planner")
  const membership = await getMembershipByUserId(user.id)
  if (!membership.active) redirect("/membership?from=planner")
  return <MobileShell><StoryPlannerClient fromStudio={fromStudio} /></MobileShell>
}
