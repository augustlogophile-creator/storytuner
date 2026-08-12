import { getMembershipByUserId } from "@/lib/membership-server"
import { getAuthenticatedUser } from "@/lib/require-auth"
import { backendError } from "@/lib/backend-log"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return Response.json({ active: false }, { status: 401, headers: { "Cache-Control": "no-store" } })
  try {
    const membership = await getMembershipByUserId(user.id)
    return Response.json({
      active: membership.active,
      status: membership.subscription?.status ?? "inactive",
      cancelAtPeriodEnd: membership.subscription?.cancel_at_period_end ?? false,
      currentPeriodEnd: membership.subscription?.current_period_end ?? null,
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    backendError("membership_lookup_failed", error, { userId: user.id })
    return Response.json({ code: "MEMBERSHIP_STATUS_UNAVAILABLE", error: "Membership status could not be loaded right now." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
