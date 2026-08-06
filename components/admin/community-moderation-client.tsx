"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Ban,
  CheckCircle2,
  Clock3,
  EyeOff,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react"
import { ConfirmDialog, NoticeDialog } from "@/components/confirm-dialog"
import { Eyebrow } from "@/components/eyebrow"
import type {
  ModerationAction,
  ModerationReportItem,
  ModerationReportsResponse,
  ModerationReportStatus,
} from "@/lib/admin/community-types"
import { cn } from "@/lib/utils"

type ModeratorRole = "moderator" | "admin"

const statuses: { value: ModerationReportStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
]

const actions: { value: ModerationAction; label: string; adminOnly?: boolean }[] = [
  { value: "dismiss", label: "Dismiss report" },
  { value: "hide", label: "Remove reported content" },
  { value: "warn", label: "Record internal warning" },
  { value: "suspend_community", label: "Suspend Community access" },
  { value: "suspend_account", label: "Suspend the full account", adminOnly: true },
  { value: "ban_account", label: "Ban the full account", adminOnly: true },
  { value: "clear_restrictions", label: "Clear account restrictions", adminOnly: true },
  { value: "restore_content", label: "Restore reported content" },
]

export function CommunityModerationClient({ role }: { role: ModeratorRole }) {
  const [status, setStatus] = useState<ModerationReportStatus>("open")
  const [reports, setReports] = useState<ModerationReportItem[]>([])
  const [counts, setCounts] = useState<ModerationReportsResponse["counts"]>({ open: 0, reviewing: 0, resolved: 0, dismissed: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/admin/community/reports?status=${status}`, { cache: "no-store" })
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

  function removeResolved(reportId: string, resultStatus: "resolved" | "dismissed") {
    setReports((current) => current.filter((report) => report.id !== reportId))
    setCounts((current) => ({
      ...current,
      [status]: Math.max(0, current[status] - 1),
      [resultStatus]: current[resultStatus] + 1,
    }))
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="rounded-[2rem] bg-primary p-6 text-primary-foreground">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-foreground"><ShieldCheck className="h-5 w-5" /></span>
          <div>
            <Eyebrow className="text-primary-foreground/60">Private admin area</Eyebrow>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Community moderation</h1>
            <p className="mt-2 text-sm leading-7 text-primary-foreground/70">
              Review reported Community content, remove harmful posts, record warnings, or restrict access. Only use the least severe action that protects users.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Recommended response ladder</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <Ladder number="1" title="Dismiss" detail="No violation or accidental report" />
          <Ladder number="2" title="Remove or record warning" detail="Low-severity first violation" />
          <Ladder number="3" title="Suspend" detail="Repeated or serious behavior" />
          <Ladder number="4" title="Ban" detail="Severe harm or repeated abuse" />
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {statuses.map((item) => (
          <button key={item.value} type="button" onClick={() => setStatus(item.value)} className={cn("shrink-0 rounded-full px-4 py-2 text-xs font-semibold", status === item.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
            {item.label} · {counts[item.value]}
          </button>
        ))}
        <button type="button" onClick={() => void load()} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-border bg-card py-14 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading reports...</div>
      ) : error ? (
        <div className="rounded-3xl border border-destructive/25 bg-card p-6 text-center"><p className="text-sm text-destructive">{error}</p><button type="button" onClick={() => void load()} className="mt-3 text-sm font-semibold">Try again</button></div>
      ) : reports.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card py-14 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-brand" /><p className="mt-3 text-sm font-semibold">Nothing in {status}.</p></div>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((report) => <ReportCard key={report.id} report={report} role={role} onCompleted={removeResolved} />)}
        </div>
      )}
    </div>
  )
}

function ReportCard({ report, role, onCompleted }: { report: ModerationReportItem; role: ModeratorRole; onCompleted: (id: string, status: "resolved" | "dismissed") => void }) {
  const availableActions = actions.filter((item) => !item.adminOnly || role === "admin")
  const [action, setAction] = useState<ModerationAction>("hide")
  const [durationDays, setDurationDays] = useState(7)
  const [note, setNote] = useState("")
  const [hideContent, setHideContent] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const needsDuration = action === "suspend_community" || action === "suspend_account"
  const destructive = action === "ban_account" || action === "suspend_account" || action === "suspend_community" || action === "hide"

  async function apply() {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch(`/api/admin/community/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action, durationDays: needsDuration ? durationDays : null, note, hideContent: hideContent && !["dismiss", "restore_content", "clear_restrictions"].includes(action) }),
      })
      const payload = await response.json() as { completed?: boolean; status?: "resolved" | "dismissed"; error?: string }
      if (!response.ok || !payload.completed || !payload.status) throw new Error(payload.error || "The action could not be completed.")
      setConfirmOpen(false)
      setNotice("The moderation action was saved and the report was closed.")
      window.setTimeout(() => onCompleted(report.id, payload.status!), 700)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.")
      setConfirmOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="rounded-[2rem] border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" /><p className="text-sm font-semibold">{reasonLabel(report.reason)}</p></div>
          <p className="mt-1 text-xs text-muted-foreground">Reported {new Date(report.createdAt).toLocaleString()} by @{report.reporter.username}</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{report.content.kind}</span>
      </div>

      <blockquote className="mt-4 rounded-2xl bg-secondary/60 p-4 text-sm leading-6 text-foreground/90">{report.content.body || "Content has already been removed."}</blockquote>
      {report.details && <p className="mt-3 rounded-2xl border border-border px-4 py-3 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Reporter context:</strong> {report.details}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <UserStat label="Reported member" value={`@${report.targetUser.username}`} />
        <UserStat label="Reports received" value={String(report.targetUser.priorReports)} />
        <UserStat label="Prior actions" value={String(report.targetUser.priorActions)} />
      </div>
      {(report.targetUser.accountStatus !== "active" || report.targetUser.communitySuspendedUntil) && (
        <p className="mt-3 rounded-2xl bg-streak-soft px-4 py-3 text-xs font-semibold text-foreground">
          Current restriction: {report.targetUser.accountStatus}{report.targetUser.communitySuspendedUntil ? ` · Community until ${new Date(report.targetUser.communitySuspendedUntil).toLocaleDateString()}` : ""}
        </p>
      )}

      <div className="mt-5 border-t border-border pt-5">
        <p className="text-sm font-semibold">Decision</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label><span className="text-xs font-semibold text-muted-foreground">Action</span><select value={action} onChange={(event) => setAction(event.target.value as ModerationAction)} className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-brand">{availableActions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          {needsDuration ? <label><span className="text-xs font-semibold text-muted-foreground">Duration</span><select value={durationDays} onChange={(event) => setDurationDays(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-brand"><option value={1}>1 day</option><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label> : <div />}
        </div>
        <label className="mt-3 block"><span className="text-xs font-semibold text-muted-foreground">{moderationNoteLabel(action)}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} placeholder={moderationNotePlaceholder(action)} className="mt-2 w-full resize-y rounded-2xl border border-border bg-background px-3 py-3 text-sm leading-6 outline-none focus:border-brand" /></label>
        {!["dismiss", "hide", "restore_content", "clear_restrictions"].includes(action) && <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><input type="checkbox" checked={hideContent} onChange={(event) => setHideContent(event.target.checked)} className="h-4 w-4 rounded border-border" />Also remove the reported content</label>}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <button type="button" onClick={() => setConfirmOpen(true)} className={cn("mt-4 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold", destructive ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground")}>{actionIcon(action)} Review and apply</button>
      </div>

      <ConfirmDialog open={confirmOpen} title="Apply this moderation action?" confirmLabel="Apply action" tone={destructive ? "danger" : "brand"} busy={busy} onCancel={() => { if (!busy) setConfirmOpen(false) }} onConfirm={() => void apply()}>
        This will record the decision in the moderation history. Account suspensions and bans affect the member immediately.
      </ConfirmDialog>
      <NoticeDialog open={Boolean(notice)} title="Action completed" onClose={() => setNotice("")}>{notice}</NoticeDialog>
    </article>
  )
}

function Ladder({ number, title, detail }: { number: string; title: string; detail: string }) { return <div className="rounded-2xl bg-secondary/60 p-3"><span className="font-mono text-xs text-muted-foreground">{number}</span><p className="mt-1 text-xs font-semibold">{title}</p><p className="mt-1 text-[0.68rem] leading-5 text-muted-foreground">{detail}</p></div> }
function UserStat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-border px-4 py-3"><p className="text-[0.62rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-semibold">{value}</p></div> }
function reasonLabel(reason: string) { return ({ harassment: "Harassment or bullying", hate: "Hateful content", sexual_content: "Sexual content", violence: "Violence or threats", self_harm: "Self-harm content", personal_information: "Private personal information", spam: "Spam or misleading content", other: "Other concern" } as Record<string, string>)[reason] || reason }

function moderationNoteLabel(action: ModerationAction) {
  if (["suspend_community", "suspend_account", "ban_account"].includes(action)) return "Message shown to the member"
  return "Internal moderation note"
}

function moderationNotePlaceholder(action: ModerationAction) {
  if (["suspend_community", "suspend_account", "ban_account"].includes(action)) {
    return "Explain the restriction clearly without exposing who reported the content..."
  }
  return "Record what was reviewed and why this decision is appropriate..."
}

function actionIcon(action: ModerationAction) { if (action === "ban_account") return <Ban className="h-4 w-4" />; if (action.includes("suspend")) return <Clock3 className="h-4 w-4" />; if (action === "hide") return <EyeOff className="h-4 w-4" />; if (action === "clear_restrictions" || action === "restore_content") return <RotateCcw className="h-4 w-4" />; return <TriangleAlert className="h-4 w-4" /> }
