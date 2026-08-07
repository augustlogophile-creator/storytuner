import { notFound, redirect } from "next/navigation"
import { MobileShell } from "@/components/mobile-shell"
import { UnitDetail } from "@/components/activities/unit-detail"
import { curriculum, getUnit } from "@/lib/curriculum"
import { requireStoryTunerUser } from "@/lib/require-auth"
import { getMembershipByUserId } from "@/lib/membership-server"

export function generateStaticParams() {
  return curriculum.map((unit) => ({ unitId: unit.id }))
}

export default async function UnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params
  const user = await requireStoryTunerUser(`/activities/${unitId}`)
  const unit = getUnit(unitId)
  if (!unit) notFound()
  if (unit.index > 5) {
    const membership = await getMembershipByUserId(user.id)
    if (!membership.active) redirect("/membership")
  }
  return <MobileShell><UnitDetail unit={unit} /></MobileShell>
}
