import type { SupabaseClient } from "@supabase/supabase-js"
import { getModeratorContext } from "@/lib/community/moderation"
import type {
  ModerationReportItem,
  ModerationReportStatus,
  ModerationReportsResponse,
} from "@/lib/admin/community-types"
import type { CommunityReportReason } from "@/lib/community/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type ReportRow = {
  id: string
  reporter_id: string | null
  source: "user" | "ai"
  post_id: string | null
  reply_id: string | null
  reason: CommunityReportReason
  details: string | null
  status: ModerationReportStatus
  created_at: string
  reviewed_at: string | null
  resolution_note: string | null
  ai_model: string | null
  ai_top_category: string | null
  ai_top_score: number | null
  ai_recommended_action: string | null
}
type ProfileRow = { id: string; username: string; display_name: string }
type PostRow = { id: string; author_id: string; body: string; status: string }
type ReplyRow = { id: string; post_id: string; author_id: string; body: string; status: string }
type ModerationStatusRow = {
  user_id: string
  account_status: "active" | "suspended" | "banned"
  account_suspended_until: string | null
  community_suspended_until: string | null
}
type ContentOwnerRow = { id: string; author_id: string }
type ActionRow = {
  user_id: string
  report_id: string | null
  action_type: string
  duration_days: number | null
  note: string | null
  created_at: string
}
type ReportTargetRow = { post_id: string | null; reply_id: string | null }

const reportStatuses: ModerationReportStatus[] = ["open", "reviewing", "resolved", "dismissed"]
const allowedStatuses = new Set<ModerationReportStatus>(reportStatuses)

export async function GET(request: Request) {
  const context = await getModeratorContext()
  if (!context.ok) return context.response

  const requested = new URL(request.url).searchParams.get("status") as ModerationReportStatus | null
  const status = requested && allowedStatuses.has(requested) ? requested : "open"

  const reportsResult = await context.admin
    .from("community_reports")
    .select("id, reporter_id, source, post_id, reply_id, reason, details, status, created_at, reviewed_at, resolution_note, ai_model, ai_top_category, ai_top_score, ai_recommended_action")
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(100)
    .returns<ReportRow[]>()

  if (reportsResult.error) {
    console.error("Moderation reports loading failed", reportsResult.error)
    return Response.json({ error: "Reports could not be loaded." }, { status: 500 })
  }

  const rows: ReportRow[] = reportsResult.data ?? []
  const postIds = rows.flatMap((row: ReportRow) => (row.post_id ? [row.post_id] : []))
  const replyIds = rows.flatMap((row: ReportRow) => (row.reply_id ? [row.reply_id] : []))

  const [postsResult, repliesResult, countPairs] = await Promise.all([
    postIds.length
      ? context.admin
          .from("community_posts")
          .select("id, author_id, body, status")
          .in("id", postIds)
          .returns<PostRow[]>()
      : Promise.resolve({ data: [] as PostRow[], error: null }),
    replyIds.length
      ? context.admin
          .from("community_replies")
          .select("id, post_id, author_id, body, status")
          .in("id", replyIds)
          .returns<ReplyRow[]>()
      : Promise.resolve({ data: [] as ReplyRow[], error: null }),
    Promise.all(reportStatuses.map(async (item): Promise<readonly [ModerationReportStatus, number]> => {
      const { count } = await context.admin
        .from("community_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", item)
      return [item, count ?? 0] as const
    })),
  ])

  if (postsResult.error || repliesResult.error) {
    console.error("Moderation content lookup failed", postsResult.error || repliesResult.error)
  }

  const postRows: PostRow[] = postsResult.data ?? []
  const replyRows: ReplyRow[] = repliesResult.data ?? []
  const posts = new Map<string, PostRow>(postRows.map((row: PostRow) => [row.id, row]))
  const replies = new Map<string, ReplyRow>(replyRows.map((row: ReplyRow) => [row.id, row]))

  const targetUserIds = Array.from(new Set(rows.flatMap((row: ReportRow) => {
    const post = row.post_id ? posts.get(row.post_id) : null
    const reply = row.reply_id ? replies.get(row.reply_id) : null
    const authorId = post?.author_id ?? reply?.author_id
    return authorId ? [authorId] : []
  })))
  const profileIds = Array.from(new Set([
    ...targetUserIds,
    ...rows.flatMap((row: ReportRow) => row.reporter_id ? [row.reporter_id] : []),
  ]))

  const [profilesResult, statusesResult, actionsResult] = await Promise.all([
    profileIds.length
      ? context.admin
          .from("profiles")
          .select("id, username, display_name")
          .in("id", profileIds)
          .returns<ProfileRow[]>()
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    targetUserIds.length
      ? context.admin
          .from("community_moderation_status")
          .select("user_id, account_status, account_suspended_until, community_suspended_until")
          .in("user_id", targetUserIds)
          .returns<ModerationStatusRow[]>()
      : Promise.resolve({ data: [] as ModerationStatusRow[], error: null }),
    targetUserIds.length
      ? context.admin
          .from("community_moderation_actions")
          .select("user_id, report_id, action_type, duration_days, note, created_at")
          .in("user_id", targetUserIds)
          .returns<ActionRow[]>()
      : Promise.resolve({ data: [] as ActionRow[], error: null }),
  ])

  if (profilesResult.error) console.error("Moderation profile lookup failed", profilesResult.error)
  if (statusesResult.error) console.error("Moderation status lookup failed", statusesResult.error)
  if (actionsResult.error) console.error("Moderation action lookup failed", actionsResult.error)

  const profileRows: ProfileRow[] = profilesResult.data ?? []
  const statusRows: ModerationStatusRow[] = statusesResult.data ?? []
  const actionRows: ActionRow[] = actionsResult.data ?? []
  const profiles = new Map<string, ProfileRow>(profileRows.map((row: ProfileRow) => [row.id, row]))
  const statuses = new Map<string, ModerationStatusRow>(statusRows.map((row: ModerationStatusRow) => [row.user_id, row]))
  const priorReportCounts = await loadPriorReportCounts(context.admin, targetUserIds)
  const priorActionCounts = new Map<string, number>()
  const actionsByReport = new Map<string, ActionRow[]>()

  for (const action of actionRows) {
    priorActionCounts.set(action.user_id, (priorActionCounts.get(action.user_id) ?? 0) + 1)
    if (action.report_id) {
      const bucket = actionsByReport.get(action.report_id) ?? []
      bucket.push(action)
      actionsByReport.set(action.report_id, bucket)
    }
  }

  const safeReports: ModerationReportItem[] = []
  for (const report of rows) {
    const post = report.post_id ? posts.get(report.post_id) : null
    const reply = report.reply_id ? replies.get(report.reply_id) : null
    const targetId = post?.author_id ?? reply?.author_id
    if (!targetId) continue

    const targetProfile = profiles.get(targetId)
    const reporterProfile = report.reporter_id ? profiles.get(report.reporter_id) : undefined
    const moderationStatus = statuses.get(targetId)

    safeReports.push({
      id: report.id,
      reason: report.reason,
      details: report.details,
      status: report.status,
      createdAt: report.created_at,
      reviewedAt: report.reviewed_at,
      resolutionNote: report.resolution_note,
      source: report.source,
      reporter: report.reporter_id ? {
        id: report.reporter_id,
        username: reporterProfile?.username ?? "unknown_reporter",
      } : null,
      ai: report.source === "ai" ? {
        model: report.ai_model,
        topCategory: report.ai_top_category,
        topScore: report.ai_top_score,
        recommendedAction: report.ai_recommended_action,
      } : null,
      targetUser: {
        id: targetId,
        username: targetProfile?.username ?? `member_${targetId.slice(0, 6)}`,
        displayName: targetProfile?.display_name ?? "StoryTuner member",
        accountStatus: moderationStatus?.account_status ?? "active",
        accountSuspendedUntil: moderationStatus?.account_suspended_until ?? null,
        communitySuspendedUntil: moderationStatus?.community_suspended_until ?? null,
        priorReports: priorReportCounts.get(targetId) ?? 0,
        priorActions: priorActionCounts.get(targetId) ?? 0,
      },
      content: post
        ? { kind: "post", id: post.id, body: post.body, status: post.status, postId: null }
        : {
            kind: "reply",
            id: reply!.id,
            body: reply!.body,
            status: reply!.status,
            postId: reply!.post_id,
          },
      actions: (actionsByReport.get(report.id) ?? [])
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((action) => ({
          actionType: action.action_type,
          durationDays: action.duration_days,
          note: action.note,
          createdAt: action.created_at,
        })),
    })
  }

  const counts = Object.fromEntries(countPairs) as ModerationReportsResponse["counts"]
  return Response.json(
    { reports: safeReports, counts },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}

async function loadPriorReportCounts(
  admin: SupabaseClient,
  userIds: string[],
) {
  const counts = new Map<string, number>()
  if (userIds.length === 0) return counts

  const [postsResult, repliesResult] = await Promise.all([
    admin
      .from("community_posts")
      .select("id, author_id")
      .in("author_id", userIds)
      .returns<ContentOwnerRow[]>(),
    admin
      .from("community_replies")
      .select("id, author_id")
      .in("author_id", userIds)
      .returns<ContentOwnerRow[]>(),
  ])

  const postOwners = new Map<string, string>((postsResult.data ?? []).map((item: ContentOwnerRow) => [item.id, item.author_id]))
  const replyOwners = new Map<string, string>((repliesResult.data ?? []).map((item: ContentOwnerRow) => [item.id, item.author_id]))
  const targetPostIds = Array.from(postOwners.keys())
  const targetReplyIds = Array.from(replyOwners.keys())
  const reportRows: ReportTargetRow[] = []

  if (targetPostIds.length > 0) {
    const result = await admin
      .from("community_reports")
      .select("post_id, reply_id")
      .in("post_id", targetPostIds)
      .returns<ReportTargetRow[]>()
    reportRows.push(...(result.data ?? []))
  }
  if (targetReplyIds.length > 0) {
    const result = await admin
      .from("community_reports")
      .select("post_id, reply_id")
      .in("reply_id", targetReplyIds)
      .returns<ReportTargetRow[]>()
    reportRows.push(...(result.data ?? []))
  }

  for (const report of reportRows) {
    const userId = report.post_id
      ? postOwners.get(report.post_id)
      : report.reply_id
        ? replyOwners.get(report.reply_id)
        : null
    if (userId) counts.set(userId, (counts.get(userId) ?? 0) + 1)
  }

  return counts
}
