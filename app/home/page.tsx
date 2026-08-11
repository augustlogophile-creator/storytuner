import { MobileShell } from "@/components/mobile-shell"
import { HomeDashboard } from "@/components/home/home-dashboard"
import { getAccountRestriction, requireStoryTunerUser } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const user = await requireStoryTunerUser("/home")
  const restriction = await getAccountRestriction(user.id)
  const restorationNotice = restriction.accountStatus === "active" && restriction.publicMessage?.startsWith("Your StoryTuner access has been restored")
    ? restriction.publicMessage
    : null
  return <MobileShell><HomeDashboard accountNotice={restorationNotice} accountNoticeUpdatedAt={restriction.updatedAt} /></MobileShell>
}
