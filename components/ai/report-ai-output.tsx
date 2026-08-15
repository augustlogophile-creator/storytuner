"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { Check, Flag, Loader2, X } from "lucide-react"

type AiReportSource = "coach" | "practice" | "check" | "studio" | "planner" | "other"

type ReportAiOutputProps = {
  source: AiReportSource
  content: string
  className?: string
  responseId?: string | null
  lessonId?: string | null
  recordingId?: string | null
  conversationId?: string | null
}

export function ReportAiOutput({
  source,
  content,
  className = "",
  responseId,
  lessonId,
  recordingId,
  conversationId,
}: ReportAiOutputProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  if (!content.trim()) return null

  async function report() {
    const cleanReason = reason.trim()
    if (status === "sending" || status === "sent" || cleanReason.length < 3) return
    setStatus("sending")
    try {
      const response = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          surface: source,
          responseText: content,
          reason: cleanReason,
          responseId: responseId ?? null,
          lessonId: lessonId ?? null,
          recordingId: recordingId ?? null,
          conversationId: conversationId ?? null,
        }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(payload.error || "Report failed")
      setStatus("sent")
      window.setTimeout(() => setOpen(false), 650)
    } catch {
      setStatus("error")
    }
  }

  const reportButton = (
    <button
      type="button"
      onClick={() => { if (status !== "sent") { setStatus("idle"); setOpen(true) } }}
      disabled={status === "sent"}
      className={`group inline-flex min-h-7 w-fit items-center gap-2 py-1 text-[0.7rem] font-semibold text-destructive transition-colors hover:text-red-700 disabled:cursor-default disabled:text-muted-foreground ${className}`}
      aria-label={status === "sent" ? "AI response reported" : "Report this AI response"}
    >
      {status === "sent"
        ? <Check className="h-3.5 w-3.5 shrink-0" />
        : <Flag className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-y-px" />}
      <span>{status === "sent" ? "Reported" : status === "error" ? "Try report again" : "Report AI response"}</span>
    </button>
  )

  const dialog = open && typeof document !== "undefined" ? createPortal(
    <div className="app-dialog-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && status !== "sending") setOpen(false) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="report-ai-title" className="app-dialog-panel max-w-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">Report AI reply</p>
            <h2 id="report-ai-title" className="mt-1.5 text-lg font-semibold tracking-[-0.025em]">What’s wrong with this reply?</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Tell us what felt incorrect, unhelpful, unsafe, or off.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} disabled={status === "sending"} className="app-dialog-close" aria-label="Close report dialog"><X className="h-4 w-4" /></button>
        </div>

        <textarea
          value={reason}
          onChange={(event) => { setReason(event.target.value.slice(0, 1000)); if (status === "error") setStatus("idle") }}
          rows={5}
          maxLength={1000}
          autoFocus
          placeholder="Describe what was wrong with this reply…"
          className="mt-5 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus:border-destructive/60"
        />
        <div className="mt-1 flex items-center justify-between text-[0.65rem] text-muted-foreground">
          <span>{status === "error" ? "Could not send. Try again." : status === "sent" ? "Report sent." : "At least 3 characters"}</span>
          <span className="font-mono">{reason.length}/1000</span>
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => setOpen(false)} disabled={status === "sending"} className="app-dialog-secondary-button flex-1">Cancel</button>
          <button type="button" onClick={() => void report()} disabled={reason.trim().length < 3 || status === "sending" || status === "sent"} className="app-dialog-primary-button is-danger flex flex-1 items-center justify-center gap-2 disabled:opacity-40">
            {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : status === "sent" ? <Check className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
            {status === "sending" ? "Sending…" : status === "sent" ? "Sent" : "Report reply"}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  ) : null

  return <>{reportButton}{dialog}</>
}
