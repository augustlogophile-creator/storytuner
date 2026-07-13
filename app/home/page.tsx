import { MobileShell } from "@/components/mobile-shell"
import { HomeDashboard } from "@/components/home/home-dashboard"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function HomePage() {
  await requireStoryTunerUser("/home")
  return <MobileShell><HomeDashboard /></MobileShell>
}
