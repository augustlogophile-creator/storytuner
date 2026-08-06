import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { getModeratorContext } from "@/lib/community/moderation"
import type { ModerationAction } from "@/lib/admin/community-types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const paramsSchema = z.object({ reportId: z.string().uuid() })
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
  ]),
  durationDays: z.number().int().min(1).max(3650).nullable().optional(),
  note: z.string().trim().max(2000).default(""),
  hideContent: z.boolean().default(false),
})

type RouteContext = { params: Promise<{ reportId: string }> }
type ReportRow = { id: string; post_id: string | null; reply_id: string | null; status: string }
type TargetRow = { author_id: string; status: string }

function futureDate(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  const context = await getModeratorContext()
  if (!context.ok) return context.response

  const params = paramsSchema.safeParse(await routeContext.params)
  const body = bodySchema.safeParse(await request.json().catch(() => null))
  if (!params.success || !body.success) {
    return Response.json({ error: body.success ? "That report could not be found." : body.error.issues[0]?.message || "The moderation action is invalid." }, { status: 400 })
  }

  const { action, durationDays, note, hideContent } = body.data
  const adminOnly = new Set<ModerationAction>(["suspend_account", "ban_account", "clear_restrictions"])
  if (adminOnly.has(action) && context.role !== "admin") {
    return Response.json({ error: "Only a Community admin can apply or clear full-account restrictions." }, { status: 403 })
  }

  const { data: report, error: reportError } = await context.admin
    .from("community_reports")
    .select("id, post_id, reply_id, status")
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
  if (target.author_id === context.userId) return Response.json({ error: "You cannot moderate your own account from a report." }, { status: 400 })

  const { data: targetModerator } = await context.admin
    .from("community_moderators")
    .select("role")
    .eq("user_id", target.author_id)
    .maybeSingle<{ role: string }>()
  if (targetModerator && context.role !== "admin") {
    return Response.json({ error: "An admin must review reports involving a moderator." }, { status: 403 })
  }

  const now = new Date().toISOString()
  const publicMessage = note || defaultPublicMessage(action, durationDays ?? null)
  const shouldHide = action === "hide" || hideContent

  try {
    if (shouldHide && target.status === "active") {
      const { error } = await context.admin.from(targetTable).update({ status: "removed" }).eq("id", targetId)
      if (error) throw error
      await logAction(context.admin, target.author_id, context.userId, report.id, "hide_content", durationDays ?? null, note)
    }

    if (action === "restore_content") {
      const { error } = await context.admin.from(targetTable).update({ status: "active" }).eq("id", targetId)
      if (error) throw error
      await logAction(context.admin, target.author_id, context.userId, report.id, "restore_content", null, note)
    }

    if (action === "warn") {
      await logAction(context.admin, target.author_id, context.userId, report.id, "warning", null, note)
    }

    if (action === "suspend_community") {
      const days = durationDays ?? 7
      const { error } = await context.admin.from("community_moderation_status").upsert({
        user_id: target.author_id,
        community_suspended_until: futureDate(days),
        public_message: publicMessage,
        internal_note: note || null,
        updated_by: context.userId,
      }, { onConflict: "user_id" })
      if (error) throw error
      await logAction(context.admin, target.author_id, context.userId, report.id, "community_suspension", days, note)
    }

    if (action === "suspend_account") {
      const days = durationDays ?? 7
      const { error } = await context.admin.from("community_moderation_status").upsert({
        user_id: target.author_id,
        account_status: "suspended",
        account_suspended_until: futureDate(days),
        public_message: publicMessage,
        internal_note: note || null,
        updated_by: context.userId,
      }, { onConflict: "user_id" })
      if (error) throw error
      await logAction(context.admin, target.author_id, context.userId, report.id, "account_suspension", days, note)
    }

    if (action === "ban_account") {
      const { error } = await context.admin.from("community_moderation_status").upsert({
        user_id: target.author_id,
        account_status: "banned",
        account_suspended_until: null,
        community_suspended_until: null,
        public_message: publicMessage,
        internal_note: note || null,
        updated_by: context.userId,
      }, { onConflict: "user_id" })
      if (error) throw error
      await logAction(context.admin, target.author_id, context.userId, report.id, "account_ban", null, note)
    }

    if (action === "clear_restrictions") {
      const { error } = await context.admin.from("community_moderation_status").upsert({
        user_id: target.author_id,
        account_status: "active",
        account_suspended_until: null,
        community_suspended_until: null,
        public_message: null,
        internal_note: note || null,
        updated_by: context.userId,
      }, { onConflict: "user_id" })
      if (error) throw error
      await logAction(context.admin, target.author_id, context.userId, report.id, "restriction_cleared", null, note)
    }

    const dismissed = action === "dismiss"
    const resolutionStatus = dismissed ? "dismissed" : "resolved"
    const { error: updateError } = await context.admin
      .from("community_reports")
      .update({
        status: resolutionStatus,
        reviewed_at: now,
        reviewed_by: context.userId,
        resolution_note: note || actionLabel(action),
      })
      .eq("id", report.id)
    if (updateError) throw updateError

    await logAction(
      context.admin,
      target.author_id,
      context.userId,
      report.id,
      dismissed ? "report_dismissed" : "report_resolved",
      durationDays ?? null,
      note || actionLabel(action),
    )

    return Response.json({ completed: true, status: resolutionStatus })
  } catch (error) {
    console.error("Moderation action failed", error)
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
  const { error } = await admin.from("community_moderation_actions").insert({
    user_id: userId,
    moderator_id: moderatorId,
    report_id: reportId,
    action_type: actionType,
    duration_days: durationDays,
    note: note || null,
  })
  if (error) throw error
}

function actionLabel(action: ModerationAction) {
  return ({
    dismiss: "Report dismissed",
    hide: "Content removed",
    warn: "Internal warning recorded",
    suspend_community: "Community access suspended",
    suspend_account: "Account suspended",
    ban_account: "Account banned",
    clear_restrictions: "Restrictions cleared",
    restore_content: "Content restored",
  } satisfies Record<ModerationAction, string>)[action]
}

function defaultPublicMessage(action: ModerationAction, days: number | null) {
  if (action === "suspend_community") return `Community access was suspended for ${days ?? 7} days after a moderation review.`
  if (action === "suspend_account") return `StoryTuner access was suspended for ${days ?? 7} days after a moderation review.`
  if (action === "ban_account") return "This account was disabled after a moderation review."
  return "StoryTuner reviewed activity connected to this account."
}
