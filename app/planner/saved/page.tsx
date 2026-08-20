import { redirect } from "next/navigation"
import { MobileShell } from "@/components/mobile-shell"
import { SavedPlansClient } from "@/components/planner/saved-plans-client"
import { getMembershipByUserId } from "@/lib/membership-server"
import { requireStoryTunerUser } from "@/lib/require-auth"
import type { StoryPlanOutput, StoryPlanRecord } from "@/lib/planner/types"

type PlanRow = {
  id: string
  audience_context: string
  goal: string
  rough_plan: string
  must_include: string
  nervous_about: string
  output: StoryPlanOutput
  created_at: string
}

function toRecord(row: PlanRow): StoryPlanRecord {
  return {
    id: row.id,
    audienceContext: row.audience_context,
    goal: row.goal,
    roughPlan: row.rough_plan,
    mustInclude: row.must_include,
    nervousAbout: row.nervous_about,
    output: row.output,
    createdAt: row.created_at,
  }
}

export default async function SavedPlansPage() {
  const user = await requireStoryTunerUser("/planner/saved")
  const membership = await getMembershipByUserId(user.id)
  if (!membership.active) redirect("/membership?from=planner")

  const { data, error } = await user.supabase
    .from("story_plans")
    .select("id, audience_context, goal, rough_plan, must_include, nervous_about, output, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8)
    .returns<PlanRow[]>()

  return (
    <MobileShell>
      <SavedPlansClient
        initialPlans={(data ?? []).map(toRecord)}
        initialError={error ? "Your saved plans could not be loaded. Try again." : ""}
      />
    </MobileShell>
  )
}
