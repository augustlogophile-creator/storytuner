import { z } from "zod"
import { getSubscriptionByUserId, isMembershipActive } from "@/lib/membership-server"
import { getActiveAuthenticatedUser } from "@/lib/require-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { stripePost } from "@/lib/stripe-rest"
import { backendError, backendLog } from "@/lib/backend-log"
import { readJsonBody, rejectLargeRequest, requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"
import { siteUrl } from "@/lib/auth/redirects"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type CheckoutSession = { id: string; url: string | null; customer: string | null }
type StripeCustomer = { id: string }

const checkoutSchema = z.object({ renewalConsent: z.literal(true) }).strict()

export async function POST(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite
  const auth = await getActiveAuthenticatedUser()
  if (!auth.ok) return auth.response
  const user = auth.user

  const oversized = rejectLargeRequest(request, 5_000)
  if (oversized) return oversized
  const body = await readJsonBody(request, 5_000)
  if (!body.ok) return body.response
  const parsed = checkoutSchema.safeParse(body.value)
  if (!parsed.success) {
    return Response.json({ error: "Confirm the automatic-renewal terms before starting checkout." }, { status: 400 })
  }

  const limited = rateLimitResponse(rateLimitUser(user.id, "stripe_checkout", [{ limit: 4, windowMs: 10 * 60 * 1000, label: "4/10m" }]), "Too many checkout attempts. Wait a few minutes and try again.")
  if (limited) return limited

  try {
    const existing = await getSubscriptionByUserId(user.id)
    if (isMembershipActive(existing)) {
      return Response.json({ error: "Membership is already active.", code: "ALREADY_ACTIVE" }, { status: 409 })
    }

    const priceId = process.env.STRIPE_PRICE_ID?.trim()
    if (!priceId) throw new Error("STRIPE_PRICE_ID is missing.")

    const origin = siteUrl()
    const email = typeof user.claims.email === "string" ? user.claims.email : undefined
    let customerId = existing?.stripe_customer_id ?? null

    if (!customerId) {
      const customer = await stripePost<StripeCustomer>("/customers", {
        email,
        "metadata[supabase_user_id]": user.id,
      }, { idempotencyKey: `storytuner-customer-${user.id}` })
      customerId = customer.id
      const admin = createAdminClient()
      const { error } = await admin.from("subscriptions").upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        status: "inactive",
      }, { onConflict: "user_id" })
      if (error) throw error
    }

    const consentedAt = new Date().toISOString()
    const consentVersion = "annual-auto-renew-v1"
    const consentSummary = "$11.99/year billed annually; auto-renews yearly until canceled; online cancellation available."

    // Keep the consent on Stripe objects even if the optional local compliance
    // ledger migration has not been applied yet.
    const session = await stripePost<CheckoutSession>("/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": 1,
      success_url: `${origin}/membership?checkout=success`,
      cancel_url: `${origin}/membership?checkout=cancelled`,
      client_reference_id: user.id,
      "metadata[supabase_user_id]": user.id,
      "metadata[renewal_consent_version]": consentVersion,
      "metadata[renewal_consent_at]": consentedAt,
      "subscription_data[metadata][supabase_user_id]": user.id,
      "subscription_data[metadata][renewal_consent_version]": consentVersion,
      "subscription_data[metadata][renewal_consent_at]": consentedAt,
      allow_promotion_codes: true,
    })

    if (!session.url) throw new Error("Stripe did not return a checkout URL.")

    try {
      const admin = createAdminClient()
      const { error: consentError } = await admin.from("subscription_consent_records").insert({
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_checkout_session_id: session.id,
        consent_version: consentVersion,
        consent_summary: consentSummary,
        consented_at: consentedAt,
        retain_until: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
      if (consentError) backendError("stripe_consent_ledger_write_failed", consentError, { userId: user.id, checkoutSessionId: session.id })
    } catch (consentError) {
      backendError("stripe_consent_ledger_unavailable", consentError, { userId: user.id, checkoutSessionId: session.id })
    }

    backendLog("info", "stripe_checkout_created", { userId: user.id, customerId, consentVersion, consentedAt })
    return Response.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("stripe_checkout_failed", error, { userId: user.id })
    return Response.json({ error: "StoryTuner could not start checkout right now. Try again in a moment." }, { status: 502, headers: { "Cache-Control": "no-store" } })
  }
}
