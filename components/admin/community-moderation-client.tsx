"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Loader2, RefreshCw, RotateCcw, ShieldAlert } from "lucide-react"
import { ConfirmDialog, NoticeDialog } from "@/components/confirm-dialog"
import { Eyebrow } from "@/components/eyebrow"
import { BackLink } from "@/components/page-header"
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
  { value: "restore_content", label: "Restore content" },
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
      <BackLink href="/admin" label="Owner tools" />
      <header>
        <Eyebrow>Community</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Community reports</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Review reported posts and replies. Choose a clear action, or dismiss the report if nothing needs to change.</p>
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
              : <PastDecisionCard key={report.id} report={report} onMoved={moveReport} onChanged={load} />
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
        <div className="flex shrink-0 items-center gap-1.5">
          {report.source === "ai" && (
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-wide text-brand">AI</span>
          )}
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {report.content.kind}
          </span>
        </div>
      </div>

      <blockquote className="mt-4 rounded-2xl bg-secondary/60 px-4 py-3 text-sm leading-6">
        {report.content.body || "This content is no longer visible in Community."}
      </blockquote>

      {report.details && (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {report.source === "ai" ? "AI review: " : "Reporter note: "}{report.details}
        </p>
      )}
      {report.source === "ai" && report.ai?.recommendedAction && (
        <p className="mt-2 rounded-xl bg-brand-soft/55 px-3 py-2 text-xs font-medium leading-5 text-foreground">
          Suggested: {report.ai.recommendedAction}
        </p>
      )}
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
  const aiSuggestsSuspension = report.source === "ai" && Boolean(report.ai?.recommendedAction?.includes("7-day Community suspension"))
  const [action, setAction] = useState<ModerationAction>(aiSuggestsSuspension ? "suspend_community" : "hide")
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
  onChanged: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [restrictionAction, setRestrictionAction] = useState<"keep" | "clear" | "suspend_community" | "suspend_account" | "ban_account">("keep")
  const [contentAction, setContentAction] = useState<"keep" | "remove" | "restore">("keep")
  const [durationDays, setDurationDays] = useState(7)
  const [note, setNote] = useState("")
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
    } finally { setBusy(false) }
  }

  async function revise() {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch(`/api/admin/community/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "revise", restrictionAction, contentAction, durationDays: needsDuration ? durationDays : null, note, hideContent: false }),
      })
      const payload = await response.json() as { completed?: boolean; status?: ModerationReportStatus; error?: string }
      if (!response.ok || !payload.completed || payload.status !== "resolved") throw new Error(payload.error || "The decision could not be changed.")
      setConfirmOpen(false)
      setEditing(false)
      setRestrictionAction("keep")
      setContentAction("keep")
      setNote("")
      await onChanged()
      setNotice("The moderation decision is updated and the new access state is active now.")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The decision could not be changed.")
      setConfirmOpen(false)
    } finally { setBusy(false) }
  }

  if (report.status === "dismissed") {
    return (
      <article className="rounded-3xl border border-border bg-card p-5">
        <ReportSummary report={report} />
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-secondary/55 px-4 py-3">
          <div><p className="text-xs font-semibold">Dismissed</p><p className="mt-0.5 text-xs text-muted-foreground">No enforcement was applied.</p></div>
          <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <button type="button" onClick={() => setConfirmOpen(true)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold"><RotateCcw className="h-4 w-4" /> Reopen report</button>
        <ConfirmDialog open={confirmOpen} title="Reopen this report?" confirmLabel="Reopen" tone="brand" busy={busy} onCancel={() => { if (!busy) setConfirmOpen(false) }} onConfirm={() => void reopen()}>The report will return to New so you can review it again.</ConfirmDialog>
      </article>
    )
  }

  return (
    <article className="rounded-3xl border border-border bg-card p-5">
      <ReportSummary report={report} />

      <div className="mt-4 rounded-2xl border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Current outcome</p>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[0.62rem] font-semibold text-muted-foreground">Saved</span>
        </div>
        <div className="mt-3 divide-y divide-border">
          <StateRow label="Account access" value={currentEnforcementLabel(report)} />
          <StateRow label="Reported content" value={currentContentLabel(report.content.status)} />
          <StateRow label="Last change" value={latestDecisionActionLabel(report)} />
        </div>
        {report.actions.length > 0 && (
          <details className="mt-3 border-t border-border pt-3">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">View audit history · {report.actions.length}</summary>
            <div className="mt-3 space-y-2">
              {[...report.actions].reverse().slice(0, 12).map((action, index) => (
                <div key={`${action.createdAt}-${index}`} className="flex items-start justify-between gap-3 text-xs">
                  <span className="font-medium">{historyActionLabel(action.actionType, action.durationDays)}</span>
                  <span className="shrink-0 text-muted-foreground">{new Date(action.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {editing ? (
        <div className="mt-4 rounded-2xl border border-brand/25 bg-brand-soft/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm font-semibold">Update decision</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Change only what needs to change. Updates take effect immediately.</p></div>
            <button type="button" onClick={() => { setEditing(false); setError("") }} className="text-xs font-semibold text-muted-foreground">Cancel</button>
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-semibold">Account access</span>
            <select value={restrictionAction} onChange={(event) => setRestrictionAction(event.target.value as typeof restrictionAction)} className="mt-2 w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-brand">
              <option value="keep">Keep current access</option>
              <option value="clear">Restore full access now</option>
              <option value="suspend_community">Suspend Community only</option>
              <option value="suspend_account">Suspend entire account</option>
              <option value="ban_account">Permanently disable account</option>
            </select>
          </label>

          {needsDuration && (
            <label className="mt-3 block">
              <span className="text-xs font-semibold">Duration</span>
              <div className="moderation-duration-grid mt-2 grid grid-cols-4 gap-2">
                {[1, 7, 30, 365].map((days) => <button key={days} type="button" onClick={() => setDurationDays(days)} className={cn("rounded-xl border px-2 py-2 text-xs font-semibold", durationDays === days ? "border-brand bg-brand-soft" : "border-border bg-card")}>{days === 365 ? "1 year" : `${days}d`}</button>)}
              </div>
              <input type="number" min={1} max={3650} value={durationDays} onChange={(event) => setDurationDays(Math.min(3650, Math.max(1, Number(event.target.value) || 1)))} className="mt-2 w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-brand" aria-label="Custom suspension duration in days" />
            </label>
          )}

          <label className="mt-3 block">
            <span className="text-xs font-semibold">Reported content</span>
            <select value={contentAction} onChange={(event) => setContentAction(event.target.value as typeof contentAction)} className="mt-2 w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-brand">
              <option value="keep">Keep current content state</option>
              <option value="remove">Remove content</option>
              <option value="restore">Restore content</option>
            </select>
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-semibold">Message to member <span className="font-normal text-muted-foreground">optional</span></span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={2} placeholder={restrictionAction === "clear" ? "For example: We reviewed this again and restored your access." : "Add a concise explanation if the member should see one."} className="mt-2 w-full resize-y rounded-2xl border border-border bg-card px-3 py-3 text-sm leading-6 outline-none focus:border-brand" />
          </label>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <button type="button" onClick={() => setConfirmOpen(true)} className="mt-4 w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Apply update</button>
        </div>
      ) : (
        <>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <button type="button" onClick={() => setEditing(true)} className="mt-4 w-full rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold transition-colors hover:border-brand/45">Edit decision</button>
        </>
      )}

      <ConfirmDialog open={confirmOpen} title="Apply this moderation update?" confirmLabel="Apply update" tone={restrictionAction === "ban_account" ? "danger" : "brand"} busy={busy} onCancel={() => { if (!busy) setConfirmOpen(false) }} onConfirm={() => void revise()}>The new access and content settings will take effect immediately. The audit history will be preserved.</ConfirmDialog>
      <NoticeDialog open={Boolean(notice)} title="Decision updated" onClose={() => setNotice("")}>{notice}</NoticeDialog>
    </article>
  )
}

function StateRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0"><span className="text-xs text-muted-foreground">{label}</span><span className="max-w-[62%] text-right text-xs font-semibold leading-5">{value}</span></div>
}

function currentEnforcementLabel(report: ModerationReportItem) {
  const now = Date.now()
  if (report.targetUser.accountStatus === "banned") return "Account disabled"
  if (report.targetUser.accountStatus === "suspended" && (!report.targetUser.accountSuspendedUntil || new Date(report.targetUser.accountSuspendedUntil).getTime() > now)) {
    return report.targetUser.accountSuspendedUntil ? `Suspended until ${new Date(report.targetUser.accountSuspendedUntil).toLocaleDateString()}` : "Account suspended"
  }
  if (report.targetUser.communitySuspendedUntil && new Date(report.targetUser.communitySuspendedUntil).getTime() > now) return `Community suspended until ${new Date(report.targetUser.communitySuspendedUntil).toLocaleDateString()}`
  return "Full access"
}

function currentContentLabel(status: string) {
  if (status === "removed") return "Removed by moderation"
  if (status === "deleted") return "Deleted by member"
  return "Visible"
}

function latestDecisionActionLabel(report: ModerationReportItem) {
  const action = [...report.actions].reverse().find((item) => !["report_resolved", "report_dismissed"].includes(item.actionType))
  return action ? historyActionLabel(action.actionType, action.durationDays) : report.resolutionNote || "Decision saved"
}

function historyActionLabel(actionType: string, durationDays: number | null) {
  return ({
    warning: "Warning recorded",
    hide_content: "Content removed",
    restore_content: "Content restored",
    community_suspension: durationDays ? `Community suspended for ${durationDays} days` : "Community suspended",
    account_suspension: durationDays ? `Account suspended for ${durationDays} days` : "Account suspended",
    account_ban: "Account disabled",
    restriction_cleared: "Access restored",
    report_resolved: "Report resolved",
    report_dismissed: "Report dismissed",
  } as Record<string, string>)[actionType] || actionType.replaceAll("_", " ")
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
