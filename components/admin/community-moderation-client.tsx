"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react"
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
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
]

const actions: { value: ModerationAction; label: string }[] = [
  { value: "dismiss", label: "Dismiss report" },
  { value: "hide", label: "Remove content" },
  { value: "warn", label: "Record warning" },
  { value: "suspend_community", label: "Suspend Community access" },
  { value: "suspend_account", label: "Suspend account" },
  { value: "ban_account", label: "Ban account" },
  { value: "clear_restrictions", label: "Clear restrictions" },
  { value: "restore_content", label: "Restore content" },
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

  function removeCompleted(reportId: string, resultStatus: "resolved" | "dismissed") {
    setReports((current) => current.filter((report) => report.id !== reportId))
    setCounts((current) => ({
      ...current,
      [status]: Math.max(0, current[status] - 1),
      [resultStatus]: current[resultStatus] + 1,
    }))
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header>
        <Eyebrow>Owner tools</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Community moderation</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Review a report, choose one action, and save the decision.</p>
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
          <p className="mt-3 text-sm font-semibold">No {status} reports.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} onCompleted={removeCompleted} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReportCard({
  report,
  onCompleted,
}: {
  report: ModerationReportItem
  onCompleted: (id: string, status: "resolved" | "dismissed") => void
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
  const canAlsoHide = !["dismiss", "hide", "restore_content", "clear_restrictions"].includes(action)
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
      const payload = await response.json() as { completed?: boolean; status?: "resolved" | "dismissed"; error?: string }
      if (!response.ok || !payload.completed || !payload.status) {
        throw new Error(payload.error || "The action could not be completed.")
      }
      setConfirmOpen(false)
      setNotice("The decision was saved.")
      window.setTimeout(() => onCompleted(report.id, payload.status!), 600)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.")
      setConfirmOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
            <p className="truncate text-sm font-semibold">{reasonLabel(report.reason)}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            @{report.targetUser.username} · {new Date(report.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {report.content.kind}
        </span>
      </div>

      <blockquote className="mt-4 rounded-2xl bg-secondary/60 px-4 py-3 text-sm leading-6">
        {report.content.body || "This content has already been removed."}
      </blockquote>

      {report.details && (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Report note: {report.details}</p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {report.targetUser.priorReports} total report{report.targetUser.priorReports === 1 ? "" : "s"} · {report.targetUser.priorActions} prior action{report.targetUser.priorActions === 1 ? "" : "s"}
      </p>

      <div className="mt-4 border-t border-border pt-4">
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Action</span>
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
            placeholder="Why are you taking this action?"
            className="mt-2 w-full resize-y rounded-2xl border border-border bg-background px-3 py-3 text-sm leading-6 outline-none focus:border-brand"
          />
        </label>

        {canAlsoHide && (
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <input
              type="checkbox"
              checked={hideContent}
              onChange={(event) => setHideContent(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
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
          Apply action
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Apply this action?"
        confirmLabel="Apply"
        tone={destructive ? "danger" : "brand"}
        busy={busy}
        onCancel={() => { if (!busy) setConfirmOpen(false) }}
        onConfirm={() => void apply()}
      >
        The report will be closed and the decision will be saved.
      </ConfirmDialog>
      <NoticeDialog open={Boolean(notice)} title="Saved" onClose={() => setNotice("")}>{notice}</NoticeDialog>
    </article>
  )
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
