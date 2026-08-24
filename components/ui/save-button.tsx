"use client"

import { useState } from "react"
import { Check, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

type SaveStatus = "idle" | "saving" | "saved"

interface SaveButtonProps {
  text?: {
    idle?: string
    saving?: string
    saved?: string
  }
  className?: string
  onSave?: () => Promise<void> | void
  onSaved?: () => Promise<void> | void
  disabled?: boolean
  particleCount?: number
}

export function SaveButton({
  text = { idle: "Save", saving: "Saving…", saved: "Saved!" },
  className,
  onSave,
  onSaved,
  disabled = false,
  particleCount = 10,
}: SaveButtonProps) {
  const [status, setStatus] = useState<SaveStatus>("idle")
  const [celebrationKey, setCelebrationKey] = useState(0)

  async function handleSave() {
    if (disabled || status !== "idle") return
    setStatus("saving")
    try {
      await onSave?.()
      setStatus("saved")
      setCelebrationKey((value) => value + 1)
      window.setTimeout(() => {
        void onSaved?.()
        setStatus("idle")
      }, 460)
    } catch {
      setStatus("idle")
    }
  }

  const particles = Array.from({ length: particleCount }, (_, index) => index)

  return (
    <div className={cn("tellwise-save-wrap", className)}>
      <button
        type="button"
        className="tellwise-save-button"
        data-status={status}
        disabled={disabled || status !== "idle"}
        onClick={() => void handleSave()}
        aria-live="polite"
      >
        {status === "idle" && <span className="tellwise-save-shimmer" aria-hidden="true" />}
        <span className="tellwise-save-backdrop" aria-hidden="true" />
        <span className="tellwise-save-content" key={status}>
          {status === "saving" && <Loader2 className="tellwise-save-spinner" aria-hidden="true" />}
          {status === "saved" && <Check aria-hidden="true" />}
          <span>{status === "idle" ? text.idle : status === "saving" ? text.saving : text.saved}</span>
        </span>
      </button>

      {status === "saved" && (
        <div key={celebrationKey} className="tellwise-save-celebration" aria-hidden="true">
          <Sparkles className="tellwise-save-sparkle" />
          {particles.map((index) => (
            <i
              key={index}
              className="tellwise-save-particle"
              style={{
                "--particle-angle": `${(360 / particles.length) * index}deg`,
                "--particle-delay": `${(index % 4) * 18}ms`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default SaveButton
