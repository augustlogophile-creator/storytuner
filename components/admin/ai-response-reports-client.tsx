"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Flag, Loader2, RefreshCw } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Eyebrow } from "@/components/eyebrow"
import { BackLink } from "@/components/page-header"
import type { AiResponseReportItem, AiResponseReportsResponse, AiResponseReportStatus } from "@/lib/admin/ai-report-types"
import { cn } from "@/lib/utils"

const statuses: { value: AiResponseReportStatus; label: string }[] = [
  { value: "open", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "actioned", label: "Handled" },
  { value: "dismissed", label: "Dismissed" },
]

const surfaceLabels: Record<AiResponseReportItem["surface"], string> = {
  coach: "Ask Parch",
  practice: "Practice",
  check: "Check",
  studio: "Studio",
  planner: "Story Planner",
  other: "Other",
}

export function AiResponseReportsClient() {
  const [status, setStatus] = useState<AiResponseReportStatus>("open")
  const [reports, setReports] = useState<AiResponseReportItem[]>([])
  const [counts, setCounts] = useState<AiResponseReportsResponse["counts"]>({ open: 0, reviewed: 0, dismissed: 0, actioned: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/admin/ai-reports?status=${status}`, { cache: "no-store", headers: { Accept: "application/json" } })
      const payload = await response.json() as AiResponseReportsResponse & { error?: string }
      if (!response.ok) throw new Error(payload.error || "AI reports could not be loaded.")
      setReports(payload.reports)
      setCounts(payload.counts)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI reports could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { void load() }, [load])

  function moveReport(reportId: string, nextStatus: AiResponseReportStatus) {
    setReports((current) => current.filter((report) => report.id !== reportId))
    setCounts((current) => ({
      ...current,
      [status]: Math.max(0, current[status] - 1),
      [nextStatus]: current[nextStatus] + 1,
    }))
  }

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-6">
      <BackLink href="/admin" label="Owner tools" />
      <header>
        <Eyebrow>AI replies</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">AI reply reports</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">See what the member reported, read the exact Parch reply, then choose what happened next.</p>
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
        <button type="button" onClick={() => void load()} aria-label="Refresh AI reports" className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border">
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
          <p className="mt-3 text-sm font-semibold">No reports in this section.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((report) => <AiReportCard key={report.id} report={report} onMoved={moveReport} />)}
        </div>
      )}
    </div>
  )
}

function AiReportCard({ report, onMoved }: { report: AiResponseReportItem; onMoved: (id: string, status: AiResponseReportStatus) => void }) {
  const [note, setNote] = useState(report.adminNote ?? "")
  const [busy, setBusy] = useState<AiResponseReportStatus | null>(null)
  const [pendingStatus, setPendingStatus] = useState<AiResponseReportStatus | null>(null)
  const [error, setError] = useState("")

  async function update(nextStatus: AiResponseReportStatus) {
    if (busy) return
    setBusy(nextStatus)
    setError("")
    try {
      const response = await fetch(`/api/admin/ai-reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ status: nextStatus, adminNote: note }),
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error || "The report could not be updated.")
      setPendingStatus(null)
      onMoved(report.id, nextStatus)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The report could not be updated.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <article className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm font-semibold">{surfaceLabels[report.surface]}</p>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">@{report.reporterUsername} · {new Date(report.createdAt).toLocaleString()}</p>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">{report.status}</span>
      </div>

      <div className="mt-4">
        <p className="font-mono text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">Member report</p>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-foreground">{report.reason}</p>
      </div>

      <div className="mt-4 rounded-2xl bg-secondary/55 px-4 py-3">
        <p className="font-mono text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">Reported AI response</p>
        <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-foreground">{report.responseText}</p>
      </div>

      {(report.lessonId || report.recordingId || report.responseId || report.conversationId) && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[0.62rem] text-muted-foreground">
          {report.lessonId && <span className="rounded-full bg-secondary px-2.5 py-1">Lesson {report.lessonId}</span>}
          {report.recordingId && <span className="rounded-full bg-secondary px-2.5 py-1">Recording linked</span>}
          {report.responseId && <span className="rounded-full bg-secondary px-2.5 py-1">Response linked</span>}
          {report.conversationId && <span className="rounded-full bg-secondary px-2.5 py-1">Conversation linked</span>}
        </div>
      )}

      <label className="mt-4 block">
        <span className="text-xs font-semibold text-muted-foreground">Private note <span className="font-normal">optional</span></span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value.slice(0, 2000))}
          rows={2}
          maxLength={2000}
          placeholder="Add a short note for yourself about what you found."
          className="mt-2 w-full resize-y rounded-2xl border border-border bg-background px-3 py-3 text-sm leading-6 outline-none focus:border-brand"
        />
      </label>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {report.status === "open" ? (
          <>
            <button type="button" onClick={() => setPendingStatus("reviewed")} disabled={Boolean(busy)} className="rounded-full bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">Mark reviewed</button>
            <button type="button" onClick={() => setPendingStatus("dismissed")} disabled={Boolean(busy)} className="rounded-full border border-border bg-background px-4 py-3 text-xs font-semibold disabled:opacity-50">Dismiss</button>
            <button type="button" onClick={() => setPendingStatus("actioned")} disabled={Boolean(busy)} className="col-span-2 rounded-full border border-brand/35 bg-brand-soft px-4 py-3 text-xs font-semibold text-brand disabled:opacity-50">Mark handled</button>
          </>
        ) : (
          <button type="button" onClick={() => setPendingStatus("open")} disabled={Boolean(busy)} className="col-span-2 rounded-full border border-border bg-background px-4 py-3 text-xs font-semibold disabled:opacity-50">Reopen report</button>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title={confirmationTitle(pendingStatus)}
        confirmLabel={confirmationButton(pendingStatus)}
        tone={pendingStatus === "dismissed" ? "danger" : "brand"}
        busy={Boolean(busy)}
        onCancel={() => { if (!busy) setPendingStatus(null) }}
        onConfirm={() => { if (pendingStatus) void update(pendingStatus) }}
      >
        {confirmationMessage(pendingStatus)}
      </ConfirmDialog>
    </article>
  )
}

function confirmationTitle(status: AiResponseReportStatus | null) {
  if (status === "dismissed") return "Dismiss this report?"
  if (status === "actioned") return "Mark this report handled?"
  if (status === "reviewed") return "Mark this report reviewed?"
  if (status === "open") return "Reopen this report?"
  return "Update this report?"
}

function confirmationButton(status: AiResponseReportStatus | null) {
  if (status === "dismissed") return "Dismiss report"
  if (status === "actioned") return "Mark handled"
  if (status === "reviewed") return "Mark reviewed"
  if (status === "open") return "Reopen"
  return "Confirm"
}

function confirmationMessage(status: AiResponseReportStatus | null) {
  if (status === "dismissed") return "This records that you reviewed the report and decided no action is needed. You can reopen it later."
  if (status === "actioned") return "Use this after you have actually handled the issue. The report will move to Handled."
  if (status === "reviewed") return "This records that you read the report. It does not change the member's account or content."
  if (status === "open") return "The report will return to New so you can review it again."
  return "The report status will be updated."
}
