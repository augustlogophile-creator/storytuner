import { MobileShell } from "@/components/mobile-shell"
import { HomeDashboard } from "@/components/home/home-dashboard"
import { requireStoryTunerUser } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const user = await requireStoryTunerUser("/home")
  const restriction = user.restriction
  const restorationNotice = restriction?.accountStatus === "active" && restriction?.publicMessage?.startsWith("Your StoryTuner access has been restored")
    ? restriction?.publicMessage ?? null
    : null
  return <MobileShell fitViewport><HomeDashboard accountNotice={restorationNotice} accountNoticeUpdatedAt={restriction?.updatedAt ?? null} /></MobileShell>
}
