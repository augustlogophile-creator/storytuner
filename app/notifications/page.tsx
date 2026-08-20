import { MobileShell } from "@/components/mobile-shell"
import { NotificationsClient } from "@/components/notifications/notifications-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function NotificationsPage() {
  await requireStoryTunerUser("/notifications")
  return <MobileShell><NotificationsClient /></MobileShell>
}
