"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Mic2,
  PenLine,
  Search,
  Square,
  SquarePen,
  Trash2,
  Video,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  createJournalMediaEntry,
  createSignedJournalMediaUrl,
  deleteJournalMedia,
  type JournalMediaEntry,
  type JournalMediaKind,
} from "@/lib/journal-media"
import { ConfirmDialog } from "@/components/confirm-dialog"

type JournalEntry = JournalMediaEntry
type JournalEntryType = JournalEntry["entry_type"]

type DraftSeed = {
  title?: string
  body?: string
}

const AUDIO_MAX_SECONDS = 5 * 60
const VIDEO_MAX_SECONDS = 3 * 60

export function JournalClient() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [composerOpen, setComposerOpen] = useState(false)
  const [draftSeed, setDraftSeed] = useState<DraftSeed | null>(null)
  const [detail, setDetail] = useState<JournalEntry | null>(null)
  const [captureKind, setCaptureKind] = useState<JournalMediaKind | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const supabase = createClient()
      const { data, error: loadError } = await supabase
        .from("journal_entries")
        .select("id,user_id,title,body,entry_type,media_storage_path,media_content_type,media_size_bytes,media_duration_seconds,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(400)

      if (loadError) throw new Error(loadError.message)
      setEntries((data ?? []) as JournalEntry[])
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Your Journal could not be loaded."
      if (message.toLowerCase().includes("journal_entries") || message.toLowerCase().includes("entry_type")) {
        setError("Journal needs its latest Supabase migration before notes and media can be saved.")
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
    return entries.filter((entry) => `${entry.title} ${entry.body} ${entry.entry_type}`.toLowerCase().includes(normalized))
  }, [entries, query])

  const groups = useMemo(() => groupEntries(visibleEntries, Boolean(query.trim())), [visibleEntries, query])

  const upsertEntry = useCallback((entry: JournalEntry) => {
    setEntries((current) => {
      const next = current.some((existing) => existing.id === entry.id)
        ? current.map((existing) => existing.id === entry.id ? entry : existing)
        : [entry, ...current]
      return [...next].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    })
    setDetail((current) => current?.id === entry.id ? entry : current)
  }, [])

  function startNewText(seed?: DraftSeed) {
    setDraftSeed(seed ?? null)
    setComposerOpen(true)
  }

  return (
    <div className="journal-page min-h-full">
      <header className="journal-header journal-header-notes">
        <div>
          <p className="journal-running-head">Tellwise</p>
          <h1>Journal</h1>
        </div>
        <span className="journal-count">{entries.length}</span>
      </header>
      <p className="journal-deck journal-deck-notes">Ideas, fragments, voice notes, and video moments. Private by default.</p>

      <label className="journal-search journal-search-top" data-book-no-turn="true">
        <Search aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your Journal"
          aria-label="Search Journal notes"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      {error && <p className="journal-error">{error}</p>}

      <section className="journal-groups" aria-busy={loading}>
        {loading ? (
          <>
            <JournalSkeleton />
            <JournalSkeleton />
            <JournalSkeleton />
          </>
        ) : groups.length ? (
          groups.map((group) => (
            <section key={group.label} className="journal-month-section">
              <div className="journal-month-heading">
                <h2>{group.label}</h2>
                <span>{group.entries.length}</span>
              </div>
              <div className="journal-notes-group">
                {group.entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="journal-row"
                    onClick={() => setDetail(entry)}
                  >
                    <span className="journal-row-main">
                      <strong>{entry.title}</strong>
                      <span className="journal-row-meta">
                        <time>{journalDate(entry.updated_at)}</time>
                        <span>{entryPreview(entry)}</span>
                      </span>
                    </span>
                    {entry.entry_type !== "text" && (
                      <span className={`journal-row-kind is-${entry.entry_type}`}>
                        {entry.entry_type === "audio" ? <Mic2 /> : <Video />}
                        {entry.entry_type}
                      </span>
                    )}
                    <ChevronRight className="journal-row-chevron" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="journal-empty journal-empty-notes">
            <PenLine className="h-5 w-5" strokeWidth={1.5} />
            <h2>{query ? "Nothing found" : "Your first note starts here"}</h2>
            <p>{query ? "Try a different search." : "Write a thought, record your voice, or capture a short video before the idea disappears."}</p>
          </div>
        )}
      </section>

      <div className="journal-bottom-dock journal-action-dock" aria-label="Journal tools">
        <button type="button" className="journal-dock-button" onClick={() => setCaptureKind("audio")} aria-label="Record an audio note">
          <Mic2 />
        </button>
        <button type="button" className="journal-dock-button" onClick={() => setCaptureKind("video")} aria-label="Record a video note">
          <Camera />
        </button>
        <button type="button" className="journal-dock-button is-compose journal-write-button" onClick={() => startNewText()} aria-label="Write a new note">
          <SquarePen />
          <span>Write a note</span>
        </button>
      </div>

      {composerOpen && (
        <TextComposer
          entry={null}
          initialTitle={draftSeed?.title ?? ""}
          initialBody={draftSeed?.body ?? ""}
          onClose={async () => {
            setComposerOpen(false)
            setDraftSeed(null)
            await load()
          }}
        />
      )}

      {captureKind && (
        <MediaCapture
          kind={captureKind}
          onClose={() => setCaptureKind(null)}
          onSaved={async (entry) => {
            setCaptureKind(null)
            upsertEntry(entry)
            setDetail(entry)
          }}
        />
      )}

      {detail && (
        <EntryDetail
          entry={detail}
          onClose={async () => {
            setDetail(null)
            await load()
          }}
          onUpdated={upsertEntry}
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
  entry: JournalEntry | null
  initialTitle: string
  initialBody: string
  onClose: () => void | Promise<void>
}) {
  const [title, setTitle] = useState(entry?.title ?? initialTitle)
  const [body, setBody] = useState(entry?.body ?? initialBody)
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved" | "error">(entry ? "saved" : "unsaved")
  const [error, setError] = useState("")
  const idRef = useRef(entry?.id ?? "")
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const mountedRef = useRef(true)
  const lastSavedRef = useRef(entry ? `${entry.title}\u0000${entry.body}` : "")
  const draftKeyRef = useRef(`tellwise:journal-draft:${entry?.id ?? "new"}`)
  const latestTitleRef = useRef(title)
  const latestBodyRef = useRef(body)
  const mediaEntry = Boolean(entry && entry.entry_type !== "text")

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
    if ((!title.trim() && !body.trim()) || fingerprint === lastSavedRef.current) return

    setStatus("unsaved")
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => void saveNow(title, body), 850)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [title, body])

  async function saveNow(nextTitle = title, nextBody = body) {
    const cleanBody = nextBody.trim()
    const cleanTitle = nextTitle.trim() || titleFromBody(cleanBody) || "Untitled note"
    if (!cleanTitle && !cleanBody) return true
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
          .insert({ user_id: authData.user.id, title: cleanTitle, body: cleanBody, entry_type: "text" })
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
    while (savingRef.current) await new Promise((resolve) => window.setTimeout(resolve, 30))
    if (latestTitleRef.current.trim() || latestBodyRef.current.trim()) await saveNow(latestTitleRef.current, latestBodyRef.current)
    while (savingRef.current) await new Promise((resolve) => window.setTimeout(resolve, 30))
    await onClose()
  }

  return (
    <div className={mediaEntry ? "journal-note-sheet-overlay journal-media-editor-overlay" : "journal-note-sheet-overlay"} role="dialog" aria-modal="true" aria-label={entry ? "Edit Journal note" : "New Journal note"}>
      <article className={mediaEntry ? "journal-editor journal-editor-notes journal-editor-media" : "journal-editor journal-editor-notes"}>
        <div className="journal-editor-top journal-editor-top-notes">
          <button type="button" onClick={() => void closeEditor()} aria-label="Back"><ArrowLeft /></button>
          <span className={`journal-save-status is-${status}`}>
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Not saved" : "Editing"}
          </span>
          <button type="button" onClick={() => void closeEditor()}>Done</button>
        </div>

        <input
          className="journal-title-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a title"
          maxLength={120}
          autoFocus={!initialBody}
        />
        <textarea
          className="journal-body-input"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a description or start writing…"
          maxLength={20000}
          autoFocus={Boolean(initialBody)}
        />
        <div className="journal-editor-foot">
          <span>{body.trim() ? `${body.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words` : "0 words"}</span>
          <span>Autosaves</span>
        </div>
        {error && <p className="journal-error mt-3">{error}</p>}
      </article>
    </div>
  )
}

function MediaCapture({
  kind,
  onClose,
  onSaved,
}: {
  kind: JournalMediaKind
  onClose: () => void
  onSaved: (entry: JournalEntry) => void
}) {
  const [recording, setRecording] = useState(false)
  const [saving, setSaving] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState("")
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef(0)
  const maxSeconds = kind === "video" ? VIDEO_MAX_SECONDS : AUDIO_MAX_SECONDS

  useEffect(() => () => stopTracks(), [])

  function stopTracks() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (previewRef.current) previewRef.current.srcObject = null
  }

  async function startRecording() {
    if (recording || saving) return
    setError("")
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Recording is not available in this browser.")
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === "video" ? { facingMode: "user" } : false,
      })
      streamRef.current = stream
      if (kind === "video" && previewRef.current) {
        previewRef.current.srcObject = stream
        await previewRef.current.play().catch(() => {})
      }

      chunksRef.current = []
      const preferred = preferredMime(kind)
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      setElapsed(0)
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const seconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || (kind === "video" ? "video/webm" : "audio/webm") })
        stopTracks()
        void saveRecording(blob, seconds)
      }
      recorder.start(500)
      setRecording(true)
      timerRef.current = setInterval(() => {
        const next = Math.floor((Date.now() - startedAtRef.current) / 1000)
        setElapsed(next)
        if (next >= maxSeconds) stopRecording()
      }, 250)
    } catch (caught) {
      stopTracks()
      setError(caught instanceof Error ? caught.message : `${kind === "video" ? "Camera" : "Microphone"} access is needed.`)
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") return
    setRecording(false)
    recorder.stop()
  }

  async function saveRecording(blob: Blob, seconds: number) {
    setSaving(true)
    setError("")
    try {
      const created = await createJournalMediaEntry({ kind, blob, durationSeconds: seconds })
      onSaved(created)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `That ${kind} note could not be saved.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="journal-overlay journal-overlay-blue journal-capture-overlay" role="dialog" aria-modal="true" aria-label={`${kind} note`}>
      <section className="journal-capture-panel">
        <div className="journal-editor-top journal-editor-top-notes">
          <button type="button" onClick={onClose} disabled={recording || saving} aria-label="Close"><X /></button>
          <span>{kind === "video" ? "Video note" : "Audio note"}</span>
          <span className="journal-capture-privacy">Private</span>
        </div>

        {kind === "video" ? (
          <div className="journal-video-preview-wrap">
            <video ref={previewRef} muted playsInline className="journal-video-preview" />
            {!recording && !saving && <Camera className="journal-video-placeholder" />}
          </div>
        ) : (
          <div className={recording ? "journal-record-orb is-recording" : "journal-record-orb"}><Mic2 /></div>
        )}

        <h2>{saving ? "Saving privately…" : recording ? "Recording" : kind === "video" ? "Capture a moment" : "Record a thought"}</h2>
        <p>{saving ? "Your media stays private in your Journal." : recording ? `${duration(elapsed)} of ${duration(maxSeconds)}` : "Use this like a pocket notebook. Keep it short, private, and easy to find later."}</p>

        {error && <p className="journal-error">{error}</p>}

        <div className="journal-capture-actions">
          {!recording && !saving && <button type="button" className="is-primary" onClick={() => void startRecording()}>{kind === "video" ? <Camera /> : <Mic2 />} Start</button>}
          {recording && <button type="button" className="is-stop" onClick={stopRecording}><Square /> Stop and save</button>}
          {saving && <div className="journal-processing-line"><span />Saving privately</div>}
        </div>
      </section>
    </div>
  )
}

function EntryDetail({
  entry,
  onClose,
  onUpdated,
  onDeleted,
}: {
  entry: JournalEntry
  onClose: () => void
  onUpdated: (entry: JournalEntry) => void
  onDeleted: () => void | Promise<void>
}) {
  const [title, setTitle] = useState(entry.title)
  const [body, setBody] = useState(entry.body)
  const [editingField, setEditingField] = useState<"title" | "body" | null>(null)
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const [mediaUrl, setMediaUrl] = useState("")
  const [mediaLoading, setMediaLoading] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTitle(entry.title)
    setBody(entry.body)
    setEditingField(null)
    setSaveStatus("saved")
    setError("")
  }, [entry.id, entry.title, entry.body])

  useEffect(() => {
    let cancelled = false
    if (!entry.media_storage_path) {
      setMediaUrl("")
      return
    }
    setMediaLoading(true)
    void createSignedJournalMediaUrl(entry.media_storage_path)
      .then((url) => {
        if (!cancelled) setMediaUrl(url)
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "This private recording could not be opened.")
      })
      .finally(() => {
        if (!cancelled) setMediaLoading(false)
      })
    return () => { cancelled = true }
  }, [entry.media_storage_path])

  useEffect(() => {
    const nextTitle = title.trim()
    const nextBody = body.trim()
    const unchanged = nextTitle === entry.title.trim() && nextBody === entry.body.trim()
    if (unchanged) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus("saving")
    saveTimerRef.current = setTimeout(() => {
      void saveEdits(title, body)
    }, 650)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [title, body, entry])

  async function saveEdits(nextTitle = title, nextBody = body) {
    const cleanTitle = journalStoredTitle(entry.entry_type, nextTitle, nextBody)
    const cleanBody = journalStoredBody(entry.entry_type, nextBody)
    setError("")
    try {
      const supabase = createClient()
      const { data, error: updateError } = await supabase
        .from("journal_entries")
        .update({ title: cleanTitle, body: cleanBody })
        .eq("id", entry.id)
        .select("id,user_id,title,body,entry_type,media_storage_path,media_content_type,media_size_bytes,media_duration_seconds,created_at,updated_at")
        .single<JournalEntry>()
      if (updateError || !data) throw new Error(updateError?.message || "This note could not be saved.")
      onUpdated(data)
      setSaveStatus("saved")
    } catch (caught) {
      setSaveStatus("error")
      setError(caught instanceof Error ? caught.message : "This note could not be saved.")
    }
  }

  async function deleteEntry() {
    setDeleting(true)
    setError("")
    try {
      if (entry.media_storage_path) await deleteJournalMedia(entry.media_storage_path)
      const supabase = createClient()
      const { error: deleteError } = await supabase.from("journal_entries").delete().eq("id", entry.id)
      if (deleteError) throw new Error(deleteError.message)
      setDeleteOpen(false)
      await onDeleted()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This note could not be deleted.")
    } finally {
      setDeleting(false)
    }
  }

  const titlePlaceholder = entry.entry_type === "text" ? "Add a title" : "Add a title"
  const bodyPlaceholder = entry.entry_type === "text" ? "Add a description or start writing…" : "Add a description"
  const showingPlaceholderTitle = isJournalPlaceholderTitle(entry.entry_type, title)
  const showingPlaceholderBody = isJournalPlaceholderBody(entry.entry_type, body)

  return (
    <>
      <div className={entry.entry_type === "text" ? "journal-note-sheet-overlay" : "journal-note-sheet-overlay journal-media-detail-overlay"} role="dialog" aria-modal="true" aria-label="Journal note">
        <article className={entry.entry_type === "text" ? "journal-detail journal-detail-notes journal-detail-reading" : "journal-detail journal-detail-notes journal-detail-media journal-detail-reading"}>
          <div className="journal-detail-top journal-editor-top-notes">
            <button type="button" onClick={onClose} aria-label="Back"><ArrowLeft /></button>
            <span className={`journal-save-status is-${saveStatus}`}>{saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Not saved" : "Saved"}</span>
            <button type="button" className="journal-delete-icon" onClick={() => setDeleteOpen(true)} aria-label="Delete note"><Trash2 /></button>
          </div>
          <p className="journal-entry-date">{journalLongDate(entry.updated_at)}</p>

          {editingField === "title" ? (
            <input
              className="journal-title-input journal-inline-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => setEditingField(null)}
              placeholder={titlePlaceholder}
              maxLength={120}
              autoFocus
            />
          ) : (
            <button type="button" className={`journal-inline-title ${showingPlaceholderTitle ? "is-placeholder" : ""}`} onClick={() => setEditingField("title")}>
              {showingPlaceholderTitle ? titlePlaceholder : title}
            </button>
          )}

          {entry.entry_type === "audio" && (
            <div className="journal-media-player is-audio">
              {mediaLoading ? <span>Opening private audio…</span> : mediaUrl ? <audio controls preload="metadata" src={mediaUrl} /> : <span>Audio unavailable.</span>}
            </div>
          )}
          {entry.entry_type === "video" && (
            <div className="journal-media-player is-video">
              {mediaLoading ? <span>Opening private video…</span> : mediaUrl ? <video controls playsInline preload="metadata" src={mediaUrl} /> : <span>Video unavailable.</span>}
            </div>
          )}

          {editingField === "body" ? (
            <textarea
              className="journal-body-input journal-inline-textarea"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onBlur={() => setEditingField(null)}
              placeholder={bodyPlaceholder}
              maxLength={20000}
              autoFocus
            />
          ) : (
            <button type="button" className={`journal-inline-body ${showingPlaceholderBody ? "is-placeholder" : ""}`} onClick={() => setEditingField("body")}>
              {showingPlaceholderBody ? bodyPlaceholder : body}
            </button>
          )}

          <p className="journal-inline-hint">Tap the title or description to edit. Changes save automatically.</p>
          {error && <p className="journal-error mt-3">{error}</p>}
        </article>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this Journal note?"
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        tone="danger"
        busy={deleting}
        onCancel={() => { if (!deleting) setDeleteOpen(false) }}
        onConfirm={() => void deleteEntry()}
      >
        This permanently removes the note{entry.entry_type !== "text" ? " and its private recording" : ""}.
      </ConfirmDialog>
    </>
  )
}

function JournalSkeleton() {
  return <div className="journal-notes-group journal-skeleton-group" aria-hidden="true"><div className="journal-row" /><div className="journal-row" /></div>
}

function groupEntries(entries: JournalEntry[], searching: boolean) {
  if (searching) return entries.length ? [{ label: "Search results", entries }] : []

  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(now.getDate() - 30)
  const groups: { label: string; entries: JournalEntry[] }[] = []
  const recent: JournalEntry[] = []
  const older = new Map<string, JournalEntry[]>()

  for (const entry of entries) {
    const date = new Date(entry.updated_at)
    if (date >= cutoff) {
      recent.push(entry)
      continue
    }
    const label = date.getFullYear() === now.getFullYear()
      ? date.toLocaleDateString("en-US", { month: "long" })
      : date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    older.set(label, [...(older.get(label) ?? []), entry])
  }

  if (recent.length) groups.push({ label: "Previous 30 Days", entries: recent })
  for (const [label, group] of older) groups.push({ label, entries: group })
  return groups
}

function entryPreview(entry: JournalEntry) {
  if (entry.entry_type === "audio") return `${duration(entry.media_duration_seconds ?? 0)}  ${cleanPreview(entry.body, "Audio note")}`
  if (entry.entry_type === "video") return `${duration(entry.media_duration_seconds ?? 0)}  ${cleanPreview(entry.body, "Video note")}`
  return cleanPreview(entry.body, entry.title || "Untitled note")
}

function cleanPreview(value: string, fallback: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 110) || fallback
}

function isJournalPlaceholderTitle(kind: JournalEntryType, value: string) {
  const normalized = value.trim().toLowerCase()
  return !normalized || normalized === "add a title"
}

function isJournalPlaceholderBody(kind: JournalEntryType, value: string) {
  const normalized = value.trim().toLowerCase()
  if (kind === "text") return !normalized
  return !normalized || normalized === "add a description" || normalized === "private audio note" || normalized === "private video note"
}

function journalStoredTitle(kind: JournalEntryType, title: string, body: string) {
  const cleanTitle = title.trim()
  if (kind === "text") return cleanTitle || titleFromBody(body.trim()) || "Untitled note"
  return cleanTitle || "Add a title"
}

function journalStoredBody(kind: JournalEntryType, body: string) {
  const cleanBody = body.trim()
  if (kind === "text") return cleanBody
  return cleanBody || "Add a description"
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
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return "yesterday"
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" })
}

function journalLongDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
}

function preferredMime(kind: JournalMediaKind) {
  const candidates = kind === "video"
    ? ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
  return candidates.find((candidate) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(candidate)) || ""
}
