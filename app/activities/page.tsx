import { MobileShell } from "@/components/mobile-shell"
import { ActivitiesClient } from "@/components/activities/activities-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function ActivitiesPage() {
  await requireStoryTunerUser("/activities")
  return <MobileShell><ActivitiesClient /></MobileShell>
}
