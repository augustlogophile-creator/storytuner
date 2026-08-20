import { notFound, redirect } from "next/navigation"
import { MobileShell } from "@/components/mobile-shell"
import { CheckpointTest } from "@/components/activities/checkpoint-test"
import { checkpoints, getCheckpoint } from "@/lib/checkpoints"
import { requireStoryTunerUser } from "@/lib/require-auth"
import { getMembershipByUserId } from "@/lib/membership-server"

export function generateStaticParams() {
  return checkpoints.map((checkpoint) => ({ checkpointId: checkpoint.id }))
}

export default async function CheckpointPage({ params }: { params: Promise<{ checkpointId: string }> }) {
  const { checkpointId } = await params
  const user = await requireStoryTunerUser(`/test/${checkpointId}`)
  const checkpoint = getCheckpoint(checkpointId)
  if (!checkpoint) notFound()
  if (checkpoint.afterUnit > 5) {
    const membership = await getMembershipByUserId(user.id)
    if (!membership.active) redirect("/membership?from=lessons")
  }
  return <MobileShell><div className="learning-page"><CheckpointTest checkpoint={checkpoint} /></div></MobileShell>
}
