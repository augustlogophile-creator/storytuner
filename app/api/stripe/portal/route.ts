import { getSubscriptionByUserId } from "@/lib/membership-server"
import { getAuthenticatedUser } from "@/lib/require-auth"
import { stripePost } from "@/lib/stripe-rest"
import { backendError } from "@/lib/backend-log"
import { requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"
import { siteUrl } from "@/lib/auth/redirects"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type PortalSession = { url: string }

export async function POST(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite
  const user = await getAuthenticatedUser()
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 })
  const limited = rateLimitResponse(rateLimitUser(user.id, "stripe_portal", [{ limit: 8, windowMs: 10 * 60 * 1000, label: "8/10m" }]), "Too many billing requests. Wait a few minutes and try again.")
  if (limited) return limited

  try {
    const subscription = await getSubscriptionByUserId(user.id)
    if (!subscription?.stripe_customer_id) {
      return Response.json({ error: "No billing account was found." }, { status: 404 })
    }
    const session = await stripePost<PortalSession>("/billing_portal/sessions", {
      customer: subscription.stripe_customer_id,
      return_url: `${siteUrl()}/membership`,
    })
    return Response.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("stripe_portal_failed", error, { userId: user.id })
    return Response.json({ error: "Could not open billing settings right now." }, { status: 502, headers: { "Cache-Control": "no-store" } })
  }
}
