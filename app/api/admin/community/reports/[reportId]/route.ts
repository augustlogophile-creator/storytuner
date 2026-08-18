import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { getModeratorContext } from "@/lib/community/moderation"
import { writeVerifiedModerationStatus } from "@/lib/community/moderation-status"
import { backendError, backendLog } from "@/lib/backend-log"
import type { ModerationAction } from "@/lib/admin/community-types"
import { readJsonBody, requireSameOrigin } from "@/lib/request-protection"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const paramsSchema = z.object({ reportId: z.string().uuid() }).strict()
const bodySchema = z.object({
  action: z.enum([
    "dismiss",
    "hide",
    "warn",
    "suspend_community",
    "suspend_account",
    "ban_account",
    "clear_restrictions",
    "restore_content",
    "reopen",
    "revise",
  ]),
  durationDays: z.number().int().min(1).max(3650).nullable().optional(),
  note: z.string().trim().max(2000).default(""),
  hideContent: z.boolean().default(false),
  restrictionAction: z.enum(["keep", "clear", "suspend_community", "suspend_account", "ban_account"]).optional(),
  contentAction: z.enum(["keep", "remove", "restore"]).optional(),
}).strict()

type RouteContext = { params: Promise<{ reportId: string }> }
type ReportRow = { id: string; post_id: string | null; reply_id: string | null; status: string; source: "user" | "ai" }
type TargetRow = { author_id: string; status: string }

function futureDate(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite
  const context = await getModeratorContext()
  if (!context.ok) return context.response

  const params = paramsSchema.safeParse(await routeContext.params)
  const json = await readJsonBody(request, 8_000)
  if (!json.ok) return json.response
  const body = bodySchema.safeParse(json.value)
  if (!params.success || !body.success) {
    return Response.json({ error: body.success ? "That report could not be found." : body.error.issues[0]?.message || "The moderation action is invalid." }, { status: 400 })
  }

  const { action, durationDays, note, hideContent, restrictionAction = "keep", contentAction = "keep" } = body.data
  const adminOnly = new Set<ModerationAction>(["suspend_account", "ban_account", "clear_restrictions"])
  if (adminOnly.has(action) && context.role !== "admin") {
    return Response.json({ error: "Only a Community admin can apply or clear full-account restrictions." }, { status: 403 })
  }

  const { data: report, error: reportError } = await context.admin
    .from("community_reports")
    .select("id, post_id, reply_id, status, source")
    .eq("id", params.data.reportId)
    .maybeSingle<ReportRow>()

  if (reportError || !report) return Response.json({ error: "That report could not be found." }, { status: 404 })

  const targetTable = report.post_id ? "community_posts" : "community_replies"
  const targetId = report.post_id ?? report.reply_id
  const { data: target, error: targetError } = await context.admin
    .from(targetTable)
    .select("author_id, status")
    .eq("id", targetId)
    .maybeSingle<TargetRow>()

  if (targetError || !target) return Response.json({ error: "The reported content no longer exists." }, { status: 404 })
  const selfRestrictionActions = new Set<ModerationAction>(["suspend_community", "suspend_account", "ban_account"])
  const reviseWouldRestrictOwner = action === "revise" && ["suspend_community", "suspend_account", "ban_account"].includes(restrictionAction)
  if (target.author_id === context.userId && (selfRestrictionActions.has(action) || reviseWouldRestrictOwner)) {
    return Response.json({ error: "The Tellwise owner account cannot be suspended or banned." }, { status: 400 })
  }

  const { data: targetModerator } = await context.admin
    .from("community_moderators")
    .select("role")
    .eq("user_id", target.author_id)
    .maybeSingle<{ role: string }>()
  if (targetModerator && context.role !== "admin") {
    return Response.json({ error: "An admin must review reports involving a moderator." }, { status: 403 })
  }

  const now = new Date().toISOString()

  if (action === "reopen") {
    try {
      await reverseReportEffects(context.admin, report, target.author_id, targetTable, targetId, context.userId, target.status)
      await writeReportStatusVerified(context.admin, report.id, {
        status: "open",
        reviewedAt: null,
        reviewedBy: null,
        resolutionNote: null,
      })
      backendLog("info", "moderation_report_reopened", { reportId: report.id, targetUserId: target.author_id })
      return Response.json({ completed: true, status: "open" }, { headers: { "Cache-Control": "no-store" } })
    } catch (error) {
      backendError("moderation_decision_reopen_failed", error, { reportId: report.id, targetUserId: target.author_id })
      return Response.json({ error: "The decision could not be undone." }, { status: 500 })
    }
  }


  if (action === "revise") {
    try {
      const revisionSummary: string[] = []

      if (contentAction === "remove" && target.status === "active") {
        await writeTargetStatusVerified(context.admin, targetTable, targetId, "removed")
        await logAction(context.admin, target.author_id, context.userId, report.id, "hide_content", null, note || "Decision revised")
        revisionSummary.push("content removed")
      }

      if (contentAction === "restore" && target.status === "removed") {
        await writeTargetStatusVerified(context.admin, targetTable, targetId, "active")
        await logAction(context.admin, target.author_id, context.userId, report.id, "restore_content", null, note || "Decision revised")
        revisionSummary.push("content restored")
      }

      if (restrictionAction === "clear") {
        await writeVerifiedModerationStatus(context.admin, target.author_id, {
          accountStatus: "active",
          accountSuspendedUntil: null,
          communitySuspendedUntil: null,
          publicMessage: restorationPublicMessage(note),
          internalNote: note || null,
          updatedBy: context.userId,
        })
        await logAction(context.admin, target.author_id, context.userId, report.id, "restriction_cleared", null, note || "Decision revised")
        revisionSummary.push("restrictions removed")
      }

      if (restrictionAction === "suspend_community") {
        const days = durationDays ?? 7
        const publicMessage = (note || defaultPublicMessage("suspend_community", days)).slice(0, 500)
        await writeVerifiedModerationStatus(context.admin, target.author_id, {
          accountStatus: "active",
          accountSuspendedUntil: null,
          communitySuspendedUntil: futureDate(days),
          publicMessage,
          internalNote: note || null,
          updatedBy: context.userId,
        })
        await logAction(context.admin, target.author_id, context.userId, report.id, "community_suspension", days, note || "Decision revised")
        revisionSummary.push(`Community suspended ${days}d`)
      }

      if (restrictionAction === "suspend_account") {
        const days = durationDays ?? 7
        const publicMessage = (note || defaultPublicMessage("suspend_account", days)).slice(0, 500)
        await writeVerifiedModerationStatus(context.admin, target.author_id, {
          accountStatus: "suspended",
          accountSuspendedUntil: futureDate(days),
          communitySuspendedUntil: null,
          publicMessage,
          internalNote: note || null,
          updatedBy: context.userId,
        })
        await logAction(context.admin, target.author_id, context.userId, report.id, "account_suspension", days, note || "Decision revised")
        revisionSummary.push(`account suspended ${days}d`)
      }

      if (restrictionAction === "ban_account") {
        const publicMessage = (note || defaultPublicMessage("ban_account", null)).slice(0, 500)
        await writeVerifiedModerationStatus(context.admin, target.author_id, {
          accountStatus: "banned",
          accountSuspendedUntil: null,
          communitySuspendedUntil: null,
          publicMessage,
          internalNote: note || null,
          updatedBy: context.userId,
        })
        await logAction(context.admin, target.author_id, context.userId, report.id, "account_ban", null, note || "Decision revised")
        revisionSummary.push("account banned")
      }

      if (restrictionAction === "keep" && contentAction === "keep" && !note) {
        return Response.json({ error: "Choose something to change before saving." }, { status: 400 })
      }

      const resolutionNote = note || (revisionSummary.length ? `Decision revised: ${revisionSummary.join(", ")}` : "Decision note updated")
      await writeReportStatusVerified(context.admin, report.id, {
        status: "resolved",
        reviewedAt: now,
        reviewedBy: context.userId,
        resolutionNote,
      })

      await logAction(
        context.admin,
        target.author_id,
        context.userId,
        report.id,
        "report_resolved",
        durationDays ?? null,
        resolutionNote,
      )

      backendLog("info", "moderation_decision_revised", { reportId: report.id, targetUserId: target.author_id, restrictionAction, contentAction })
      return Response.json({ completed: true, status: "resolved" }, { headers: { "Cache-Control": "no-store" } })
    } catch (error) {
      backendError("moderation_decision_revision_failed", error, { reportId: report.id, targetUserId: target.author_id })
      return Response.json({ error: "The decision could not be revised." }, { status: 500 })
    }
  }

  const publicMessage = (note || defaultPublicMessage(action, durationDays ?? null)).slice(0, 500)
  const shouldHide = action === "hide" || hideContent

  try {
    if (shouldHide && target.status === "active") {
      await writeTargetStatusVerified(context.admin, targetTable, targetId, "removed")
      await logAction(context.admin, target.author_id, context.userId, report.id, "hide_content", durationDays ?? null, note)
    } else if (shouldHide && target.status === "removed" && report.source === "ai") {
      // The AI already held this content before it became visible. Record the
      // owner's decision to keep it removed so the audit history is explicit.
      await logAction(context.admin, target.author_id, context.userId, report.id, "hide_content", durationDays ?? null, note || "AI hold confirmed")
    }

    if (action === "restore_content") {
      if (target.status === "deleted") {
        return Response.json({ error: "Content deleted by its author cannot be restored by moderation." }, { status: 409 })
      }
      await writeTargetStatusVerified(context.admin, targetTable, targetId, "active")
      await logAction(context.admin, target.author_id, context.userId, report.id, "restore_content", null, note)
    }

    if (action === "warn") {
      await logAction(context.admin, target.author_id, context.userId, report.id, "warning", null, note)
    }

    if (action === "suspend_community") {
      const days = durationDays ?? 7
      await writeVerifiedModerationStatus(context.admin, target.author_id, {
        accountStatus: "active",
        accountSuspendedUntil: null,
        communitySuspendedUntil: futureDate(days),
        publicMessage,
        internalNote: note || null,
        updatedBy: context.userId,
      })
      await logAction(context.admin, target.author_id, context.userId, report.id, "community_suspension", days, note)
    }

    if (action === "suspend_account") {
      const days = durationDays ?? 7
      await writeVerifiedModerationStatus(context.admin, target.author_id, {
        accountStatus: "suspended",
        accountSuspendedUntil: futureDate(days),
        communitySuspendedUntil: null,
        publicMessage,
        internalNote: note || null,
        updatedBy: context.userId,
      })
      await logAction(context.admin, target.author_id, context.userId, report.id, "account_suspension", days, note)
    }

    if (action === "ban_account") {
      await writeVerifiedModerationStatus(context.admin, target.author_id, {
        accountStatus: "banned",
        accountSuspendedUntil: null,
        communitySuspendedUntil: null,
        publicMessage,
        internalNote: note || null,
        updatedBy: context.userId,
      })
      await logAction(context.admin, target.author_id, context.userId, report.id, "account_ban", null, note)
    }

    if (action === "clear_restrictions") {
      await writeVerifiedModerationStatus(context.admin, target.author_id, {
        accountStatus: "active",
        accountSuspendedUntil: null,
        communitySuspendedUntil: null,
        publicMessage: restorationPublicMessage(note),
        internalNote: note || null,
        updatedBy: context.userId,
      })
      await logAction(context.admin, target.author_id, context.userId, report.id, "restriction_cleared", null, note)
    }

    const dismissed = action === "dismiss"
    if (dismissed && report.source === "ai" && target.status === "removed") {
      await writeTargetStatusVerified(context.admin, targetTable, targetId, "active")
      await logAction(context.admin, target.author_id, context.userId, report.id, "restore_content", null, note || "AI flag dismissed")
    }
    const resolutionStatus = dismissed ? "dismissed" : "resolved"
    await writeReportStatusVerified(context.admin, report.id, {
      status: resolutionStatus,
      reviewedAt: now,
      reviewedBy: context.userId,
      resolutionNote: note || actionLabel(action),
    })

    await logAction(
      context.admin,
      target.author_id,
      context.userId,
      report.id,
      dismissed ? "report_dismissed" : "report_resolved",
      durationDays ?? null,
      note || actionLabel(action),
    )

    backendLog("info", "moderation_decision_saved", { reportId: report.id, targetUserId: target.author_id, action, status: resolutionStatus })
    return Response.json({ completed: true, status: resolutionStatus }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("moderation_action_failed", error, { reportId: report.id, targetUserId: target.author_id, action })
    return Response.json({ error: "The moderation action could not be completed." }, { status: 500 })
  }
}

async function logAction(
  admin: SupabaseClient,
  userId: string,
  moderatorId: string,
  reportId: string,
  actionType: string,
  durationDays: number | null,
  note: string,
) {
  const payload = {
    user_id: userId,
    moderator_id: moderatorId,
    report_id: reportId,
    action_type: actionType,
    duration_days: durationDays,
    note: note || null,
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { error } = await admin.from("community_moderation_actions").insert(payload)
    if (!error) return true
    if (attempt === 2) {
      backendError("moderation_audit_log_failed", error, { userId, moderatorId, reportId, actionType })
      return false
    }
  }
  return false
}

type ReportStatusWrite = {
  status: "open" | "resolved" | "dismissed"
  reviewedAt: string | null
  reviewedBy: string | null
  resolutionNote: string | null
}

async function writeReportStatusVerified(admin: SupabaseClient, reportId: string, next: ReportStatusWrite) {
  const payload = {
    status: next.status,
    reviewed_at: next.reviewedAt,
    reviewed_by: next.reviewedBy,
    resolution_note: next.resolutionNote,
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { error } = await admin.from("community_reports").update(payload).eq("id", reportId)
    if (error) {
      if (attempt === 2) throw error
      continue
    }
    const { data, error: readError } = await admin
      .from("community_reports")
      .select("status,reviewed_at,reviewed_by,resolution_note")
      .eq("id", reportId)
      .single<{ status: string; reviewed_at: string | null; reviewed_by: string | null; resolution_note: string | null }>()
    if (!readError && data && data.status === next.status
      && normalizeTimestamp(data.reviewed_at) === normalizeTimestamp(next.reviewedAt)
      && (data.reviewed_by ?? null) === (next.reviewedBy ?? null)
      && (data.resolution_note ?? null) === (next.resolutionNote ?? null)) return
    if (attempt === 2) throw readError || new Error("The moderation report did not match the saved decision after verification.")
    backendLog("warn", "moderation_report_verify_retry", { reportId })
  }
}

async function writeTargetStatusVerified(
  admin: SupabaseClient,
  table: "community_posts" | "community_replies",
  id: string | null,
  status: "active" | "removed",
) {
  if (!id) throw new Error("The reported content no longer exists.")
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { error } = await admin.from(table).update({ status }).eq("id", id)
    if (error) {
      if (attempt === 2) throw error
      continue
    }
    const { data, error: readError } = await admin.from(table).select("status").eq("id", id).single<{ status: string }>()
    if (!readError && data?.status === status) return
    if (attempt === 2) throw readError || new Error("The reported content state could not be verified after saving.")
    backendLog("warn", "moderation_content_verify_retry", { id, table, status })
  }
}

function normalizeTimestamp(value: string | null) {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : value
}

function actionLabel(action: ModerationAction) {
  const labels: Record<ModerationAction, string> = {
    dismiss: "Report dismissed",
    hide: "Content removed",
    warn: "Internal warning recorded",
    suspend_community: "Community access suspended",
    suspend_account: "Account suspended",
    ban_account: "Account banned",
    clear_restrictions: "Restrictions cleared",
    restore_content: "Content restored",
    reopen: "Decision undone and report reopened",
    revise: "Decision revised",
  }
  return labels[action]
}


function restorationPublicMessage(note: string) {
  const clean = note.trim()
  return `Your Tellwise access has been restored after review.${clean ? ` ${clean}` : ""}`.slice(0, 500)
}

function defaultPublicMessage(action: ModerationAction, days: number | null) {
  if (action === "suspend_community") return `Community access was suspended for ${days ?? 7} days after a moderation review.`
  if (action === "suspend_account") return `Tellwise access was suspended for ${days ?? 7} days after a moderation review.`
  if (action === "ban_account") return "This account was disabled after a moderation review."
  if (action === "revise") return "A previous moderation decision was updated."
  return "Tellwise reviewed activity connected to this account."
}

async function reverseReportEffects(
  admin: SupabaseClient,
  report: ReportRow,
  userId: string,
  targetTable: "community_posts" | "community_replies",
  targetId: string | null,
  moderatorId: string,
  currentTargetStatus: string,
) {
  const { data: reportActions, error: reportActionsError } = await admin
    .from("community_moderation_actions")
    .select("action_type")
    .eq("report_id", report.id)
    .returns<{ action_type: string }[]>()
  if (reportActionsError) throw reportActionsError

  const actionTypes = new Set((reportActions ?? []).map((item: { action_type: string }) => item.action_type))

  if (targetId && currentTargetStatus !== "deleted" && actionTypes.has("hide_content")) {
    const sameTargetQuery = admin.from("community_reports").select("id")
    const sameTargetResult = report.post_id
      ? await sameTargetQuery.eq("post_id", targetId).returns<{ id: string }[]>()
      : await sameTargetQuery.eq("reply_id", targetId).returns<{ id: string }[]>()
    if (sameTargetResult.error) throw sameTargetResult.error

    const relatedReportIds = (sameTargetResult.data ?? []).map((item: { id: string }) => item.id)
    if (relatedReportIds.length > 0) {
      const { data: latestContentAction, error: latestContentActionError } = await admin
        .from("community_moderation_actions")
        .select("report_id, action_type")
        .in("report_id", relatedReportIds)
        .in("action_type", ["hide_content", "restore_content"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ report_id: string | null; action_type: string }>()
      if (latestContentActionError) throw latestContentActionError
      if (latestContentAction?.report_id === report.id && latestContentAction.action_type === "hide_content") {
        await writeTargetStatusVerified(admin, targetTable, targetId, "active")
        await logAction(admin, userId, moderatorId, report.id, "restore_content", null, "Decision undone")
      }
    }
  }

  const restrictionActions = ["community_suspension", "account_suspension", "account_ban", "restriction_cleared"]
  const { data: latestRestrictionAction, error: latestRestrictionError } = await admin
    .from("community_moderation_actions")
    .select("report_id, action_type")
    .eq("user_id", userId)
    .in("action_type", restrictionActions)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ report_id: string | null; action_type: string }>()
  if (latestRestrictionError) throw latestRestrictionError

  if (latestRestrictionAction?.report_id === report.id) {
    if (latestRestrictionAction.action_type === "community_suspension") {
      await writeVerifiedModerationStatus(admin, userId, {
        accountStatus: "active",
        accountSuspendedUntil: null,
        communitySuspendedUntil: null,
        publicMessage: "Your Community access has been restored after review.",
        internalNote: "Community suspension undone",
        updatedBy: moderatorId,
      })
      await logAction(admin, userId, moderatorId, report.id, "restriction_cleared", null, "Community suspension undone")
    }
    if (["account_suspension", "account_ban"].includes(latestRestrictionAction.action_type)) {
      await writeVerifiedModerationStatus(admin, userId, {
        accountStatus: "active",
        accountSuspendedUntil: null,
        communitySuspendedUntil: null,
        publicMessage: restorationPublicMessage(""),
        internalNote: "Account restriction undone",
        updatedBy: moderatorId,
      })
      await logAction(admin, userId, moderatorId, report.id, "restriction_cleared", null, "Account restriction undone")
    }
  }
}
