import { MobileShell } from "@/components/mobile-shell"
import { ShopClient } from "@/components/profile/shop-client"
import { requireStoryTunerUser } from "@/lib/require-auth"

export default async function ShopPage() {
  await requireStoryTunerUser("/shop")
  return <MobileShell nav={false}><ShopClient /></MobileShell>
}
