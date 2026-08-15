"use client"

import { useEffect, useMemo, useState } from "react"
import { FileText, Headphones, LoaderCircle, Send, X } from "lucide-react"
import type { Recording } from "@/lib/app-state"
import type { CommunityFeedPost } from "@/lib/community/types"
import { cn } from "@/lib/utils"

type ShareMode = "transcript" | "audio"

type Props = { open: boolean; recording: Recording | null; onClose: () => void; onShared: (post: CommunityFeedPost) => void }
type ApiPayload = { post?: CommunityFeedPost; heldForReview?: boolean; message?: string; error?: string }

const modes: { id: ShareMode; title: string; description: string; icon: typeof FileText }[] = [
  { id: "audio", title: "Share audio", description: "Let members listen. The transcript stays private.", icon: Headphones },
  { id: "transcript", title: "Share transcript", description: "Share the words only. Your audio stays private.", icon: FileText },
]

export function ShareRecordingDialog({ open, recording, onClose, onShared }: Props) {
  const [mode, setMode] = useState<ShareMode>("transcript")
  const [message, setMessage] = useState("")
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState("")
  const [heldMessage, setHeldMessage] = useState("")
  const hasTranscript = Boolean(recording?.transcript?.trim())
  const hasCloudAudio = Boolean(recording?.cloudRecordingId && recording?.cloudStoragePath)
  const audioWithinDuration = Boolean(recording && recording.duration > 0 && recording.duration <= 300)
  const audioEligible = hasCloudAudio && audioWithinDuration && hasTranscript

  useEffect(() => {
    if (!open) return
    setError("")
    setHeldMessage("")
    setMessage("")
    setMode(audioEligible ? "audio" : "transcript")
  }, [open, audioEligible])

  const selectedAvailable = useMemo(() => {
    if (!recording) return false
    return mode === "transcript" ? hasTranscript : audioEligible
  }, [recording, mode, hasTranscript, audioEligible])

  if (!open || !recording) return null
  const activeRecording = recording

  async function share() {
    if (!selectedAvailable || sharing) return
    setSharing(true)
    setError("")
    setHeldMessage("")
    try {
      const response = await fetch("/api/community/share-recording", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ mode, recordingId: activeRecording.cloudRecordingId ?? null, title: activeRecording.title, transcript: activeRecording.transcript, message: message.trim() }),
      })
      const payload = (await response.json()) as ApiPayload
      if (response.ok && payload.heldForReview) { setHeldMessage(payload.message || "This share is being held for moderator review."); return }
      if (!response.ok || !payload.post) throw new Error(payload.error || "This recording could not be shared.")
      onShared(payload.post)
      onClose()
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "This recording could not be shared.")
    } finally { setSharing(false) }
  }

  return (
    <div className="app-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="share-recording-title">
      <div className="app-dialog-panel rounded-[2rem] border border-border bg-background p-5 shadow-2xl" style={{ width: "calc(100% - 2.5rem)", maxWidth: "24rem" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">Share a story</p><h2 id="share-recording-title" className="mt-1 text-lg font-semibold">Choose what people can see</h2><p className="mt-1 truncate text-xs text-muted-foreground">{activeRecording.title}</p></div>
          <button type="button" onClick={onClose} disabled={sharing} className="rounded-full p-2 text-muted-foreground hover:bg-secondary" aria-label="Close sharing options"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {modes.map((option) => {
            const available = option.id === "transcript" ? hasTranscript : audioEligible
            const Icon = option.icon
            return (
              <button key={option.id} type="button" disabled={!available || sharing} onClick={() => setMode(option.id)} className={cn("min-h-32 rounded-2xl border p-4 text-left transition-all duration-200", mode === option.id ? "border-brand bg-brand-soft/55 shadow-sm" : "border-border bg-card hover:border-brand/45", !available && "cursor-not-allowed opacity-45")}>
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-secondary"><Icon className="h-4.5 w-4.5" /></span><span className="mt-3 block text-sm font-semibold">{option.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
              </button>
            )
          })}
        </div>

        {!audioEligible && <p className="mt-2 text-[0.68rem] leading-5 text-muted-foreground">{!hasCloudAudio ? "Audio is unavailable for older device-only recordings. You can still share the transcript." : !audioWithinDuration ? "Community audio is limited to 5 minutes. You can still share the transcript." : "Audio sharing requires a completed transcript for safety review."}</p>}

        <label className="mt-5 block">
          <span className="text-xs font-semibold">Add a message <span className="font-normal text-muted-foreground">optional</span></span>
          <textarea value={message} onChange={(event) => setMessage(event.target.value.slice(0, 1000))} rows={3} maxLength={1000} placeholder="For example: This is my first story. I would love feedback on the ending." className="mt-2 w-full resize-y rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus:border-brand" />
          <span className="mt-1 block text-right font-mono text-[0.6rem] text-muted-foreground">{message.length}/1000</span>
        </label>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">Only the option you choose is shared. Your original recording remains private.</p>
        {error && <p className="mt-3 rounded-2xl bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive" role="alert">{error}</p>}
        {heldMessage && <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900" role="status">{heldMessage}</p>}
        <div className="mt-5 flex gap-2"><button type="button" onClick={onClose} disabled={sharing} className="flex-1 rounded-full border border-border px-4 py-3 text-sm font-semibold">Cancel</button><button type="button" onClick={() => void share()} disabled={!selectedAvailable || sharing} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">{sharing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{sharing ? "Sharing…" : "Share story"}</button></div>
      </div>
    </div>
  )
}
