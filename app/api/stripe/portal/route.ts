import { getSubscriptionByUserId } from "@/lib/membership-server"
import { getAuthenticatedUser } from "@/lib/require-auth"
import { stripePost } from "@/lib/stripe-rest"
import { backendError } from "@/lib/backend-log"
import { rateLimitResponse, rateLimitUser } from "@/lib/request-protection"

type PortalSession = { url: string }

export async function POST(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 })
  const limited = rateLimitResponse(rateLimitUser(user.id, "stripe_portal", [{ limit: 8, windowMs: 10 * 60 * 1000, label: "8/10m" }]), "Too many billing requests. Wait a few minutes and try again.")
  if (limited) return limited

  try {
    const subscription = await getSubscriptionByUserId(user.id)
    if (!subscription?.stripe_customer_id) {
      return Response.json({ error: "No billing account was found." }, { status: 404 })
    }
    const origin = new URL(request.url).origin
    const session = await stripePost<PortalSession>("/billing_portal/sessions", {
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/membership`,
    })
    return Response.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("stripe_portal_failed", error, { userId: user.id })
    return Response.json({ error: "Could not open billing settings." }, { status: 500 })
  }
}
