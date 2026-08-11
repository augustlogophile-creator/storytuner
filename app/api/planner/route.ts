import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { openAIJson } from "@/lib/openai-server"
import { getMembershipByUserId } from "@/lib/membership-server"
import { getAccountRestriction, getAuthenticatedUser } from "@/lib/require-auth"
import type { StoryPlanOutput, StoryPlanRecord } from "@/lib/planner/types"
import { rateLimitResponse, rateLimitUser, rejectLargeRequest, requestFingerprint, runIdempotent } from "@/lib/request-protection"
import { backendError } from "@/lib/backend-log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const inputSchema = z.object({
  audienceContext: z.string().trim().min(3, "Describe where or to whom you will tell the story.").max(1000),
  goal: z.string().trim().min(3, "Describe what you hope the listener understands or feels.").max(1500),
  roughPlan: z.string().trim().min(10, "Give Weaver a basic sequence of what happens.").max(5000),
  mustInclude: z.string().trim().max(3000).default(""),
  nervousAbout: z.string().trim().max(2000).default(""),
})

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "throughline", "opening", "beats", "ending", "keep", "clarify", "deliveryTips", "revisedPlan", "reassurance"],
  properties: {
    title: { type: "string" },
    throughline: { type: "string" },
    opening: { type: "string" },
    beats: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "purpose", "suggestion"],
        properties: {
          label: { type: "string" },
          purpose: { type: "string" },
          suggestion: { type: "string" },
        },
      },
    },
    ending: { type: "string" },
    keep: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
    clarify: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
    deliveryTips: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
    revisedPlan: { type: "string" },
    reassurance: { type: "string" },
  },
} as const

type PlanRow = {
  id: string
  audience_context: string
  goal: string
  rough_plan: string
  must_include: string
  nervous_about: string
  output: StoryPlanOutput
  created_at: string
}

function toRecord(row: PlanRow): StoryPlanRecord {
  return {
    id: row.id,
    audienceContext: row.audience_context,
    goal: row.goal,
    roughPlan: row.rough_plan,
    mustInclude: row.must_include,
    nervousAbout: row.nervous_about,
    output: row.output,
    createdAt: row.created_at,
  }
}

async function activeMember() {
  const user = await getAuthenticatedUser()
  if (!user) return { ok: false as const, response: Response.json({ error: "Authentication required." }, { status: 401 }) }
  const restriction = await getAccountRestriction(user.id)
  if (restriction.restricted) {
    return { ok: false as const, response: Response.json({ error: restriction.publicMessage || "This account is currently restricted." }, { status: 403 }) }
  }
  const membership = await getMembershipByUserId(user.id)
  if (!membership.active) {
    return {
      ok: false as const,
      response: Response.json({
        code: "PLANNER_MEMBERSHIP_REQUIRED",
        error: "Story Planner is included with StoryTuner Membership.",
      }, { status: 403 }),
    }
  }
  return { ok: true as const, user }
}

export async function GET() {
  const auth = await activeMember()
  if (!auth.ok) return auth.response

  const { data, error } = await auth.user.supabase
    .from("story_plans")
    .select("id, audience_context, goal, rough_plan, must_include, nervous_about, output, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(8)
    .returns<PlanRow[]>()

  if (error) {
    backendError("planner_history_load_failed", error, { userId: auth.user.id })
    return Response.json({ error: "Your saved plans could not be loaded. Run the newest Supabase migration if this is the first time opening Story Planner." }, { status: 500 })
  }

  return Response.json({ plans: (data ?? []).map(toRecord) }, { headers: { "Cache-Control": "private, no-store" } })
}

export async function POST(request: Request) {
  const auth = await activeMember()
  if (!auth.ok) return auth.response

  const oversized = rejectLargeRequest(request, 40_000)
  if (oversized) return oversized
  const rate = rateLimitUser(auth.user.id, "planner", [
    { limit: 5, windowMs: 60_000, label: "5/min" },
    { limit: 20, windowMs: 60 * 60 * 1000, label: "20/hour" },
  ])
  const blocked = rateLimitResponse(rate, "Story Planner is receiving too many requests from this account. Wait a moment and try again.")
  if (blocked) return blocked

  const parsed = inputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message || "The story plan is incomplete." }, { status: 400 })
  }

  const admin = createAdminClient()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const { count, error: countError } = await admin
    .from("story_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id)
    .gte("created_at", today.toISOString())

  if (countError) {
    backendError("planner_usage_lookup_failed", countError, { userId: auth.user.id })
    return Response.json({ error: "Story Planner could not verify usage right now." }, { status: 500 })
  }
  if ((count ?? 0) >= 10) {
    return Response.json({ error: "You have used Story Planner ten times today. Come back tomorrow so Weaver can keep the feature reliable for everyone." }, { status: 429 })
  }

  const input = parsed.data
  try {
    const plannerFingerprint = requestFingerprint(auth.user.id, input.audienceContext, input.goal, input.roughPlan, input.mustInclude, input.nervousAbout)
    const output = await runIdempotent(`story-planner:${plannerFingerprint}`, () => openAIJson<StoryPlanOutput>({
      name: "storytuner_story_plan",
      schema: outputSchema,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: `You are Weaver, StoryTuner's expert story-planning coach. Help the user turn incomplete notes into a clear, tellable plan before they record or speak.

Rules:
- Preserve the user's facts, purpose, voice, and uncertainty. Never invent events, dialogue, motives, emotions, or outcomes.
- Plan the story, do not write a polished full story for them.
- Use StoryTuner craft when it helps: identify the one-sentence meaning, shape, personal stakes, change, scene, reflection, opening, and landing. Do not force a technique that does not fit.
- Give a concrete opening, a sequence of three to five beats, and a clean ending direction.
- Address what the user is nervous about with practical, calm delivery advice.
- Point out missing information as questions or clarification needs, not invented answers.
- Keep every section concise, specific, supportive, and usable immediately.
- The revisedPlan should be a first-person outline the user can rehearse from, not a finished script.`,
        },
        {
          role: "user",
          content: `AUDIENCE OR SITUATION:\n${input.audienceContext}\n\nWHAT I WANT TO GET ACROSS:\n${input.goal}\n\nMY BASIC PLAN OR SEQUENCE:\n${input.roughPlan}\n\nFACTS OR DETAILS I WANT TO INCLUDE:\n${input.mustInclude || "None supplied."}\n\nWHAT I AM NERVOUS OR UNCERTAIN ABOUT:\n${input.nervousAbout || "Nothing supplied."}`,
        },
      ],
    }), 90_000)

    const { data: inserted, error: insertError } = await admin
      .from("story_plans")
      .insert({
        user_id: auth.user.id,
        audience_context: input.audienceContext,
        goal: input.goal,
        rough_plan: input.roughPlan,
        must_include: input.mustInclude,
        nervous_about: input.nervousAbout,
        output,
      })
      .select("id, audience_context, goal, rough_plan, must_include, nervous_about, output, created_at")
      .single<PlanRow>()

    if (insertError) throw insertError
    return Response.json({ plan: toRecord(inserted) }, { status: 201, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("planner_route_failed", error, { userId: auth.user.id })
    const message = error instanceof Error && error.message.includes("OPENAI_API_KEY")
      ? "Weaver's AI connection is not configured yet."
      : "Weaver could not build the plan right now."
    return Response.json({ error: message }, { status: 500 })
  }
}
