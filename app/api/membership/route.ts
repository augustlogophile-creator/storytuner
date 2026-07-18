import { getMembershipByUserId } from "@/lib/membership-server"
import { getAuthenticatedUser } from "@/lib/require-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return Response.json({ active: false }, { status: 401 })
  const membership = await getMembershipByUserId(user.id)
  return Response.json({
    active: membership.active,
    status: membership.subscription?.status ?? "inactive",
    cancelAtPeriodEnd: membership.subscription?.cancel_at_period_end ?? false,
    currentPeriodEnd: membership.subscription?.current_period_end ?? null,
  })
}
