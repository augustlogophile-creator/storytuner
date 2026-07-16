"use client"

import { useEffect, type MouseEvent, type ReactNode } from "react"
import { AlertTriangle, X } from "lucide-react"

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: "danger" | "brand"
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [busy, onCancel, open])

  if (!open) return null

  const danger = tone === "danger"
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:items-center sm:p-6" role="presentation" onMouseDown={(event: MouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="w-full max-w-md rounded-[1.75rem] border border-border bg-card p-5 shadow-2xl sm:p-6">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${danger ? "bg-destructive/10 text-destructive" : "bg-brand-soft text-accent-foreground"}`}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-lg font-semibold tracking-tight">{title}</h2>
            <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40" aria-label="Close confirmation">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-secondary disabled:opacity-40">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`rounded-full px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50 ${danger ? "bg-destructive hover:bg-destructive/90" : "bg-brand hover:bg-brand/90"}`}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
