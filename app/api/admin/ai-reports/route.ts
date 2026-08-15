import { backendError } from "@/lib/backend-log"
import type { AiResponseReportItem, AiResponseReportsResponse, AiResponseReportStatus, AiResponseReportSurface } from "@/lib/admin/ai-report-types"
import { getModeratorContext } from "@/lib/community/moderation"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const statuses: AiResponseReportStatus[] = ["open", "reviewed", "dismissed", "actioned"]
const allowedStatuses = new Set<AiResponseReportStatus>(statuses)

type ReportRow = {
  id: string
  reporter_id: string
  surface: AiResponseReportSurface
  response_text: string
  reason: string
  response_id: string | null
  lesson_id: string | null
  recording_id: string | null
  conversation_id: string | null
  status: AiResponseReportStatus
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
}

type ProfileRow = { id: string; username: string; display_name: string }

export async function GET(request: Request) {
  const context = await getModeratorContext()
  if (!context.ok) return context.response

  const requested = new URL(request.url).searchParams.get("status") as AiResponseReportStatus | null
  const status = requested && allowedStatuses.has(requested) ? requested : "open"

  const [reportsResult, countPairs] = await Promise.all([
    context.admin
      .from("ai_response_reports")
      .select("id, reporter_id, surface, response_text, reason, response_id, lesson_id, recording_id, conversation_id, status, admin_note, created_at, reviewed_at")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<ReportRow[]>(),
    Promise.all(statuses.map(async (item): Promise<readonly [AiResponseReportStatus, number]> => {
      const { count } = await context.admin
        .from("ai_response_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", item)
      return [item, count ?? 0] as const
    })),
  ])

  if (reportsResult.error) {
    backendError("ai_response_reports_admin_load_failed", reportsResult.error, { adminId: context.userId, status })
    return Response.json({ error: "AI reports could not be loaded." }, { status: 500 })
  }

  const rows = reportsResult.data ?? []
  const reporterIds = Array.from(new Set(rows.map((row) => row.reporter_id)))
  const profilesResult = reporterIds.length
    ? await context.admin
        .from("profiles")
        .select("id, username, display_name")
        .in("id", reporterIds)
        .returns<ProfileRow[]>()
    : { data: [] as ProfileRow[], error: null }

  if (profilesResult.error) {
    backendError("ai_response_reports_profile_lookup_failed", profilesResult.error, { adminId: context.userId })
  }

  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]))
  const reports: AiResponseReportItem[] = rows.map((row) => {
    const profile = profiles.get(row.reporter_id)
    return {
      id: row.id,
      reporterId: row.reporter_id,
      reporterUsername: profile?.username ?? `member_${row.reporter_id.slice(0, 6)}`,
      reporterDisplayName: profile?.display_name ?? "StoryTuner member",
      surface: row.surface,
      responseText: row.response_text,
      reason: row.reason,
      responseId: row.response_id,
      lessonId: row.lesson_id,
      recordingId: row.recording_id,
      conversationId: row.conversation_id,
      status: row.status,
      adminNote: row.admin_note,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
    }
  })

  const counts = Object.fromEntries(countPairs) as AiResponseReportsResponse["counts"]
  return Response.json({ reports, counts }, { headers: { "Cache-Control": "private, no-store" } })
}
