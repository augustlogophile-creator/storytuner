import { createAdminClient } from "@/lib/supabase/admin"

export type SubscriptionRow = {
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  status: string
  cancel_at_period_end: boolean
  current_period_end: string | null
}

export function isMembershipActive(row: SubscriptionRow | null | undefined) {
  if (!row || !["active", "trialing"].includes(row.status)) return false
  if (!row.current_period_end) return true
  return new Date(row.current_period_end).getTime() > Date.now()
}

export async function getSubscriptionByUserId(userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("subscriptions")
    .select("user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, cancel_at_period_end, current_period_end")
    .eq("user_id", userId)
    .maybeSingle<SubscriptionRow>()
  if (error) throw error
  return data ?? null
}

export async function getMembershipByUserId(userId: string) {
  const subscription = await getSubscriptionByUserId(userId)
  return { active: isMembershipActive(subscription), subscription }
}
