"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, X } from "lucide-react"

export function AccountRestoredNotice({ message, updatedAt }: { message: string; updatedAt: string | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) return
    const key = `storytuner:moderation-notice:${updatedAt ?? message}`
    if (sessionStorage.getItem(key) === "dismissed") return
    setVisible(true)
  }, [message, updatedAt])

  if (!visible) return null

  function dismiss() {
    const key = `storytuner:moderation-notice:${updatedAt ?? message}`
    sessionStorage.setItem(key, "dismissed")
    setVisible(false)
  }

  return (
    <div className="flex items-start gap-3 rounded-3xl border border-brand/30 bg-brand-soft/50 p-4">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Account access restored</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{message}</p>
      </div>
      <button type="button" onClick={dismiss} className="rounded-full p-1.5 text-muted-foreground hover:bg-background" aria-label="Dismiss notice"><X className="h-3.5 w-3.5" /></button>
    </div>
  )
}
