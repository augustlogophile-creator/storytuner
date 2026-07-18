import { getSubscriptionByUserId, isMembershipActive } from "@/lib/membership-server"
import { getAuthenticatedUser } from "@/lib/require-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { stripePost } from "@/lib/stripe-rest"

type CheckoutSession = { id: string; url: string | null; customer: string | null }
type StripeCustomer = { id: string }

export async function POST(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 })

  try {
    const existing = await getSubscriptionByUserId(user.id)
    if (isMembershipActive(existing)) {
      return Response.json({ error: "Membership is already active.", code: "ALREADY_ACTIVE" }, { status: 409 })
    }

    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) throw new Error("STRIPE_PRICE_ID is missing.")

    const origin = new URL(request.url).origin
    const email = typeof user.claims.email === "string" ? user.claims.email : undefined
    let customerId = existing?.stripe_customer_id ?? null

    if (!customerId) {
      const customer = await stripePost<StripeCustomer>("/customers", {
        email,
        "metadata[supabase_user_id]": user.id,
      })
      customerId = customer.id
      const admin = createAdminClient()
      const { error } = await admin.from("subscriptions").upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        status: "inactive",
      }, { onConflict: "user_id" })
      if (error) throw error
    }

    const session = await stripePost<CheckoutSession>("/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": 1,
      success_url: `${origin}/membership?checkout=success`,
      cancel_url: `${origin}/membership?checkout=cancelled`,
      client_reference_id: user.id,
      "metadata[supabase_user_id]": user.id,
      "subscription_data[metadata][supabase_user_id]": user.id,
      allow_promotion_codes: true,
    })

    if (!session.url) throw new Error("Stripe did not return a checkout URL.")
    return Response.json({ url: session.url })
  } catch (error) {
    console.error("Stripe checkout error", error)
    return Response.json({ error: error instanceof Error ? error.message : "Could not start checkout." }, { status: 500 })
  }
}
