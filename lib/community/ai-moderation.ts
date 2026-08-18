import type { SupabaseClient } from "@supabase/supabase-js"
import type { CommunityReportReason } from "@/lib/community/types"
import { backendError, backendLog } from "@/lib/backend-log"

const DEFAULT_MODEL = "omni-moderation-latest"

export type CommunityAiModerationResult = {
  model: string
  flagged: boolean
  categories: Record<string, boolean>
  categoryScores: Record<string, number>
  topCategory: string | null
  topScore: number | null
  reason: CommunityReportReason
  recommendedAction: string
}

type ModerationApiResult = {
  flagged?: boolean
  categories?: Record<string, boolean>
  category_scores?: Record<string, number>
}

type ModerationApiResponse = {
  model?: string
  results?: ModerationApiResult[]
  error?: { message?: string }
}

function openAiKey() {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error("OPENAI_API_KEY is not configured")
  return key
}

function moderationReason(category: string | null): CommunityReportReason {
  if (!category) return "other"
  if (category.startsWith("harassment")) return "harassment"
  if (category.startsWith("hate")) return "hate"
  if (category.startsWith("sexual")) return "sexual_content"
  if (category.startsWith("self-harm")) return "self_harm"
  if (category.startsWith("violence") || category.startsWith("illicit/violent")) return "violence"
  return "other"
}

function recommendation(categories: Record<string, boolean>, topCategory: string | null) {
  const flaggedCategories = Object.entries(categories)
    .filter(([, flagged]) => flagged)
    .map(([name]) => name)

  const has = (name: string) => flaggedCategories.includes(name)
  const severeThreat =
    has("harassment/threatening") ||
    has("hate/threatening") ||
    has("sexual/minors") ||
    has("violence/graphic") ||
    has("illicit/violent")

  if (severeThreat) return "Keep content hidden and review for a 7-day Community suspension."

  const selfHarm = flaggedCategories.some((name) => name.startsWith("self-harm"))
  if (selfHarm) return "Keep content hidden and review manually. Do not punish the member automatically."

  if (flaggedCategories.length > 0) return "Keep content hidden and review whether a warning is appropriate."
  if (topCategory) return `Review manually. Highest moderation signal: ${topCategory}.`
  return "Review manually."
}

export async function moderateCommunityText(input: string): Promise<CommunityAiModerationResult> {
  const model = process.env.OPENAI_MODERATION_MODEL || DEFAULT_MODEL
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input }),
      signal: controller.signal,
      cache: "no-store",
    })

    const data = (await response.json().catch(() => ({}))) as ModerationApiResponse
    if (!response.ok) throw new Error(data.error?.message || "OpenAI moderation request failed")

    const result = data.results?.[0]
    if (!result) throw new Error("OpenAI moderation returned no result")

  const categories = Object.fromEntries(
    Object.entries(result.categories ?? {}).map(([key, value]) => [key, Boolean(value)]),
  )
  const categoryScores = Object.fromEntries(
    Object.entries(result.category_scores ?? {}).map(([key, value]) => [key, Number(value) || 0]),
  )
  const topEntry = Object.entries(categoryScores).sort((a, b) => b[1] - a[1])[0]
  const topCategory = topEntry?.[0] ?? null
  const topScore = topEntry?.[1] ?? null
  const topFlaggedCategory = Object.entries(categoryScores)
    .filter(([name]) => categories[name])
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    const moderation = {
      model: data.model || model,
      flagged: Boolean(result.flagged),
      categories,
      categoryScores,
      topCategory,
      topScore,
      reason: moderationReason(topFlaggedCategory ?? topCategory),
      recommendedAction: recommendation(categories, topCategory),
    }
    backendLog("info", "community_ai_moderation_completed", {
      model: moderation.model,
      flagged: moderation.flagged,
      topCategory: moderation.topCategory,
      durationMs: Date.now() - startedAt,
      inputChars: input.length,
    })
    return moderation
  } catch (error) {
    backendError("community_ai_moderation_failed", error, { model, durationMs: Date.now() - startedAt, inputChars: input.length })
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function createAiModerationReport({
  admin,
  userId,
  postId,
  replyId,
  moderation,
}: {
  admin: SupabaseClient
  userId: string
  postId?: string | null
  replyId?: string | null
  moderation: CommunityAiModerationResult
}) {
  if (!moderation.flagged) return

  const topScoreText = moderation.topScore == null
    ? ""
    : ` Highest score: ${moderation.topCategory ?? "unknown"} (${Math.round(moderation.topScore * 100)}%).`
  const details = `Automatically held by Tellwise AI moderation.${topScoreText}`.slice(0, 1000)

  const { error } = await admin.from("community_reports").insert({
    reporter_id: null,
    source: "ai",
    post_id: postId ?? null,
    reply_id: replyId ?? null,
    reason: moderation.reason,
    details,
    status: "open",
    ai_model: moderation.model,
    ai_flagged: true,
    ai_categories: moderation.categories,
    ai_category_scores: moderation.categoryScores,
    ai_top_category: moderation.topCategory,
    ai_top_score: moderation.topScore,
    ai_recommended_action: moderation.recommendedAction,
  })

  if (error) throw error

  // userId is intentionally accepted here so callers must explicitly identify
  // whose content was screened, even though the report row already points to it.
  void userId
}

export const COMMUNITY_AI_HOLD_MESSAGE =
  "Tellwise's safety check held this for moderator review. It is not visible to other members right now."
