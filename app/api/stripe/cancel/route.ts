import { backendError, backendLog } from "@/lib/backend-log"
import { getSubscriptionByUserId } from "@/lib/membership-server"
import { getAuthenticatedUser } from "@/lib/require-auth"
import { requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"
import { stripePost } from "@/lib/stripe-rest"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type StripeSubscription = {
  id: string
  status: string
  cancel_at_period_end?: boolean
  current_period_end?: number
  items?: { data?: Array<{ current_period_end?: number }> }
}

export async function POST(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite

  const user = await getAuthenticatedUser()
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 })

  const limited = rateLimitResponse(
    rateLimitUser(user.id, "stripe_cancel_renewal", [{ limit: 5, windowMs: 60 * 60 * 1000, label: "5/hour" }]),
    "Too many cancellation requests. Wait a moment and try again.",
  )
  if (limited) return limited

  try {
    const existing = await getSubscriptionByUserId(user.id)
    if (!existing?.stripe_subscription_id || !["active", "trialing"].includes(existing.status)) {
      return Response.json({ error: "No active Tellwise renewal was found." }, { status: 404 })
    }

    if (existing.cancel_at_period_end) {
      return Response.json({
        canceled: true,
        currentPeriodEnd: existing.current_period_end,
      }, { headers: { "Cache-Control": "private, no-store" } })
    }

    const subscription = await stripePost<StripeSubscription>(
      `/subscriptions/${encodeURIComponent(existing.stripe_subscription_id)}`,
      { cancel_at_period_end: true },
      { idempotencyKey: `storytuner-cancel-renewal-${user.id}-${existing.stripe_subscription_id}` },
    )

    const periodEnd = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end
    const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : existing.current_period_end

    const admin = createAdminClient()
    const { error } = await admin
      .from("subscriptions")
      .update({ cancel_at_period_end: true, current_period_end: currentPeriodEnd })
      .eq("user_id", user.id)
    if (error) throw error

    backendLog("info", "stripe_renewal_canceled", { userId: user.id, subscriptionId: existing.stripe_subscription_id })
    return Response.json({ canceled: true, currentPeriodEnd }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    backendError("stripe_cancel_renewal_failed", error, { userId: user.id })
    return Response.json({ error: "Tellwise could not cancel renewal right now. Try again, or use Manage billing." }, { status: 502, headers: { "Cache-Control": "no-store" } })
  }
}
