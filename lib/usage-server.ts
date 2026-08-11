import { createAdminClient } from "@/lib/supabase/admin"

export type UsageFeature = "coach_message" | "arena_review"

export const USAGE_LIMITS: Record<UsageFeature, number> = {
  coach_message: 5,
  arena_review: 2,
}

export type UsageStatus = {
  used: number
  limit: number
  remaining: number
}

export type UsageReservation = UsageStatus & {
  allowed: boolean
  alreadyReserved: boolean
}

export async function getUsageStatus(userId: string, feature: UsageFeature): Promise<UsageStatus> {
  const admin = createAdminClient()
  const { count, error } = await admin
    .from("user_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", feature)

  if (error) throw error
  const limit = USAGE_LIMITS[feature]
  const used = Math.max(0, count ?? 0)
  return { used, limit, remaining: Math.max(0, limit - used) }
}

export async function reserveUsage(
  userId: string,
  feature: UsageFeature,
  requestKey: string,
): Promise<UsageReservation> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("reserve_storytuner_usage", {
    p_user_id: userId,
    p_feature: feature,
    p_request_key: requestKey,
  })
  if (error) throw error

  const value = (data ?? {}) as Record<string, unknown>
  const limit = Number(value.limit ?? USAGE_LIMITS[feature])
  const used = Number(value.used ?? 0)
  return {
    allowed: Boolean(value.allowed),
    alreadyReserved: Boolean(value.alreadyReserved),
    used,
    limit,
    remaining: Number(value.remaining ?? Math.max(0, limit - used)),
  }
}

export async function releaseUsage(userId: string, feature: UsageFeature, requestKey: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from("user_usage_events")
    .delete()
    .eq("user_id", userId)
    .eq("feature", feature)
    .eq("request_key", requestKey)
  if (error) throw error
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function recordUsageEvent(userId: string, feature: UsageFeature, requestKey: string) {
  const admin = createAdminClient()
  const { error } = await admin.from("user_usage_events").upsert({
    user_id: userId,
    feature,
    request_key: requestKey,
  }, { onConflict: "user_id,feature,request_key", ignoreDuplicates: true })
  if (error) throw error
}

export async function getRecentUsageCount(userId: string, feature: UsageFeature, since: Date) {
  const admin = createAdminClient()
  const { count, error } = await admin
    .from("user_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", feature)
    .gte("created_at", since.toISOString())
  if (error) throw error
  return Math.max(0, count ?? 0)
}

export async function enforceDurableUsageRate(
  userId: string,
  feature: UsageFeature,
  rules: Array<{ limit: number; windowMs: number; label: string }>,
) {
  const now = Date.now()
  for (const rule of rules) {
    const count = await getRecentUsageCount(userId, feature, new Date(now - rule.windowMs))
    if (count > rule.limit) {
      return { allowed: false as const, label: rule.label }
    }
  }
  return { allowed: true as const, label: null }
}
