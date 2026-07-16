import { notFound } from "next/navigation"
import { MobileShell } from "@/components/mobile-shell"
import { UnitDetail } from "@/components/activities/unit-detail"
import { curriculum, getUnit } from "@/lib/curriculum"
import { requireStoryTunerUser } from "@/lib/require-auth"

export function generateStaticParams() {
  return curriculum.map((unit) => ({ unitId: unit.id }))
}

export default async function UnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params
  await requireStoryTunerUser(`/activities/${unitId}`)
  const unit = getUnit(unitId)
  if (!unit) notFound()
  return <MobileShell><UnitDetail unit={unit} /></MobileShell>
}
