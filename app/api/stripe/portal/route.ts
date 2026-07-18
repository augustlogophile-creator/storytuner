import { getSubscriptionByUserId } from "@/lib/membership-server"
import { getAuthenticatedUser } from "@/lib/require-auth"
import { stripePost } from "@/lib/stripe-rest"

type PortalSession = { url: string }

export async function POST(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 })

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
    return Response.json({ url: session.url })
  } catch (error) {
    console.error("Stripe portal error", error)
    return Response.json({ error: "Could not open billing settings." }, { status: 500 })
  }
}
