import { backendError } from "@/lib/backend-log"
import { getModeratorContext } from "@/lib/community/moderation"
import { runStoryTunerMaintenance } from "@/lib/maintenance"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

type RecordingFailure = {
  id: string
  user_id: string
  status: string
  error_message: string | null
  updated_at: string
}

type RestrictionRow = {
  user_id: string
  account_status: "active" | "suspended" | "banned"
  account_suspended_until: string | null
  community_suspended_until: string | null
}

export async function GET() {
  const context = await getModeratorContext()
  if (!context.ok) return context.response

  const now = Date.now()
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const staleCutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString()

  try {
    const [
      failedRecordings,
      staleRecordings,
      openReports,
      actionsToday,
      coachToday,
      arenaToday,
      plansToday,
      postsToday,
      repliesToday,
      activeMembers,
      restrictionRowsResult,
      staleCommunityAudio,
      recentFailures,
    ] = await Promise.all([
      count(context.admin.from("recording_uploads").select("id", { count: "exact", head: true }).eq("status", "failed").gte("updated_at", weekAgo)),
      count(context.admin.from("recording_uploads").select("id", { count: "exact", head: true }).in("status", ["uploading", "uploaded", "transcribing", "failed"]).lt("updated_at", staleCutoff)),
      count(context.admin.from("community_reports").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"])),
      count(context.admin.from("community_moderation_actions").select("id", { count: "exact", head: true }).gte("created_at", dayAgo)),
      count(context.admin.from("user_usage_events").select("id", { count: "exact", head: true }).eq("feature", "coach_message").gte("created_at", dayAgo)),
      count(context.admin.from("user_usage_events").select("id", { count: "exact", head: true }).eq("feature", "arena_review").gte("created_at", dayAgo)),
      count(context.admin.from("story_plans").select("id", { count: "exact", head: true }).gte("created_at", dayAgo)),
      count(context.admin.from("community_posts").select("id", { count: "exact", head: true }).gte("created_at", dayAgo)),
      count(context.admin.from("community_replies").select("id", { count: "exact", head: true }).gte("created_at", dayAgo)),
      count(context.admin.from("subscriptions").select("user_id", { count: "exact", head: true }).in("status", ["active", "trialing"])),
      context.admin.from("community_moderation_status").select("user_id,account_status,account_suspended_until,community_suspended_until").limit(5000).returns<RestrictionRow[]>(),
      count(context.admin.from("community_audio").select("id", { count: "exact", head: true }).in("status", ["deleting", "failed"]).lt("created_at", staleCutoff)),
      context.admin
        .from("recording_uploads")
        .select("id,user_id,status,error_message,updated_at")
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(8)
        .returns<RecordingFailure[]>(),
    ])

    if (recentFailures.error) throw recentFailures.error
    if (restrictionRowsResult.error) throw restrictionRowsResult.error
    const restrictedAccounts = (restrictionRowsResult.data ?? []).filter((row) => {
      if (row.account_status === "banned") return true
      if (row.account_status === "suspended") {
        return !row.account_suspended_until || new Date(row.account_suspended_until).getTime() > now
      }
      return Boolean(row.community_suspended_until && new Date(row.community_suspended_until).getTime() > now)
    }).length

    return Response.json({
      generatedAt: new Date().toISOString(),
      configuration: {
        openAI: Boolean(process.env.OPENAI_API_KEY),
        supabaseAdmin: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL),
        stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      },
      metrics: {
        failedRecordings7d: failedRecordings,
        staleRecordings,
        staleCommunityAudio,
        openReports,
        moderationActions24h: actionsToday,
        coachMessages24h: coachToday,
        arenaReviews24h: arenaToday,
        storyPlans24h: plansToday,
        communityPosts24h: postsToday,
        communityReplies24h: repliesToday,
        activeMembers,
        restrictedAccounts,
      },
      recentRecordingFailures: (recentFailures.data ?? []).map((row) => ({
        id: row.id,
        user: `${row.user_id.slice(0, 8)}…`,
        status: row.status,
        error: row.error_message || "No error message saved",
        updatedAt: row.updated_at,
      })),
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    backendError("admin_system_load_failed", error, { adminId: context.userId })
    return Response.json({ error: "System status could not be loaded." }, { status: 500 })
  }
}

export async function POST() {
  const context = await getModeratorContext()
  if (!context.ok) return context.response
  try {
    const result = await runStoryTunerMaintenance()
    return Response.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("admin_manual_maintenance_failed", error, { adminId: context.userId })
    return Response.json({ error: "Maintenance could not finish." }, { status: 500 })
  }
}

async function count(query: PromiseLike<any>) {
  const result = await query
  if (result.error) throw result.error
  return Math.max(0, result.count ?? 0)
}
