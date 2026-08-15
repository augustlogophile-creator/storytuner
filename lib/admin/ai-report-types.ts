export type AiResponseReportStatus = "open" | "reviewed" | "dismissed" | "actioned"
export type AiResponseReportSurface = "coach" | "practice" | "check" | "studio" | "planner" | "other"

export type AiResponseReportItem = {
  id: string
  reporterId: string
  reporterUsername: string
  reporterDisplayName: string
  surface: AiResponseReportSurface
  responseText: string
  reason: string
  responseId: string | null
  lessonId: string | null
  recordingId: string | null
  conversationId: string | null
  status: AiResponseReportStatus
  adminNote: string | null
  createdAt: string
  reviewedAt: string | null
}

export type AiResponseReportsResponse = {
  reports: AiResponseReportItem[]
  counts: Record<AiResponseReportStatus, number>
}
