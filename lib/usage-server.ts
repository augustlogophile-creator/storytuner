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
