"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertCircle, ArrowLeft, MessageCircle, Mic2, RotateCcw, Share2, Trash2 } from "lucide-react"
import { MediaPlayer } from "@/components/arena/media-player"
import { Eyebrow } from "@/components/eyebrow"
import { ConfirmDialog, NoticeDialog } from "@/components/confirm-dialog"
import { CountUp } from "@/components/ui/count-up"
import { ShareRecordingDialog } from "@/components/community/share-recording-dialog"
import { useApp, type Recording } from "@/lib/app-state"

export function RecordingsClient() {
  const { state, deleteRecording } = useApp()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [shareTarget, setShareTarget] = useState<Recording | null>(null)
  const [sharedPosts, setSharedPosts] = useState<Record<string, string>>({})
  const [shareNotice, setShareNotice] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState("")

  async function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete
    setDeletingId(id)
    setDeleteError("")
    try {
      await deleteRecording(id)
      setPendingDelete(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "The recording could not be deleted. Try again.")
      setPendingDelete(null)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="flex min-w-0 flex-col gap-6">
        <header>
          <Link href="/studio" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Studio</Link>
          <div className="mt-4">
            <div><Eyebrow>Private archive</Eyebrow><h1 className="mt-2 text-2xl font-semibold tracking-tight">Your recordings</h1></div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your private recordings, transcripts, and scores.</p>
        </header>

        {deleteError && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{deleteError}</span>
          </p>
        )}

        {state.recordings.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-border p-8 text-center">
            <Mic2 className="mx-auto h-7 w-7 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold">No recordings yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Record a story and it will appear here.</p>
            <Link href="/studio" className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Open Studio</Link>
          </section>
        ) : (
          <div className="flex flex-col gap-4">
            {state.recordings.map((recording) => {
              const hasGrade = recording.overall > 0
              const strengths = recording.strengths?.length ? recording.strengths : recording.praise ? [recording.praise] : []
              const improvements = recording.improvements?.length ? recording.improvements : recording.weakness || recording.fix ? [recording.weakness || recording.fix] : []
              return (
                <article key={recording.id} className="rounded-3xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold leading-snug">{recording.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{recording.context} · {new Date(recording.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {formatTime(recording.duration)}</p>
                    </div>
                    <span className="rounded-2xl bg-brand-soft px-3 py-2 text-sm font-semibold text-accent-foreground">{hasGrade ? recording.overall : "Saved"}</span>
                  </div>
                  <MediaPlayer recordingId={recording.id} kind={recording.mediaKind} cloudStoragePath={recording.cloudStoragePath} durationSeconds={recording.duration} />
                  {hasGrade && (
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <Score label="Hook" value={recording.scores.hook} />
                      <Score label="Development" value={recording.scores.development} />
                      <Score label="Landing" value={recording.scores.landing} />
                    </div>
                  )}
                  <details className="mt-4">
                    <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">{hasGrade ? "Grade and revised story" : "Transcript"}</summary>
                    {hasGrade && strengths.length > 0 && (
                      <div className="mt-3 rounded-2xl bg-emerald-50 p-4 text-sm leading-relaxed">
                        <p className="font-semibold text-emerald-800">What worked</p>
                        <ul className="mt-2 space-y-1.5 pl-5">{strengths.map((item, index) => <li key={index} className="list-disc">{item}</li>)}</ul>
                      </div>
                    )}
                    {hasGrade && improvements.length > 0 && (
                      <div className="mt-3 rounded-2xl bg-red-50 p-4 text-sm leading-relaxed">
                        <p className="font-semibold text-red-800">What to improve</p>
                        <ul className="mt-2 space-y-1.5 pl-5">{improvements.map((item, index) => <li key={index} className="list-disc">{item}</li>)}</ul>
                      </div>
                    )}
                    {hasGrade && (recording.levelUp || recording.nextTake) && <div className="mt-3 rounded-2xl bg-brand-soft p-4 text-sm leading-relaxed"><strong>Try this next:</strong> {recording.levelUp || recording.nextTake}</div>}
                    <div className="mt-3 rounded-2xl bg-secondary p-4">
                      <p className="text-sm font-semibold">{hasGrade ? "Revised story" : "Transcript"}</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground/90">{hasGrade ? recording.revisedStory || recording.transcript : recording.transcript}</p>
                    </div>
                  </details>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link href={`/coach?recording=${recording.id}`} className="flex items-center justify-center gap-1.5 rounded-full bg-brand px-3 py-2.5 text-xs font-semibold text-brand-foreground"><MessageCircle className="h-3.5 w-3.5" />Ask Parch</Link>
                    <Link href="/studio" className="flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2.5 text-xs font-semibold"><RotateCcw className="h-3.5 w-3.5" />Record again</Link>
                    {sharedPosts[recording.id] ? (
                      <Link href={`/community#${sharedPosts[recording.id]}`} className="flex items-center justify-center gap-1.5 rounded-full border border-brand bg-brand-soft px-3 py-2.5 text-xs font-semibold text-accent-foreground"><Share2 className="h-3.5 w-3.5" />View shared</Link>
                    ) : state.premium ? (
                      <button
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(new Event("storytuner:pause-media"))
                          setShareTarget(recording)
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2.5 text-xs font-semibold"
                      ><Share2 className="h-3.5 w-3.5" />Share to Community</button>
                    ) : (
                      <Link href="/membership?from=community" className="flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2.5 text-xs font-semibold"><Share2 className="h-3.5 w-3.5" />Unlock sharing</Link>
                    )}
                    <button type="button" onClick={() => setPendingDelete(recording.id)} disabled={deletingId === recording.id} className="flex items-center justify-center gap-1.5 rounded-full border border-destructive/25 px-3 py-2.5 text-xs font-semibold text-destructive disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
      <ShareRecordingDialog
        open={Boolean(shareTarget)}
        recording={shareTarget}
        onClose={() => setShareTarget(null)}
        onShared={(post) => {
          if (shareTarget) setSharedPosts((current) => ({ ...current, [shareTarget.id]: post.id }))
          setShareNotice("Your recording is now in Community. Your private original was not changed.")
        }}
      />
      <NoticeDialog open={Boolean(shareNotice)} title="Shared to Community" onClose={() => setShareNotice("")}>{shareNotice}</NoticeDialog>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this recording?"
        confirmLabel="Delete recording"
        busy={Boolean(deletingId)}
        onCancel={() => { if (!deletingId) setPendingDelete(null) }}
        onConfirm={() => void confirmDelete()}
      >
        This permanently removes the recording from this device, private cloud storage, and your synced archive. <strong className="text-foreground">This cannot be undone.</strong>
      </ConfirmDialog>
    </>
  )
}

function Score({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-secondary px-2 py-3"><CountUp value={value} className="text-sm font-semibold" /><p className="mt-0.5 font-mono text-[0.5rem] uppercase tracking-wider text-muted-foreground">{label}</p></div>
}
function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` }
