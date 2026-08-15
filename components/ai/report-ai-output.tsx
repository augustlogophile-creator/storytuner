"use client"

import { useState } from "react"
import { Check, Flag } from "lucide-react"

type AiReportSource = "coach" | "arena" | "lesson" | "checkpoint" | "planner"

export function ReportAiOutput({ source, content, className = "" }: { source: AiReportSource; content: string; className?: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  if (!content.trim()) return null

  async function report() {
    if (status === "sending" || status === "sent") return
    setStatus("sending")
    try {
      const response = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, content }),
      })
      if (!response.ok) throw new Error("report failed")
      setStatus("sent")
    } catch {
      setStatus("error")
    }
  }

  return (
    <button
      type="button"
      onClick={() => void report()}
      disabled={status === "sending" || status === "sent"}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold text-muted-foreground transition-colors hover:bg-secondary disabled:cursor-default ${className}`}
      aria-label={status === "sent" ? "AI response reported" : "Report this AI response"}
    >
      {status === "sent" ? <Check className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
      {status === "sending" ? "Reporting…" : status === "sent" ? "Reported" : status === "error" ? "Try report again" : "Report AI response"}
    </button>
  )
}
