"use client"

import Link from "next/link"
import { ArrowLeft, MessageCircle, Mic2, RotateCcw, Share2, Trash2 } from "lucide-react"
import { MediaPlayer } from "@/components/arena/media-player"
import { Eyebrow } from "@/components/eyebrow"
import { useApp } from "@/lib/app-state"

export function RecordingsClient() {
  const { state, deleteRecording, shareRecording } = useApp()
  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link href="/arena" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Arena</Link>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div><Eyebrow>Private archive</Eyebrow><h1 className="mt-2 text-2xl font-semibold tracking-tight">Your recordings</h1></div>
          <Link href="/arena" className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">New take</Link>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Review past takes, ask Weaver about the feedback, or choose a recording to share. Nothing is public by default.</p>
      </header>

      {state.recordings.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-border p-8 text-center">
          <Mic2 className="mx-auto h-7 w-7 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">No recordings yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Record a story and it will appear here.</p>
          <Link href="/arena" className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Open Arena</Link>
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {state.recordings.map((recording) => (
            <article key={recording.id} className="rounded-3xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold leading-snug">{recording.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{recording.context} · {new Date(recording.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {formatTime(recording.duration)}</p>
                </div>
                <span className="rounded-2xl bg-brand-soft px-3 py-2 text-sm font-semibold text-accent-foreground">{recording.overall}</span>
              </div>
              <MediaPlayer recordingId={recording.id} kind={recording.mediaKind} />
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Score label="Hook" value={recording.scores.hook} />
                <Score label="Development" value={recording.scores.development} />
                <Score label="Landing" value={recording.scores.landing} />
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Transcript and feedback</summary>
                <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-secondary p-4 text-sm leading-7">{recording.transcript}</p>
                <div className="mt-3 space-y-2 text-sm leading-relaxed">
                  <p><strong>Strongest:</strong> {recording.praise}</p>
                  <p><strong>Needs work:</strong> {recording.weakness || recording.fix}</p>
                  <p><strong>Level up now:</strong> {recording.levelUp || recording.nextTake}</p>
                </div>
              </details>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href={`/coach?recording=${recording.id}`} className="flex items-center justify-center gap-1.5 rounded-full bg-brand px-3 py-2.5 text-xs font-semibold text-brand-foreground"><MessageCircle className="h-3.5 w-3.5" />Ask Weaver</Link>
                <Link href="/arena" className="flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2.5 text-xs font-semibold"><RotateCcw className="h-3.5 w-3.5" />Record again</Link>
                <button type="button" disabled={recording.shared} onClick={() => shareRecording(recording.id)} className="flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2.5 text-xs font-semibold disabled:opacity-60"><Share2 className="h-3.5 w-3.5" />{recording.shared ? "Shared" : state.premium || recording.mediaKind === "none" ? "Share" : "Share transcript"}</button>
                <button type="button" onClick={() => { if (window.confirm("Delete this recording permanently?")) void deleteRecording(recording.id) }} className="flex items-center justify-center gap-1.5 rounded-full border border-destructive/25 px-3 py-2.5 text-xs font-semibold text-destructive"><Trash2 className="h-3.5 w-3.5" />Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function Score({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-secondary px-2 py-3"><p className="text-sm font-semibold">{value}</p><p className="mt-0.5 font-mono text-[0.5rem] uppercase tracking-wider text-muted-foreground">{label}</p></div>
}
function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` }
