"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Mic2,
  PenLine,
  Search,
  SquarePen,
  Square,
  Trash2,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  deleteCloudRecording,
  uploadAndTranscribeRecording,
  type CloudRecordingRef,
  type CloudTranscriptionStage,
} from "@/lib/recording-cloud"

type TextEntry = {
  id: string
  user_id: string
  title: string
  body: string
  created_at: string
  updated_at: string
}

type DraftSeed = {
  title?: string
  body?: string
}

const JOURNAL_VOICE_MAX_SECONDS = 5 * 60

export function JournalClient() {
  const [entries, setEntries] = useState<TextEntry[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [composerOpen, setComposerOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [editing, setEditing] = useState<TextEntry | null>(null)
  const [draftSeed, setDraftSeed] = useState<DraftSeed | null>(null)
  const [detail, setDetail] = useState<TextEntry | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const supabase = createClient()
      const { data, error: loadError } = await supabase
        .from("journal_entries")
        .select("id,user_id,title,body,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(300)

      if (loadError) throw new Error(loadError.message)
      setEntries((data ?? []) as TextEntry[])
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Your Journal could not be loaded."
      if (message.toLowerCase().includes("journal_entries")) {
        setError("Journal needs its Supabase migration before notes can be saved.")
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visibleEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return entries
    return entries.filter((entry) => `${entry.title} ${entry.body}`.toLowerCase().includes(normalized))
  }, [entries, query])

  function startNewText(seed?: DraftSeed) {
    setEditing(null)
    setDraftSeed(seed ?? null)
    setComposerOpen(true)
  }

  function editEntry(entry: TextEntry) {
    setDetail(null)
    setEditing(entry)
    setDraftSeed(null)
    setComposerOpen(true)
  }

  return (
    <div className="journal-page min-h-full pb-4">
      <header className="journal-header">
        <p className="journal-running-head">Tellwise</p>
        <h1>Journal</h1>
        <p className="journal-deck">A quiet place for fragments, observations, and ideas you do not want to lose.</p>
      </header>

      <label className="journal-search" data-book-no-turn="true">
        <Search aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notes"
          aria-label="Search Journal notes"
          autoComplete="off"
          spellCheck="false"
        />
      </label>

      <div className="journal-section-heading">
        <span>{query ? "Search results" : "Notes"}</span>
        <span>{visibleEntries.length}</span>
      </div>

      {error && <p className="journal-error">{error}</p>}

      <section className="journal-list" aria-busy={loading}>
        {loading ? (
          <>
            <JournalSkeleton />
            <JournalSkeleton />
            <JournalSkeleton />
          </>
        ) : visibleEntries.length ? (
          visibleEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="journal-row"
              onClick={() => setDetail(entry)}
            >
              <span className="journal-row-copy">
                <span className="journal-row-heading">
                  <strong>{entry.title}</strong>
                  <time>{journalDate(entry.updated_at)}</time>
                </span>
                <span className="journal-row-preview">{compactPreview(entry.body)}</span>
              </span>
            </button>
          ))
        ) : (
          <div className="journal-empty">
            <PenLine className="h-5 w-5" strokeWidth={1.5} />
            <h2>{query ? "Nothing found" : "Start with one detail"}</h2>
            <p>
              {query
                ? "Try a different word or phrase."
                : "Write the line, image, memory, or thought now. You can decide what it becomes later."}
            </p>
          </div>
        )}
      </section>

      <div className="journal-compose-bar" aria-label="Journal creation tools">
        <span className="journal-compose-caption">Private by default</span>
        <button
          type="button"
          className="journal-compose-action is-voice"
          onClick={() => setVoiceOpen(true)}
          aria-label="Start a voice note"
        >
          <Mic2 />
        </button>
        <button
          type="button"
          className="journal-compose-action is-write"
          onClick={() => startNewText()}
          aria-label="Write a new note"
        >
          <SquarePen />
        </button>
      </div>

      {composerOpen && (
        <TextComposer
          entry={editing}
          initialTitle={draftSeed?.title ?? ""}
          initialBody={draftSeed?.body ?? ""}
          onClose={async () => {
            setComposerOpen(false)
            setEditing(null)
            setDraftSeed(null)
            await load()
          }}
        />
      )}

      {voiceOpen && (
        <VoiceCapture
          onClose={() => setVoiceOpen(false)}
          onTranscript={(transcript) => {
            setVoiceOpen(false)
            startNewText({ body: transcript, title: titleFromBody(transcript) })
          }}
        />
      )}

      {detail && (
        <EntryDetail
          entry={detail}
          onClose={() => setDetail(null)}
          onEdit={() => editEntry(detail)}
          onDeleted={async () => {
            setDetail(null)
            await load()
          }}
        />
      )}
    </div>
  )
}

function TextComposer({
  entry,
  initialTitle,
  initialBody,
  onClose,
}: {
  entry: TextEntry | null
  initialTitle: string
  initialBody: string
  onClose: () => void | Promise<void>
}) {
  const [title, setTitle] = useState(entry?.title ?? initialTitle)
  const [body, setBody] = useState(entry?.body ?? initialBody)
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved" | "error">(entry ? "saved" : "unsaved")
  const [error, setError] = useState("")
  const [voiceOpen, setVoiceOpen] = useState(false)
  const idRef = useRef(entry?.id ?? "")
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const mountedRef = useRef(true)
  const lastSavedRef = useRef(entry ? `${entry.title}\u0000${entry.body}` : "")
  const draftKeyRef = useRef(`tellwise:journal-draft:${entry?.id ?? "new"}`)
  const latestTitleRef = useRef(title)
  const latestBodyRef = useRef(body)

  useEffect(() => {
    mountedRef.current = true
    if (!entry && !initialBody && !initialTitle) {
      try {
        const stored = window.localStorage.getItem(draftKeyRef.current)
        if (stored) {
          const parsed = JSON.parse(stored) as { title?: string; body?: string }
          if (parsed.title) setTitle(parsed.title.slice(0, 120))
          if (parsed.body) setBody(parsed.body.slice(0, 20000))
        }
      } catch {}
    }
    return () => {
      mountedRef.current = false
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [entry, initialBody, initialTitle])

  useEffect(() => {
    latestTitleRef.current = title
    latestBodyRef.current = body
    try {
      window.localStorage.setItem(draftKeyRef.current, JSON.stringify({ title, body }))
    } catch {}

    const fingerprint = `${title}\u0000${body}`
    if (!body.trim() || fingerprint === lastSavedRef.current) return

    setStatus("unsaved")
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void saveNow(title, body)
    }, 900)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [title, body])

  async function saveNow(nextTitle = title, nextBody = body) {
    const cleanBody = nextBody.trim()
    const cleanTitle = nextTitle.trim() || titleFromBody(cleanBody)
    if (!cleanBody) return true
    if (cleanTitle.length > 120 || cleanBody.length > 20000) {
      if (mountedRef.current) {
        setStatus("error")
        setError("Keep the title under 120 characters and the note under 20,000 characters.")
      }
      return false
    }

    if (savingRef.current) {
      pendingSaveRef.current = true
      return false
    }

    savingRef.current = true
    if (mountedRef.current) {
      setStatus("saving")
      setError("")
    }

    try {
      const supabase = createClient()
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) throw new Error("Please sign in again before saving.")

      if (idRef.current) {
        const { error: updateError } = await supabase
          .from("journal_entries")
          .update({ title: cleanTitle, body: cleanBody })
          .eq("id", idRef.current)
        if (updateError) throw new Error(updateError.message)
      } else {
        const { data, error: insertError } = await supabase
          .from("journal_entries")
          .insert({ user_id: authData.user.id, title: cleanTitle, body: cleanBody })
          .select("id")
          .single<{ id: string }>()
        if (insertError || !data?.id) throw new Error(insertError?.message || "This note could not be created.")
        idRef.current = data.id
        draftKeyRef.current = `tellwise:journal-draft:${data.id}`
      }

      lastSavedRef.current = `${nextTitle}\u0000${nextBody}`
      try {
        window.localStorage.removeItem("tellwise:journal-draft:new")
        window.localStorage.removeItem(draftKeyRef.current)
      } catch {}
      if (mountedRef.current) setStatus("saved")
      return true
    } catch (caught) {
      if (mountedRef.current) {
        setStatus("error")
        setError(caught instanceof Error ? caught.message : "This note could not be saved.")
      }
      return false
    } finally {
      savingRef.current = false
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false
        window.setTimeout(() => void saveNow(latestTitleRef.current, latestBodyRef.current), 0)
      }
    }
  }

  async function closeEditor() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    while (savingRef.current) await new Promise((resolve) => window.setTimeout(resolve, 40))
    if (latestBodyRef.current.trim()) await saveNow(latestTitleRef.current, latestBodyRef.current)
    while (savingRef.current) await new Promise((resolve) => window.setTimeout(resolve, 40))
    await onClose()
  }

  return (
    <div className="journal-overlay" role="dialog" aria-modal="true" aria-label={entry ? "Edit Journal note" : "New Journal note"}>
      <article className="journal-editor">
        <div className="journal-editor-top">
          <button type="button" onClick={() => void closeEditor()} aria-label="Close note">
            <X />
          </button>
          <span className={`journal-save-status is-${status}`}>
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Not saved" : "Editing"}
          </span>
          <button type="button" onClick={() => void closeEditor()}>Done</button>
        </div>

        <input
          className="journal-title-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          maxLength={120}
          autoFocus={!initialBody}
        />
        <textarea
          className="journal-body-input"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write what you noticed…"
          maxLength={20000}
          autoFocus={Boolean(initialBody)}
        />

        <div className="journal-editor-foot">
          <span>{body.length.toLocaleString()} characters</span>
          <button type="button" onClick={() => setVoiceOpen(true)}>
            <Mic2 /> Add by voice
          </button>
        </div>
        {error && <p className="journal-error mt-3">{error}</p>}
      </article>

      {voiceOpen && (
        <VoiceCapture
          nested
          onClose={() => setVoiceOpen(false)}
          onTranscript={(transcript) => {
            setVoiceOpen(false)
            setBody((current) => `${current}${current.trim() ? "\n\n" : ""}${transcript}`)
          }}
        />
      )}
    </div>
  )
}

function VoiceCapture({
  onClose,
  onTranscript,
  nested = false,
}: {
  onClose: () => void
  onTranscript: (transcript: string) => void
  nested?: boolean
}) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState("")
  const [stage, setStage] = useState<CloudTranscriptionStage | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef(0)
  const pendingCloudRef = useRef<CloudRecordingRef | null>(null)

  useEffect(() => () => stopTracks(), [])

  function stopTracks() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  async function startRecording() {
    if (processing || recording) return
    setError("")
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Voice notes are not available in this browser.")
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      setElapsed(0)
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        stopTracks()
        const seconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
        void transcribe(blob, seconds)
      }
      recorder.start(500)
      setRecording(true)
      timerRef.current = setInterval(() => {
        const next = Math.floor((Date.now() - startedAtRef.current) / 1000)
        setElapsed(next)
        if (next >= JOURNAL_VOICE_MAX_SECONDS) stopRecording()
      }, 250)
    } catch (caught) {
      stopTracks()
      setError(caught instanceof Error ? caught.message : "Microphone access is needed for a voice note.")
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") return
    setRecording(false)
    recorder.stop()
  }

  async function transcribe(blob: Blob, seconds: number) {
    if (!blob.size) {
      setError("No audio was captured. Try again.")
      return
    }
    setProcessing(true)
    setStage("preparing")
    pendingCloudRef.current = null
    try {
      const result = await uploadAndTranscribeRecording({
        blob,
        durationSeconds: seconds,
        onCreated: (cloudRef) => {
          pendingCloudRef.current = cloudRef
        },
        onStage: setStage,
      })
      const transcript = result.transcript.trim()
      if (!transcript) throw new Error("Tellwise could not hear enough to make a note.")
      if (pendingCloudRef.current) {
        await deleteCloudRecording(pendingCloudRef.current)
        pendingCloudRef.current = null
      }
      onTranscript(transcript)
    } catch (caught) {
      if (pendingCloudRef.current) {
        try {
          await deleteCloudRecording(pendingCloudRef.current)
        } catch {}
        pendingCloudRef.current = null
      }
      setError(caught instanceof Error ? caught.message : "That voice note could not be transcribed.")
    } finally {
      setProcessing(false)
      setStage(null)
    }
  }

  return (
    <div className={nested ? "journal-voice-nested" : "journal-overlay"} role="dialog" aria-modal="true" aria-label="Voice note">
      <section className="journal-voice-panel">
        <div className="journal-editor-top">
          <button type="button" onClick={onClose} disabled={processing || recording} aria-label="Close voice note"><X /></button>
          <span>Voice note</span>
          <span />
        </div>

        <div className={recording ? "journal-voice-orb is-recording" : "journal-voice-orb"}>
          <Mic2 />
        </div>
        <h2>{processing ? "Turning your words into a note…" : recording ? "Listening" : "Say it before you lose it"}</h2>
        <p>
          {processing
            ? stageLabel(stage)
            : recording
              ? `Recording · ${duration(elapsed)} of 5:00`
              : "Record a quick thought. Tellwise will transcribe it into this Journal and discard the temporary audio copy."}
        </p>

        {error && <p className="journal-error">{error}</p>}

        <div className="journal-voice-actions">
          {!recording && !processing && (
            <button type="button" className="is-primary" onClick={() => void startRecording()}><Mic2 /> Start recording</button>
          )}
          {recording && (
            <button type="button" className="is-stop" onClick={stopRecording}><Square /> Stop and transcribe</button>
          )}
          {processing && (
            <div className="journal-processing-line"><span />Processing privately</div>
          )}
        </div>
      </section>
    </div>
  )
}

function EntryDetail({
  entry,
  onClose,
  onEdit,
  onDeleted,
}: {
  entry: TextEntry
  onClose: () => void
  onEdit: () => void
  onDeleted: () => void | Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  async function deleteEntry() {
    setDeleting(true)
    setError("")
    try {
      const supabase = createClient()
      const { error: deleteError } = await supabase.from("journal_entries").delete().eq("id", entry.id)
      if (deleteError) throw new Error(deleteError.message)
      await onDeleted()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This note could not be deleted.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="journal-overlay" role="dialog" aria-modal="true" aria-label="Journal note">
      <article className="journal-detail">
        <div className="journal-detail-top">
          <button type="button" onClick={onClose} aria-label="Close note"><ArrowLeft /></button>
          <span>Journal</span>
          <button type="button" onClick={onEdit}>Edit</button>
        </div>
        <p className="journal-entry-date">{journalLongDate(entry.updated_at)}</p>
        <h2>{entry.title}</h2>
        <p className="journal-detail-body whitespace-pre-wrap">{entry.body}</p>
        <div className="journal-detail-actions">
          <button type="button" onClick={onEdit}><PenLine /> Edit note</button>
          <button type="button" className="is-danger" disabled={deleting} onClick={() => void deleteEntry()}>
            <Trash2 /> {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
        {error && <p className="journal-error mt-3">{error}</p>}
      </article>
    </div>
  )
}

function JournalSkeleton() {
  return <div className="journal-row journal-row-skeleton" aria-hidden="true" />
}

function compactPreview(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 150) || "Untitled note"
}

function titleFromBody(value: string) {
  const sentence = value.split(/[.!?\n]/)[0]?.trim() || "Untitled note"
  return sentence.split(/\s+/).slice(0, 7).join(" ").slice(0, 120)
}

function duration(seconds: number) {
  const value = Math.max(0, Math.round(seconds || 0))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`
}

function journalDate(value: string) {
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return "yesterday"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase()
}

function journalLongDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function stageLabel(stage: CloudTranscriptionStage | null) {
  if (stage === "uploading") return "Securing the temporary audio…"
  if (stage === "transcribing") return "Transcribing your thought…"
  if (stage === "saving") return "Finishing the note…"
  return "Preparing your voice note…"
}
