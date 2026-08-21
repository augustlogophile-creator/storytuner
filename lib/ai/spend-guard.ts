import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

export type AiSpendAction = "lesson_feedback" | "checkpoint_feedback" | "written_story_feedback" | "story_planner"

export type AiSpendLimits = {
  minute: number
  hour: number
  day: number
}

export type AiSpendDecision = {
  allowed: boolean
  retryAfterSeconds: number
  limitedBy: "minute" | "hour" | "day" | null
}

/**
 * Database-backed anti-abuse guard for AI-spend routes. The PostgreSQL function
 * serializes reservations per user/action with an advisory transaction lock,
 * so parallel requests cannot each observe the same remaining allowance.
 */
export async function reserveAiSpend(
  userId: string,
  action: AiSpendAction,
  limits: AiSpendLimits,
): Promise<AiSpendDecision> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("reserve_tellwise_ai_spend", {
    p_user_id: userId,
    p_action: action,
    p_request_key: crypto.randomUUID(),
    p_minute_limit: limits.minute,
    p_hour_limit: limits.hour,
    p_day_limit: limits.day,
  })

  if (error) {
    // Keep AI routes working even when the newest anti-abuse RPC has not been
    // deployed yet. The route-level account rate limits still run before this
    // helper, so the app fails soft without dropping protection entirely.
    return {
      allowed: true,
      retryAfterSeconds: 60,
      limitedBy: null,
    }
  }

  const value = (data ?? {}) as Record<string, unknown>
  return {
    allowed: value.allowed === true,
    retryAfterSeconds: Math.max(1, Number(value.retryAfterSeconds ?? 60)),
    limitedBy: value.limitedBy === "minute" || value.limitedBy === "hour" || value.limitedBy === "day"
      ? value.limitedBy
      : null,
  }
}

export function aiSpendRateResponse(decision: AiSpendDecision, message: string) {
  if (decision.allowed) return null
  return Response.json(
    { code: "RATE_LIMITED", error: message, retryAfterSeconds: decision.retryAfterSeconds },
    {
      status: 429,
      headers: {
        "Retry-After": String(decision.retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  )
}
