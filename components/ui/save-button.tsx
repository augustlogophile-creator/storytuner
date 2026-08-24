"use client"

import { useState } from "react"
import { Check, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

type SaveStatus = "idle" | "saving" | "saved"

export function SaveButton({
  onSave,
  disabled = false,
  className,
}: {
  onSave: () => Promise<void> | void
  disabled?: boolean
  className?: string
}) {
  const [status, setStatus] = useState<SaveStatus>("idle")

  async function handleSave() {
    if (disabled || status !== "idle") return
    setStatus("saving")
    try {
      await onSave()
      setStatus("saved")
    } catch {
      setStatus("idle")
    }
  }

  return (
    <button
      type="button"
      className={cn("tellwise-save-button", className)}
      data-status={status}
      disabled={disabled || status !== "idle"}
      onClick={() => void handleSave()}
      aria-live="polite"
    >
      {status === "idle" && <span className="tellwise-save-shimmer" aria-hidden="true" />}
      <span className="tellwise-save-backdrop" aria-hidden="true" />
      <span className="tellwise-save-content">
        {status === "saving" && <Loader2 className="tellwise-save-spinner" aria-hidden="true" />}
        {status === "saved" && <Check aria-hidden="true" />}
        <span>{status === "idle" ? "Save" : status === "saving" ? "Saving…" : "Saved"}</span>
      </span>
      {status === "saved" && <Sparkles className="tellwise-save-sparkle" aria-hidden="true" />}
    </button>
  )
}
