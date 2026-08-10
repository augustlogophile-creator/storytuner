"use client"

import { useEffect, useMemo, useState } from "react"
import { FileText, Headphones, LoaderCircle, Share2, X } from "lucide-react"
import type { Recording } from "@/lib/app-state"
import type { CommunityFeedPost } from "@/lib/community/types"
import { cn } from "@/lib/utils"

type ShareMode = "transcript" | "audio" | "audio_transcript"

type Props = {
  open: boolean
  recording: Recording | null
  onClose: () => void
  onShared: (post: CommunityFeedPost) => void
}

type ApiPayload = {
  post?: CommunityFeedPost
  heldForReview?: boolean
  message?: string
  error?: string
}

const modes: { id: ShareMode; title: string; description: string; icon: typeof FileText }[] = [
  { id: "transcript", title: "Transcript", description: "Share the words only. Your audio stays private.", icon: FileText },
  { id: "audio", title: "Audio", description: "Share a private Community audio copy without showing the transcript.", icon: Headphones },
  { id: "audio_transcript", title: "Audio + transcript", description: "Let members listen and read along.", icon: Share2 },
]

export function ShareRecordingDialog({ open, recording, onClose, onShared }: Props) {
  const [mode, setMode] = useState<ShareMode>("transcript")
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState("")
  const [heldMessage, setHeldMessage] = useState("")

  const hasTranscript = Boolean(recording?.transcript?.trim())
  const hasCloudAudio = Boolean(recording?.cloudRecordingId && recording?.cloudStoragePath)
  const audioWithinDuration = Boolean(recording && recording.duration > 0 && recording.duration <= 300)
  const audioEligible = hasCloudAudio && audioWithinDuration

  useEffect(() => {
    if (!open) return
    setError("")
    setHeldMessage("")
    if (hasTranscript) setMode("transcript")
    else if (audioEligible) setMode("audio")
  }, [open, hasTranscript, audioEligible])

  const selectedAvailable = useMemo(() => {
    if (!recording) return false
    if (mode === "transcript") return hasTranscript
    if (mode === "audio") return audioEligible && hasTranscript
    return audioEligible && hasTranscript
  }, [recording, mode, hasTranscript, audioEligible])

  if (!open || !recording) return null

  async function share() {
    if (!selectedAvailable || sharing) return
    setSharing(true)
    setError("")
    setHeldMessage("")
    try {
      const response = await fetch("/api/community/share-recording", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          mode,
          recordingId: recording.cloudRecordingId ?? null,
          title: recording.title,
          transcript: recording.transcript,
        }),
      })
      const payload = (await response.json()) as ApiPayload
      if (response.ok && payload.heldForReview) {
        setHeldMessage(payload.message || "This share is being held for moderator review.")
        return
      }
      if (!response.ok || !payload.post) throw new Error(payload.error || "This recording could not be shared.")
      onShared(payload.post)
      onClose()
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "This recording could not be shared.")
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/35 p-3 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="share-recording-title">
      <div className="w-full max-w-md rounded-[2rem] border border-border bg-background p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">Share intentionally</p>
            <h2 id="share-recording-title" className="mt-1 text-lg font-semibold">Share to Community</h2>
            <p className="mt-1 truncate text-xs text-muted-foreground">{recording.title}</p>
          </div>
          <button type="button" onClick={onClose} disabled={sharing} className="rounded-full p-2 text-muted-foreground hover:bg-secondary" aria-label="Close sharing options">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-2">
          {modes.map((option) => {
            const needsAudio = option.id !== "transcript"
            const available = option.id === "transcript" ? hasTranscript : audioEligible && hasTranscript
            const Icon = option.icon
            return (
              <button
                key={option.id}
                type="button"
                disabled={!available || sharing}
                onClick={() => setMode(option.id)}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  mode === option.id ? "border-brand bg-brand-soft/45" : "border-border bg-card hover:bg-secondary/50",
                  !available && "cursor-not-allowed opacity-45",
                )}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{option.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                  {!available && needsAudio && !hasCloudAudio && <span className="mt-1 block text-[0.68rem] font-medium text-muted-foreground">Audio is unavailable for this older device-only recording.</span>}
                  {!available && needsAudio && hasCloudAudio && !audioWithinDuration && <span className="mt-1 block text-[0.68rem] font-medium text-muted-foreground">Community audio is limited to 5 minutes.</span>}
                </span>
              </button>
            )
          })}
        </div>

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          StoryTuner creates a separate Community copy. Your private recording stays private and is never shared automatically.
        </p>

        {error && <p className="mt-3 rounded-2xl bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive" role="alert">{error}</p>}
        {heldMessage && <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900" role="status">{heldMessage}</p>}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} disabled={sharing} className="flex-1 rounded-full border border-border px-4 py-3 text-sm font-semibold">Cancel</button>
          <button type="button" onClick={() => void share()} disabled={!selectedAvailable || sharing} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
            {sharing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            {sharing ? "Sharing…" : "Share"}
          </button>
        </div>
      </div>
    </div>
  )
}
