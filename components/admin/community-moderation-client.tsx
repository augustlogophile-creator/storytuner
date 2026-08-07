"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Loader2, RefreshCw, RotateCcw, ShieldAlert } from "lucide-react"
import { ConfirmDialog, NoticeDialog } from "@/components/confirm-dialog"
import { Eyebrow } from "@/components/eyebrow"
import type {
  ModerationAction,
  ModerationReportItem,
  ModerationReportsResponse,
  ModerationReportStatus,
} from "@/lib/admin/community-types"
import { cn } from "@/lib/utils"

const statuses: { value: ModerationReportStatus; label: string }[] = [
  { value: "open", label: "New" },
  { value: "resolved", label: "Decisions" },
  { value: "dismissed", label: "Dismissed" },
]

const actions: { value: ModerationAction; label: string }[] = [
  { value: "hide", label: "Remove content" },
  { value: "warn", label: "Record warning" },
  { value: "suspend_community", label: "Suspend Community" },
  { value: "suspend_account", label: "Suspend account" },
  { value: "ban_account", label: "Ban account" },
  { value: "dismiss", label: "Dismiss report" },
]

export function CommunityModerationClient({ role: _role }: { role: "admin" }) {
  const [status, setStatus] = useState<ModerationReportStatus>("open")
  const [reports, setReports] = useState<ModerationReportItem[]>([])
  const [counts, setCounts] = useState<ModerationReportsResponse["counts"]>({ open: 0, reviewing: 0, resolved: 0, dismissed: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/admin/community/reports?status=${status}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
      const payload = await response.json() as ModerationReportsResponse & { error?: string }
      if (!response.ok) throw new Error(payload.error || "Reports could not be loaded.")
      setReports(payload.reports)
      setCounts(payload.counts)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reports could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { void load() }, [load])

  function moveReport(reportId: string, nextStatus: ModerationReportStatus) {
    setReports((current) => current.filter((report) => report.id !== reportId))
    setCounts((current) => ({
      ...current,
      [status]: Math.max(0, current[status] - 1),
      [nextStatus]: current[nextStatus] + 1,
    }))
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header>
        <Eyebrow>Owner tools</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Community moderation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review new reports or revisit past decisions.</p>
      </header>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {statuses.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setStatus(item.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-xs font-semibold",
              status === item.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}
          >
            {item.label} · {counts[item.value]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Refresh reports"
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-border bg-card py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading reports...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-destructive/25 bg-card p-5 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-3 text-sm font-semibold">Try again</button>
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card py-12 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-brand" />
          <p className="mt-3 text-sm font-semibold">Nothing here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((report) => (
            status === "open"
              ? <OpenReportCard key={report.id} report={report} onMoved={moveReport} />
              : <PastDecisionCard key={report.id} report={report} onMoved={moveReport} onChanged={() => void load()} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReportSummary({ report }: { report: ModerationReportItem }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
            <p className="truncate text-sm font-semibold">{reasonLabel(report.reason)}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">@{report.targetUser.username} · {new Date(report.createdAt).toLocaleDateString()}</p>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {report.content.kind}
        </span>
      </div>

      <blockquote className="mt-4 rounded-2xl bg-secondary/60 px-4 py-3 text-sm leading-6">
        {report.content.body || "This content is no longer visible in Community."}
      </blockquote>

      {report.details && <p className="mt-3 text-xs leading-5 text-muted-foreground">Reporter note: {report.details}</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        {report.targetUser.priorReports} report{report.targetUser.priorReports === 1 ? "" : "s"} · {report.targetUser.priorActions} prior action{report.targetUser.priorActions === 1 ? "" : "s"}
      </p>
    </>
  )
}

function OpenReportCard({
  report,
  onMoved,
}: {
  report: ModerationReportItem
  onMoved: (id: string, status: ModerationReportStatus) => void
}) {
  const [action, setAction] = useState<ModerationAction>("hide")
  const [durationDays, setDurationDays] = useState(7)
  const [note, setNote] = useState("")
  const [hideContent, setHideContent] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const needsDuration = action === "suspend_community" || action === "suspend_account"
  const canAlsoHide = ["warn", "suspend_community", "suspend_account", "ban_account"].includes(action)
  const destructive = ["hide", "suspend_community", "suspend_account", "ban_account"].includes(action)

  async function apply() {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch(`/api/admin/community/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          action,
          durationDays: needsDuration ? durationDays : null,
          note,
          hideContent: canAlsoHide && hideContent,
        }),
      })
      const payload = await response.json() as { completed?: boolean; status?: ModerationReportStatus; error?: string }
      if (!response.ok || !payload.completed || !payload.status) throw new Error(payload.error || "The action could not be completed.")
      setConfirmOpen(false)
      setNotice("The decision was saved.")
      window.setTimeout(() => onMoved(report.id, payload.status!), 500)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.")
      setConfirmOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="rounded-3xl border border-border bg-card p-5">
      <ReportSummary report={report} />

      <div className="mt-4 border-t border-border pt-4">
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Decision</span>
          <select
            value={action}
            onChange={(event) => setAction(event.target.value as ModerationAction)}
            className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-brand"
          >
            {actions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        {needsDuration && (
          <label className="mt-3 block">
            <span className="text-xs font-semibold text-muted-foreground">Duration</span>
            <select
              value={durationDays}
              onChange={(event) => setDurationDays(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-brand"
            >
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
        )}

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-muted-foreground">Note, optional</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder={needsDuration || action === "ban_account" ? "This will be shown to the member." : "Why are you taking this action?"}
            className="mt-2 w-full resize-y rounded-2xl border border-border bg-background px-3 py-3 text-sm leading-6 outline-none focus:border-brand"
          />
        </label>

        {canAlsoHide && (
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <input type="checkbox" checked={hideContent} onChange={(event) => setHideContent(event.target.checked)} className="h-4 w-4 rounded border-border" />
            Also remove the reported content
          </label>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className={cn(
            "mt-4 w-full rounded-full px-5 py-3 text-sm font-semibold",
            destructive ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          Save decision
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Save this decision?"
        confirmLabel="Save"
        tone={destructive ? "danger" : "brand"}
        busy={busy}
        onCancel={() => { if (!busy) setConfirmOpen(false) }}
        onConfirm={() => void apply()}
      >
        The report will move out of New. You can revisit resolved decisions later.
      </ConfirmDialog>
      <NoticeDialog open={Boolean(notice)} title="Saved" onClose={() => setNotice("")}>{notice}</NoticeDialog>
    </article>
  )
}

function PastDecisionCard({
  report,
  onMoved,
  onChanged,
}: {
  report: ModerationReportItem
  onMoved: (id: string, status: ModerationReportStatus) => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState("")
  const [restrictionAction, setRestrictionAction] = useState<"keep" | "clear" | "suspend_community" | "suspend_account" | "ban_account">("keep")
  const [contentAction, setContentAction] = useState<"keep" | "remove" | "restore">("keep")
  const [durationDays, setDurationDays] = useState(7)
  const [note, setNote] = useState(report.resolutionNote ?? "")
  const decisionLabels = useMemo(() => summarizeActions(report), [report])
  const needsDuration = restrictionAction === "suspend_community" || restrictionAction === "suspend_account"

  async function reopen() {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch(`/api/admin/community/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "reopen", durationDays: null, note: "", hideContent: false }),
      })
      const payload = await response.json() as { completed?: boolean; status?: ModerationReportStatus; error?: string }
      if (!response.ok || !payload.completed || payload.status !== "open") throw new Error(payload.error || "The decision could not be reopened.")
      setConfirmOpen(false)
      onMoved(report.id, "open")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The decision could not be reopened.")
      setConfirmOpen(false)
    } finally {
      setBusy(false)
    }
  }

  async function revise() {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch(`/api/admin/community/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          action: "revise",
          restrictionAction,
          contentAction,
          durationDays: needsDuration ? durationDays : null,
          note,
          hideContent: false,
        }),
      })
      const payload = await response.json() as { completed?: boolean; status?: ModerationReportStatus; error?: string }
      if (!response.ok || !payload.completed || payload.status !== "resolved") throw new Error(payload.error || "The decision could not be changed.")
      setConfirmOpen(false)
      setEditing(false)
      setRestrictionAction("keep")
      setContentAction("keep")
      onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The decision could not be changed.")
      setConfirmOpen(false)
    } finally {
      setBusy(false)
    }
  }

  if (report.status === "dismissed") {
    return (
      <article className="rounded-3xl border border-border bg-card p-5">
        <ReportSummary report={report} />
        <div className="mt-4 rounded-2xl bg-secondary/60 p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Dismissed</p>
          <p className="mt-1 text-sm font-semibold">Report dismissed</p>
          {report.resolutionNote && <p className="mt-2 text-xs leading-5 text-muted-foreground">{report.resolutionNote}</p>}
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold"
        >
          <RotateCcw className="h-4 w-4" /> Reopen report
        </button>
        <ConfirmDialog
          open={confirmOpen}
          title="Reopen this report?"
          confirmLabel="Reopen"
          tone="brand"
          busy={busy}
          onCancel={() => { if (!busy) setConfirmOpen(false) }}
          onConfirm={() => void reopen()}
        >
          The report will return to New so you can review it again.
        </ConfirmDialog>
      </article>
    )
  }

  return (
    <article className="rounded-3xl border border-border bg-card p-5">
      <ReportSummary report={report} />

      <div className="mt-4 grid gap-2 rounded-2xl bg-secondary/60 p-4 sm:grid-cols-2">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Last decision</p>
          <p className="mt-1 text-sm font-semibold">{decisionLabels.join(" · ") || "Decision saved"}</p>
        </div>
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current enforcement</p>
          <p className="mt-1 text-sm font-semibold">{currentEnforcementLabel(report)}</p>
        </div>
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Content</p>
          <p className="mt-1 text-sm font-semibold">{currentContentLabel(report.content.status)}</p>
        </div>
        {(report.resolutionNote || report.actions.findLast((item) => item.note)?.note) && (
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Moderator note</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{report.resolutionNote || report.actions.findLast((item) => item.note)?.note}</p>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-4 rounded-2xl border border-border bg-background p-4">
          <p className="text-sm font-semibold">Change this decision</p>
          <p className="mt-1 text-xs text-muted-foreground">Only the settings you change below will be updated. Earlier actions stay in the audit history.</p>

          <label className="mt-4 block">
            <span className="text-xs font-semibold text-muted-foreground">Account access</span>
            <select
              value={restrictionAction}
              onChange={(event) => setRestrictionAction(event.target.value as typeof restrictionAction)}
              className="mt-2 w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-brand"
            >
              <option value="keep">Keep current restriction</option>
              <option value="clear">Remove all restrictions</option>
              <option value="suspend_community">Suspend Community only</option>
              <option value="suspend_account">Suspend entire account</option>
              <option value="ban_account">Permanently ban account</option>
            </select>
          </label>

          {needsDuration && (
            <label className="mt-3 block">
              <span className="text-xs font-semibold text-muted-foreground">New duration in days</span>
              <input
                type="number"
                min={1}
                max={3650}
                value={durationDays}
                onChange={(event) => setDurationDays(Math.min(3650, Math.max(1, Number(event.target.value) || 1)))}
                className="mt-2 w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-brand"
              />
              <p className="mt-1 text-[0.68rem] text-muted-foreground">Examples: 1 day, 7 days, 30 days, 365 days.</p>
            </label>
          )}

          <label className="mt-3 block">
            <span className="text-xs font-semibold text-muted-foreground">Reported content</span>
            <select
              value={contentAction}
              onChange={(event) => setContentAction(event.target.value as typeof contentAction)}
              className="mt-2 w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-brand"
            >
              <option value="keep">Keep current content state</option>
              <option value="remove">Remove content</option>
              <option value="restore">Restore content</option>
            </select>
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-semibold text-muted-foreground">Updated moderator note, optional</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              rows={2}
              className="mt-2 w-full resize-y rounded-2xl border border-border bg-card px-3 py-3 text-sm leading-6 outline-none focus:border-brand"
            />
          </label>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => { setEditing(false); setError("") }} className="flex-1 rounded-full border border-border px-4 py-3 text-sm font-semibold">Cancel</button>
            <button type="button" onClick={() => setConfirmOpen(true)} className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Save changes</button>
          </div>
        </div>
      ) : (
        <>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-4 w-full rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold"
          >
            Change decision
          </button>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Update this decision?"
        confirmLabel="Save changes"
        tone={restrictionAction === "ban_account" ? "danger" : "brand"}
        busy={busy}
        onCancel={() => { if (!busy) setConfirmOpen(false) }}
        onConfirm={() => void revise()}
      >
        The new enforcement will take effect immediately. The original decision will remain in the moderation history.
      </ConfirmDialog>
    </article>
  )
}

function currentEnforcementLabel(report: ModerationReportItem) {
  const now = Date.now()
  if (report.targetUser.accountStatus === "banned") return "Permanent account ban"
  if (report.targetUser.accountStatus === "suspended" && (!report.targetUser.accountSuspendedUntil || new Date(report.targetUser.accountSuspendedUntil).getTime() > now)) {
    return report.targetUser.accountSuspendedUntil
      ? `Account suspended until ${new Date(report.targetUser.accountSuspendedUntil).toLocaleDateString()}`
      : "Account suspended"
  }
  if (report.targetUser.communitySuspendedUntil && new Date(report.targetUser.communitySuspendedUntil).getTime() > now) {
    return `Community suspended until ${new Date(report.targetUser.communitySuspendedUntil).toLocaleDateString()}`
  }
  return "No active restriction"
}

function currentContentLabel(status: string) {
  if (status === "removed") return "Removed by moderation"
  if (status === "deleted") return "Deleted by member"
  return "Visible"
}

function summarizeActions(report: ModerationReportItem) {
  const metaIndexes = report.actions
    .map((action, index) => (["report_resolved", "report_dismissed"].includes(action.actionType) ? index : -1))
    .filter((index) => index >= 0)
  const latestMeta = metaIndexes.at(-1) ?? report.actions.length
  const previousMeta = metaIndexes.length > 1 ? metaIndexes.at(-2)! : -1
  const currentDecisionActions = report.actions.slice(previousMeta + 1, latestMeta)

  const labels: string[] = []
  for (const action of currentDecisionActions) {
    const label = ({
      warning: "Warning recorded",
      hide_content: "Content removed",
      community_suspension: action.durationDays ? `Community suspended ${action.durationDays}d` : "Community suspended",
      account_suspension: action.durationDays ? `Account suspended ${action.durationDays}d` : "Account suspended",
      account_ban: "Account banned",
      restore_content: "Content restored",
      restriction_cleared: "Restrictions removed",
    } as Record<string, string | undefined>)[action.actionType]
    if (label && !labels.includes(label)) labels.push(label)
  }
  return labels
}

function reasonLabel(reason: string) {
  return ({
    harassment: "Harassment or bullying",
    hate: "Hateful content",
    sexual_content: "Sexual content",
    violence: "Violence or threats",
    self_harm: "Self-harm content",
    personal_information: "Private personal information",
    spam: "Spam or misleading content",
    other: "Other concern",
  } as Record<string, string>)[reason] || reason
}
