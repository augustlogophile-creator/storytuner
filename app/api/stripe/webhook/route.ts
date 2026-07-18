import { createAdminClient } from "@/lib/supabase/admin"
import { stripeGet, verifyStripeSignature } from "@/lib/stripe-rest"

export const runtime = "nodejs"

type StripeEvent = { type: string; data: { object: Record<string, unknown> } }
type StripeSubscription = {
  id: string
  customer: string
  status: string
  cancel_at_period_end?: boolean
  current_period_end?: number
  metadata?: Record<string, string>
  items?: { data?: Array<{ price?: { id?: string }; current_period_end?: number }> }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature")
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !secret) return new Response("Webhook is not configured.", { status: 400 })
  if (!(await verifyStripeSignature(rawBody, signature, secret))) {
    return new Response("Invalid webhook signature.", { status: 400 })
  }

  const event = JSON.parse(rawBody) as StripeEvent
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null
      if (subscriptionId) await syncSubscription(await stripeGet<StripeSubscription>(`/subscriptions/${subscriptionId}`))
    }

    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await syncSubscription(event.data.object as unknown as StripeSubscription)
    }

    return Response.json({ received: true })
  } catch (error) {
    console.error("Stripe webhook error", error)
    return new Response("Webhook handler failed.", { status: 500 })
  }
}

async function syncSubscription(subscription: StripeSubscription) {
  const admin = createAdminClient()
  const userIdFromMetadata = subscription.metadata?.supabase_user_id
  let userId = userIdFromMetadata || null

  if (!userId) {
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", subscription.customer)
      .maybeSingle<{ user_id: string }>()
    userId = data?.user_id ?? null
  }
  if (!userId) throw new Error("Could not match Stripe subscription to a StoryTuner user.")

  const firstItem = subscription.items?.data?.[0]
  const periodEnd = subscription.current_period_end ?? firstItem?.current_period_end
  const { error } = await admin.from("subscriptions").upsert({
    user_id: userId,
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    stripe_price_id: firstItem?.price?.id ?? null,
    status: subscription.status,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  }, { onConflict: "user_id" })
  if (error) throw error
}
