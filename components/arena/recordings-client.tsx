"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertCircle, ArrowLeft, MessageCircle, Mic2, RotateCcw, Share2, Trash2 } from "lucide-react"
import { MediaPlayer } from "@/components/arena/media-player"
import { Eyebrow } from "@/components/eyebrow"
import { ConfirmDialog, NoticeDialog } from "@/components/confirm-dialog"
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
      <div className="flex min-w-0 flex-col gap-5">
        <header className="app-page-enter">
          <Link href="/arena" className="group inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Arena</Link>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div><Eyebrow>Private archive</Eyebrow><h1 className="text-title mt-2.5 text-[1.72rem] leading-[1.03]">Your recordings</h1></div>
            <Link href="/arena" className="press rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">New story</Link>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your private audio, transcripts, scores, and revisions stay with your account across devices. Full video stays on the device where you recorded it.</p>
        </header>

        {deleteError && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{deleteError}</span>
          </p>
        )}

        {state.recordings.length === 0 ? (
          <section className="app-surface rounded-[1.4rem] border border-dashed border-border bg-card/65 p-5 text-center">
            <Mic2 className="mx-auto h-7 w-7 text-muted-foreground" />
            <h2 className="text-title mt-4 text-[1.28rem]">No recordings yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Record a story and it will appear here.</p>
            <Link href="/arena" className="press mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-[0.82rem] font-medium text-primary-foreground">Open Arena</Link>
          </section>
        ) : (
          <div className="flex flex-col gap-4">
            {state.recordings.map((recording) => {
              const hasGrade = recording.overall > 0
              const strengths = recording.strengths?.length ? recording.strengths : recording.praise ? [recording.praise] : []
              const improvements = recording.improvements?.length ? recording.improvements : recording.weakness || recording.fix ? [recording.weakness || recording.fix] : []
              return (
                <article key={recording.id} className="app-surface rounded-[1.3rem] border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-title text-[1.05rem] leading-snug">{recording.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{recording.context} · {new Date(recording.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {formatTime(recording.duration)}</p>
                    </div>
                    <span className="rounded-xl bg-brand-soft px-2.5 py-1.5 text-[0.76rem] font-medium text-accent-foreground">{hasGrade ? recording.overall : "Saved"}</span>
                  </div>
                  <MediaPlayer recordingId={recording.id} kind={recording.mediaKind} cloudStoragePath={recording.cloudStoragePath} />
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
                      <div className="mt-3 rounded-2xl bg-brand-soft/60 p-4 text-sm leading-relaxed">
                        <p className="font-semibold text-accent-foreground">What worked</p>
                        <ul className="mt-2 space-y-1.5 pl-5">{strengths.map((item, index) => <li key={index} className="list-disc">{item}</li>)}</ul>
                      </div>
                    )}
                    {hasGrade && improvements.length > 0 && (
                      <div className="mt-3 rounded-2xl bg-secondary/65 p-4 text-sm leading-relaxed">
                        <p className="font-semibold text-foreground">What to improve</p>
                        <ul className="mt-2 space-y-1.5 pl-5">{improvements.map((item, index) => <li key={index} className="list-disc">{item}</li>)}</ul>
                      </div>
                    )}
                    {hasGrade && (recording.levelUp || recording.nextTake) && <div className="mt-3 rounded-2xl bg-brand-soft p-4 text-sm leading-relaxed"><strong>Try this next:</strong> {recording.levelUp || recording.nextTake}</div>}
                    <div className="mt-3 rounded-2xl bg-secondary p-4">
                      <p className="text-[0.82rem] font-medium">{hasGrade ? "Revised story" : "Transcript"}</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground/90">{hasGrade ? recording.revisedStory || recording.transcript : recording.transcript}</p>
                    </div>
                  </details>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link href={`/coach?recording=${recording.id}`} className="press flex items-center justify-center gap-1.5 rounded-full bg-brand px-3 py-2 text-[0.7rem] font-medium text-brand-foreground"><MessageCircle className="h-3.5 w-3.5" />Ask Weaver</Link>
                    <Link href="/arena" className="press flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2 text-[0.7rem] font-medium"><RotateCcw className="h-3.5 w-3.5" />Record again</Link>
                    {sharedPosts[recording.id] ? (
                      <Link href={`/community#${sharedPosts[recording.id]}`} className="press flex items-center justify-center gap-1.5 rounded-full border border-brand bg-brand-soft px-3 py-2 text-[0.7rem] font-medium text-accent-foreground"><Share2 className="h-3.5 w-3.5" />View shared</Link>
                    ) : state.premium ? (
                      <button type="button" onClick={() => setShareTarget(recording)} className="press flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2 text-[0.7rem] font-medium"><Share2 className="h-3.5 w-3.5" />Share to Community</button>
                    ) : (
                      <Link href="/membership" className="press flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2 text-[0.7rem] font-medium"><Share2 className="h-3.5 w-3.5" />Unlock sharing</Link>
                    )}
                    <button type="button" onClick={() => setPendingDelete(recording.id)} disabled={deletingId === recording.id} className="press flex items-center justify-center gap-1.5 rounded-full border border-destructive/25 px-3 py-2 text-[0.7rem] font-medium text-destructive disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Delete</button>
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
  return <div className="rounded-2xl bg-secondary px-2 py-3"><p className="text-[0.82rem] font-medium">{value}</p><p className="mt-0.5 font-mono text-[0.5rem] uppercase tracking-wider text-muted-foreground">{label}</p></div>
}
function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` }
