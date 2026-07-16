"use client"

import { useEffect, useId, type MouseEvent, type ReactNode } from "react"
import { AlertTriangle, CheckCircle2, X } from "lucide-react"

function DialogFrame({
  open,
  busy = false,
  labelledBy,
  onClose,
  children,
}: {
  open: boolean
  busy?: boolean
  labelledBy: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [busy, onClose, open])

  if (!open) return null

  return (
    <div
      className="app-dialog-overlay"
      role="presentation"
      onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="app-dialog-panel max-w-sm">
        {children}
      </section>
    </div>
  )
}

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
  const titleId = useId()
  const danger = tone === "danger"

  return (
    <DialogFrame open={open} busy={busy} labelledBy={titleId} onClose={onCancel}>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${danger ? "bg-destructive/10 text-destructive" : "bg-brand-soft text-accent-foreground"}`}>
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-semibold tracking-[-0.02em]">{title}</h2>
          <div className="mt-1.5 text-sm leading-6 text-muted-foreground">{children}</div>
        </div>
        <button type="button" onClick={onCancel} disabled={busy} className="app-dialog-close" aria-label="Close confirmation">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="app-dialog-secondary-button">
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm} disabled={busy} className={`app-dialog-primary-button ${danger ? "is-danger" : "is-brand"}`}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </DialogFrame>
  )
}

export function NoticeDialog({
  open,
  title,
  children,
  actionLabel = "Done",
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  actionLabel?: string
  onClose: () => void
}) {
  const titleId = useId()

  return (
    <DialogFrame open={open} labelledBy={titleId} onClose={onClose}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-accent-foreground">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-semibold tracking-[-0.02em]">{title}</h2>
          <div className="mt-1.5 text-sm leading-6 text-muted-foreground">{children}</div>
        </div>
        <button type="button" onClick={onClose} className="app-dialog-close" aria-label="Close message">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="app-dialog-primary-button is-brand">{actionLabel}</button>
      </div>
    </DialogFrame>
  )
}
