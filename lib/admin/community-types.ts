import type { CommunityReportReason } from "@/lib/community/types"

export type ModerationAccountStatus = "active" | "suspended" | "banned"
export type ModerationReportStatus = "open" | "reviewing" | "resolved" | "dismissed"

export type ModerationActionHistoryItem = {
  actionType: string
  durationDays: number | null
  note: string | null
  createdAt: string
}

export type ModerationReportItem = {
  id: string
  reason: CommunityReportReason
  details: string | null
  status: ModerationReportStatus
  createdAt: string
  reviewedAt: string | null
  resolutionNote: string | null
  reporter: { id: string; username: string }
  targetUser: {
    id: string
    username: string
    displayName: string
    accountStatus: ModerationAccountStatus
    accountSuspendedUntil: string | null
    communitySuspendedUntil: string | null
    priorReports: number
    priorActions: number
  }
  content: {
    kind: "post" | "reply"
    id: string
    body: string
    status: string
    postId: string | null
  }
  actions: ModerationActionHistoryItem[]
}

export type ModerationReportsResponse = {
  reports: ModerationReportItem[]
  counts: Record<ModerationReportStatus, number>
}

export type ModerationAction =
  | "dismiss"
  | "hide"
  | "warn"
  | "suspend_community"
  | "suspend_account"
  | "ban_account"
  | "clear_restrictions"
  | "restore_content"
  | "reopen"
  | "revise"
