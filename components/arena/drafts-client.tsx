"use client"

import Link from "next/link"
import { ArrowLeft, ArrowRight, FileText } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { useApp } from "@/lib/app-state"
import { displayRecordingContext, formatRecordingDateTime, recordingHasGrade } from "@/lib/recordings"

export function DraftsClient() {
  const { state } = useApp()
  const drafts = state.recordings.filter((recording) => !recordingHasGrade(recording) && recording.transcript.trim())

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <Link href="/studio/recordings" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Recordings
        </Link>
        <div className="mt-4">
          <Eyebrow>Private archive</Eyebrow>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Past drafts</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Transcribed stories that have not been graded yet.</p>
      </header>

      {drafts.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-border p-8 text-center">
          <FileText className="mx-auto h-7 w-7 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">No drafts waiting</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">If you leave after a story is transcribed, it will stay here until you finish grading it.</p>
          <Link href="/studio" className="mt-5 inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground">Open Studio</Link>
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {drafts.map((recording) => {
            const context = displayRecordingContext(recording)
            return (
              <article key={recording.id} className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold leading-snug text-balance">{recording.title || "Untitled story"}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {context !== "Draft" ? `${context} · ` : ""}{formatRecordingDateTime(recording.createdAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1.5 text-[0.68rem] font-semibold text-muted-foreground">Draft</span>
                </div>
                <p className="mt-4 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{recording.transcript}</p>
                <Link href={`/studio?draft=${encodeURIComponent(recording.id)}`} className="mt-5 flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground active:scale-[0.98]">
                  Continue grading <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
