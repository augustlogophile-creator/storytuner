"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import {
  ArrowLeft,
  Bold,
  Camera,
  CameraOff,
  ChevronRight,
  Italic,
  List,
  Mic2,
  Pause,
  PenLine,
  Play,
  Plus,
  RotateCcw,
  Search,
  Square,
  Trash2,
  Underline,
  Video,
  Volume2,
  VolumeX,
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
import { SaveButton } from "@/components/ui/save-button"

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
  const [entryMenuOpen, setEntryMenuOpen] = useState(false)
  const [entryMenuSelection, setEntryMenuSelection] = useState<JournalEntryType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

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

  useEffect(() => {
    const fullscreenOpen = composerOpen || Boolean(detail) || Boolean(captureKind)
    const anyOverlayOpen = fullscreenOpen || entryMenuOpen || Boolean(deleteTarget)
    if (!anyOverlayOpen) return

    const bodyOverflow = document.body.style.overflow
    const rootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"
    document.body.classList.toggle("journal-fullscreen-open", fullscreenOpen)
    document.body.classList.toggle("journal-menu-open", entryMenuOpen)

    return () => {
      document.body.style.overflow = bodyOverflow
      document.documentElement.style.overflow = rootOverflow
      document.body.classList.remove("journal-fullscreen-open", "journal-menu-open")
    }
  }, [composerOpen, detail, captureKind, entryMenuOpen, deleteTarget])

  const visibleEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return entries
    return entries.filter((entry) => `${entry.title} ${plainJournalText(entry.body)} ${entry.entry_type}`.toLowerCase().includes(normalized))
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

  function openEntryChoice(kind: JournalEntryType) {
    if (entryMenuSelection) return
    setEntryMenuSelection(kind)
    window.setTimeout(() => {
      setEntryMenuOpen(false)
      setEntryMenuSelection(null)
      if (kind === "text") startNewText()
      else if (kind === "audio") setCaptureKind("audio")
      else setCaptureKind("video")
    }, 140)
  }

  async function deleteSavedEntry() {
    if (!deleteTarget || deleteBusy) return
    setDeleteBusy(true)
    setError("")
    try {
      if (deleteTarget.media_storage_path) await deleteJournalMedia(deleteTarget.media_storage_path)
      const supabase = createClient()
      const { error: deleteError } = await supabase.from("journal_entries").delete().eq("id", deleteTarget.id)
      if (deleteError) throw new Error(deleteError.message)
      setEntries((current) => current.filter((entry) => entry.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This note could not be deleted.")
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="journal-page min-h-full">
      <header className="journal-header journal-header-notes">
        <div>
          <p className="journal-running-head">Tellwise</p>
          <h1>Journal</h1>
          <p className="journal-deck journal-deck-notes">Capture ideas before they’re ready to tell.</p>
        </div>
        <button type="button" className="journal-new-entry-button journal-new-entry-top" onClick={() => setEntryMenuOpen(true)}>
          <Plus /> <span>New entry</span>
        </button>
      </header>

      <label className="journal-search journal-search-top" data-book-no-turn="true">
        <Search aria-hidden="true" />
        <input
          className="journal-search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search entries"
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
                  <JournalSwipeRow
                    key={entry.id}
                    entry={entry}
                    onOpen={() => setDetail(entry)}
                    onDelete={() => setDeleteTarget(entry)}
                  />
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

      {entryMenuOpen && (
        <div className="journal-entry-menu-overlay" role="dialog" aria-modal="true" aria-label="Create Journal entry">
          <section className="journal-entry-menu">
            <div className="journal-entry-menu-top">
              <h2>New entry</h2>
              <button type="button" onClick={() => { setEntryMenuOpen(false); setEntryMenuSelection(null) }} aria-label="Close"><X /></button>
            </div>
            <p className="journal-entry-menu-note">Choose a format.</p>
            <div className="journal-entry-menu-options">
              <button type="button" className={entryMenuSelection === "text" ? "is-selected" : ""} onClick={() => openEntryChoice("text")}>
                <span className="journal-entry-menu-option-icon"><PenLine /></span>
                <span><strong>Write</strong><small>Start a text note</small></span>
                <ChevronRight className="journal-entry-menu-option-arrow" />
              </button>
              <button type="button" className={entryMenuSelection === "audio" ? "is-selected" : ""} onClick={() => openEntryChoice("audio")}>
                <span className="journal-entry-menu-option-icon"><Mic2 /></span>
                <span><strong>Audio</strong><small>Capture a voice note</small></span>
                <ChevronRight className="journal-entry-menu-option-arrow" />
              </button>
              <button type="button" className={entryMenuSelection === "video" ? "is-selected" : ""} onClick={() => openEntryChoice("video")}>
                <span className="journal-entry-menu-option-icon"><Camera /></span>
                <span><strong>Video</strong><small>Record a quick video</small></span>
                <ChevronRight className="journal-entry-menu-option-arrow" />
              </button>
            </div>
          </section>
        </div>
      )}

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
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this Journal entry?"
        confirmLabel={deleteBusy ? "Deleting…" : "Delete"}
        tone="danger"
        busy={deleteBusy}
        onCancel={() => { if (!deleteBusy) setDeleteTarget(null) }}
        onConfirm={() => void deleteSavedEntry()}
      >
        This permanently removes the entry{deleteTarget?.entry_type !== "text" ? " and its recording" : ""}.
      </ConfirmDialog>
    </div>
  )
}

function JournalSwipeRow({ entry, onOpen, onDelete }: { entry: JournalEntry; onOpen: () => void; onDelete: () => void }) {
  const [offset, setOffset] = useState(0)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const draggedRef = useRef(false)

  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    startRef.current = { x: event.clientX, y: event.clientY }
    draggedRef.current = false
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = startRef.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) return
    if (dx > 8) {
      draggedRef.current = true
      setOffset(Math.min(76, Math.max(0, dx)))
    } else if (dx < -8 && offset > 0) {
      draggedRef.current = true
      setOffset(Math.max(0, 76 + dx))
    }
  }

  function pointerEnd() {
    if (!startRef.current) return
    setOffset((value) => value >= 38 ? 72 : 0)
    startRef.current = null
  }

  return (
    <div className={`journal-swipe-row ${offset > 0 ? "is-revealed" : ""}`}>
      <button type="button" className="journal-swipe-delete" onClick={onDelete} aria-label={`Delete ${entryDisplayTitle(entry)}`}>
        <Trash2 />
        <span>Delete</span>
      </button>
      <button
        type="button"
        className="journal-row"
        data-no-global-tap="true"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerEnd}
        onPointerCancel={pointerEnd}
        onClick={() => {
          if (draggedRef.current) { draggedRef.current = false; return }
          if (offset > 0) { setOffset(0); return }
          onOpen()
        }}
      >
        <span className={`journal-row-icon is-${entry.entry_type}`} aria-hidden="true">
          {entry.entry_type === "audio" ? <Mic2 /> : entry.entry_type === "video" ? <Video /> : <PenLine />}
        </span>
        <span className="journal-row-main">
          <span className="journal-row-heading">
            <strong>{entryDisplayTitle(entry)}</strong>
            <time>{journalDate(entry.updated_at)}</time>
          </span>
          <span className={`journal-row-preview ${entryHasDescription(entry) ? "" : "is-empty"}`}>{entryPreview(entry)}</span>
          <span className={`journal-row-type is-${entry.entry_type}`}>{entryTypeLine(entry)}</span>
        </span>
        <ChevronRight className="journal-row-chevron" aria-hidden="true" />
      </button>
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
    const richBody = sanitizeJournalRichText(nextBody)
    const cleanBody = plainJournalText(richBody).trim() ? richBody : "No description"
    const cleanTitle = nextTitle.trim() || "Untitled"
    if (!cleanTitle && !cleanBody) return true
    if (cleanTitle.length > 120 || plainJournalText(cleanBody).length > 20000) {
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

  async function saveTextNote() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    while (savingRef.current) await new Promise((resolve) => window.setTimeout(resolve, 24))
    const ok = await saveNow(latestTitleRef.current, latestBodyRef.current)
    if (!ok) throw new Error("This note could not be saved.")
  }

  return (
    <div className={mediaEntry ? "journal-note-sheet-overlay journal-media-editor-overlay" : "journal-note-sheet-overlay"} role="dialog" aria-modal="true" aria-label={entry ? "Edit Journal note" : "New Journal note"}>
      <article className={mediaEntry ? "journal-editor journal-editor-notes journal-editor-media" : "journal-editor journal-editor-notes"}>
        <div className="journal-editor-top journal-editor-top-notes">
          <button type="button" onClick={() => void closeEditor()} aria-label="Back to Journal"><ArrowLeft /></button>
          <span className={`journal-save-status is-${status}`}>
            {status === "saved" ? "Saved" : status === "error" ? "Not saved" : "Editing"}
          </span>
          <SaveButton className="journal-text-save-button" onSave={saveTextNote} onSaved={onClose} />
        </div>

        <p className="journal-editor-date">{journalLongDate(new Date().toISOString())}</p>
        <input
          className="journal-title-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a title"
          maxLength={120}
          autoFocus={!initialBody}
        />
        <JournalRichEditor
          value={body}
          onChange={setBody}
          placeholder="Add a description"
          autoFocus={Boolean(initialBody)}
          className="journal-body-rich"
        />
        <div className="journal-editor-foot">
          <span>{journalWordCount(body).toLocaleString()} words</span>
          <span>Autosaves</span>
        </div>
        {error && <p className="journal-error mt-3">{error}</p>}
      </article>
    </div>
  )
}

function JournalRichEditor({
  value,
  onChange,
  placeholder,
  autoFocus = false,
  className = "",
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoFocus?: boolean
  className?: string
}) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false, list: false })
  const [toolbarReady, setToolbarReady] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setToolbarReady(true), 120)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || document.activeElement === editor) return
    const next = journalDisplayHtml(value)
    if (editor.innerHTML !== next) editor.innerHTML = next
  }, [value])

  useEffect(() => {
    if (!autoFocus) return
    const timer = window.setTimeout(() => editorRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [autoFocus])

  useEffect(() => {
    function refreshFromSelection() {
      const editor = editorRef.current
      const selection = window.getSelection()
      if (!editor || !selection?.rangeCount) return
      const anchor = selection.anchorNode
      if (!anchor || !editor.contains(anchor)) return
      refreshFormattingState()
    }
    document.addEventListener("selectionchange", refreshFromSelection)
    return () => document.removeEventListener("selectionchange", refreshFromSelection)
  }, [])

  function refreshFormattingState() {
    try {
      setActiveFormats({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        list: document.queryCommandState("insertUnorderedList"),
      })
    } catch {
      setActiveFormats({ bold: false, italic: false, underline: false, list: false })
    }
  }

  function sync() {
    const editor = editorRef.current
    if (!editor) return
    let next = sanitizeJournalRichText(editor.innerHTML)
    if (plainJournalText(next).length > 20000) {
      const trimmed = plainJournalText(next).slice(0, 20000)
      next = escapeJournalHtml(trimmed).replace(/\n/g, "<br>")
      editor.innerHTML = next
    }
    onChange(next)
    refreshFormattingState()
  }

  function format(command: "bold" | "italic" | "underline" | "insertUnorderedList") {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand(command, false)
    sync()
    window.requestAnimationFrame(refreshFormattingState)
  }

  return (
    <div className={`journal-rich-editor ${className}`}>
      <div
        ref={editorRef}
        className="journal-rich-editor-area"
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={sync}
        onFocus={refreshFormattingState}
        onKeyUp={refreshFormattingState}
        onPointerUp={refreshFormattingState}
      />
      <div className={`journal-format-toolbar ${toolbarReady ? "is-ready" : ""}`} aria-label="Text formatting">
        <button type="button" className={activeFormats.bold ? "is-active" : ""} aria-label="Bold" aria-pressed={activeFormats.bold} onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")}><Bold /></button>
        <button type="button" className={activeFormats.italic ? "is-active" : ""} aria-label="Italic" aria-pressed={activeFormats.italic} onMouseDown={(event) => event.preventDefault()} onClick={() => format("italic")}><Italic /></button>
        <button type="button" className={activeFormats.underline ? "is-active" : ""} aria-label="Underline" aria-pressed={activeFormats.underline} onMouseDown={(event) => event.preventDefault()} onClick={() => format("underline")}><Underline /></button>
        <button type="button" className={activeFormats.list ? "is-active" : ""} aria-label="Bulleted list" aria-pressed={activeFormats.list} onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertUnorderedList")}><List /></button>
      </div>
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
  const [paused, setPaused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState("")
  const [draftBlob, setDraftBlob] = useState<Blob | null>(null)
  const [draftSeconds, setDraftSeconds] = useState(0)
  const [draftUrl, setDraftUrl] = useState("")
  const draftUrlRef = useRef("")
  const [title, setTitle] = useState("")
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [previewMuted, setPreviewMuted] = useState(true)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef(0)
  const pausedAtRef = useRef(0)
  const pausedMsRef = useRef(0)
  const savedEntryRef = useRef<JournalEntry | null>(null)
  const maxSeconds = kind === "video" ? VIDEO_MAX_SECONDS : AUDIO_MAX_SECONDS

  useEffect(() => () => {
    stopTracks()
    if (draftUrlRef.current) URL.revokeObjectURL(draftUrlRef.current)
  }, [])

  function currentElapsedSeconds() {
    if (!startedAtRef.current) return 0
    const anchor = pausedAtRef.current || Date.now()
    return Math.max(0, Math.floor((anchor - startedAtRef.current - pausedMsRef.current) / 1000))
  }

  function syncElapsed() {
    const next = currentElapsedSeconds()
    setElapsed(next)
    if (recording && !paused && next >= maxSeconds) stopRecording()
  }

  function stopTracks() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (previewRef.current) previewRef.current.srcObject = null
  }

  function clearDraftMedia() {
    if (draftUrlRef.current) URL.revokeObjectURL(draftUrlRef.current)
    draftUrlRef.current = ""
    setDraftUrl("")
    setDraftBlob(null)
    setDraftSeconds(0)
  }

  async function startRecording() {
    if (recording || saving) return
    setError("")
    clearDraftMedia()
    setPaused(false)
    pausedAtRef.current = 0
    pausedMsRef.current = 0
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Recording is not available in this browser.")
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === "video" ? { facingMode: "user" } : false,
      })
      streamRef.current = stream
      setCameraEnabled(true)
      setPreviewMuted(true)
      if (kind === "video" && previewRef.current) {
        previewRef.current.srcObject = stream
        previewRef.current.muted = true
        await previewRef.current.play().catch(() => {})
        // Give the mobile camera a brief moment to expose before the saved clip begins.
        await new Promise((resolve) => window.setTimeout(resolve, 140))
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
        const seconds = Math.max(1, currentElapsedSeconds())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || (kind === "video" ? "video/webm" : "audio/webm") })
        stopTracks()
        const nextDraftUrl = URL.createObjectURL(blob)
        draftUrlRef.current = nextDraftUrl
        setDraftBlob(blob)
        setDraftSeconds(seconds)
        setElapsed(seconds)
        setDraftUrl(nextDraftUrl)
        setPaused(false)
      }
      recorder.start(500)
      setRecording(true)
      timerRef.current = setInterval(syncElapsed, 250)
    } catch (caught) {
      stopTracks()
      setPaused(false)
      setError(caught instanceof Error ? caught.message : `${kind === "video" ? "Camera" : "Microphone"} access is needed.`)
    }
  }

  function togglePause() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") return
    if (!paused) {
      recorder.pause()
      pausedAtRef.current = Date.now()
      setPaused(true)
      syncElapsed()
      return
    }
    if (pausedAtRef.current) pausedMsRef.current += Date.now() - pausedAtRef.current
    pausedAtRef.current = 0
    recorder.resume()
    setPaused(false)
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") return
    if (pausedAtRef.current) pausedMsRef.current += Date.now() - pausedAtRef.current
    pausedAtRef.current = 0
    syncElapsed()
    setRecording(false)
    setPaused(false)
    recorder.stop()
  }

  function toggleCamera() {
    if (kind !== "video") return
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (!track) return
    const next = !track.enabled
    track.enabled = next
    setCameraEnabled(next)
  }

  function togglePreviewMute() {
    if (kind !== "video" || !previewRef.current) return
    const next = !previewMuted
    previewRef.current.muted = next
    setPreviewMuted(next)
  }

  async function saveRecording() {
    if (!draftBlob || saving || recording) return
    setSaving(true)
    setError("")
    try {
      const created = await createJournalMediaEntry({
        kind,
        blob: draftBlob,
        durationSeconds: draftSeconds,
        title,
      })
      savedEntryRef.current = created
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `That ${kind} note could not be saved.`)
      throw caught
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="journal-capture-overlay" role="dialog" aria-modal="true" aria-label={`${kind} note`}>
      <section className={`journal-capture-panel ${kind === "video" ? "is-video" : "is-audio"}`}>
        <div className="journal-capture-top">
          <button type="button" className="journal-top-circle-button" onClick={onClose} disabled={recording || saving} aria-label="Back to Journal"><ArrowLeft /></button>
          <span className={recording ? "is-recording" : ""}>{kind === "video" ? "Video note" : "Audio note"}</span>
          <SaveButton
            className="journal-capture-save-button"
            disabled={!draftBlob || recording || saving}
            onSave={saveRecording}
            onSaved={() => {
              const stored = savedEntryRef.current
              if (!stored) return
              savedEntryRef.current = null
              onSaved(stored)
            }}
          />
        </div>

        <div className="journal-media-metadata journal-media-title-only">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            disabled={recording || saving}
            placeholder="Add a title"
            aria-label="Recording title"
          />
        </div>

        {kind === "video" ? (
          <div className="journal-video-stage">
            {draftUrl ? (
              <JournalVideoReviewPlayer src={draftUrl} durationSeconds={draftSeconds} />
            ) : (
              <>
                <div className="journal-video-live-stage">
                  <video ref={previewRef} muted playsInline className="journal-video-preview" />
                  {!recording && <div className="journal-video-idle" aria-hidden="true"><Camera /></div>}
                  {recording && (
                    <>
                      <div className="journal-video-live-overlay" />
                      <div className="journal-video-live-top">
                        <strong>{duration(elapsed)}</strong>
                        <span>Recording</span>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="journal-audio-stage">
            <strong>{duration(elapsed)}</strong>
            {draftUrl ? (
              <JournalAudioPlayer src={draftUrl} durationSeconds={draftSeconds} />
            ) : (
              <div className={recording ? "journal-waveform is-active" : "journal-waveform"} aria-hidden="true">
                {[18,32,46,28,55,38,49,24,42,58,31,45,26,52,35,48,22,41,56,29].map((height, index) => <i key={index} style={{ height: `${height}px` }} />)}
              </div>
            )}
            <p>{recording ? "Keep going. Stop when the thought is complete." : draftUrl ? "Review the note, then save it when you are ready." : "Record a thought, line, or memory."}</p>
          </div>
        )}

        {error && <p className="journal-error">{error}</p>}

        <div className="journal-capture-actions">
          {!recording && !draftBlob && !saving && <button type="button" className="is-primary" onClick={() => void startRecording()}>{kind === "video" ? <Camera /> : <Mic2 />} Start recording</button>}
          {recording && <button type="button" className="is-stop" onClick={stopRecording}><Square /> Stop recording</button>}
          {draftBlob && !recording && !saving && <button type="button" className="is-secondary" onClick={() => void startRecording()}><RotateCcw /> Retake</button>}
        </div>
      </section>
    </div>
  )
}

function JournalAudioPlayer({ src, durationSeconds }: { src: string; durationSeconds: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [durationValue, setDurationValue] = useState(durationSeconds || 0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    try { audio.currentTime = 0 } catch {}
    setPlaying(false)
    setMuted(false)
    setCurrentTime(0)
    setDurationValue(durationSeconds || 0)

    const syncDuration = () => setDurationValue(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : durationSeconds || 0)
    const syncTime = () => setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0)
    const syncPlay = () => setPlaying(!audio.paused && !audio.ended)

    audio.addEventListener("loadedmetadata", syncDuration)
    audio.addEventListener("durationchange", syncDuration)
    audio.addEventListener("timeupdate", syncTime)
    audio.addEventListener("play", syncPlay)
    audio.addEventListener("pause", syncPlay)
    audio.addEventListener("ended", syncPlay)
    syncDuration()
    syncTime()
    syncPlay()

    return () => {
      audio.removeEventListener("loadedmetadata", syncDuration)
      audio.removeEventListener("durationchange", syncDuration)
      audio.removeEventListener("timeupdate", syncTime)
      audio.removeEventListener("play", syncPlay)
      audio.removeEventListener("pause", syncPlay)
      audio.removeEventListener("ended", syncPlay)
    }
  }, [durationSeconds, src])

  async function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) {
      audio.pause()
      return
    }
    try {
      if (durationValue > 0 && currentTime >= durationValue - 0.08) audio.currentTime = 0
      await audio.play()
    } catch {
      setPlaying(false)
    }
  }

  function seek(value: number) {
    const audio = audioRef.current
    const safeDuration = durationValue > 0 ? durationValue : 1
    if (!audio) return
    const next = Math.max(0, Math.min(safeDuration, value))
    audio.currentTime = next
    setCurrentTime(next)
  }

  function toggleMute() {
    const audio = audioRef.current
    if (!audio) return
    const next = !audio.muted
    audio.muted = next
    setMuted(next)
  }

  const safeDuration = durationValue > 0 ? durationValue : 1
  const progress = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100))

  return (
    <div className="journal-inline-audio-player">
      <audio ref={audioRef} preload="metadata" src={src} />
      <button type="button" className="journal-inline-audio-button" onClick={() => void togglePlay()} aria-label={playing ? "Pause audio note" : "Play audio note"}>
        {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
      </button>
      <span className="journal-inline-audio-time">{duration(currentTime)} / {duration(durationValue)}</span>
      <div className="journal-inline-audio-track">
        <div className="journal-inline-audio-rail" />
        <div className="journal-inline-audio-progress" style={{ width: `${progress}%` }} />
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.01}
          value={Math.min(currentTime, safeDuration)}
          onChange={(event) => seek(Number(event.target.value))}
          className="journal-inline-audio-range"
          aria-label="Audio note playback position"
        />
      </div>
      <button type="button" className="journal-inline-audio-mute" onClick={toggleMute} aria-label={muted ? "Unmute audio note" : "Mute audio note"}>
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
  )
}

function JournalVideoReviewPlayer({ src, durationSeconds }: { src: string; durationSeconds: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [durationValue, setDurationValue] = useState(durationSeconds || 0)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    try { video.currentTime = 0 } catch {}
    setPlaying(false)
    setMuted(video.muted)
    setCurrentTime(0)
    setDurationValue(durationSeconds || 0)

    const syncDuration = () => {
      const resolvedDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationSeconds || 0
      setDurationValue(resolvedDuration)
      if (video.currentTime < 0.05 && resolvedDuration > 0.18) {
        const previewTime = Math.min(0.45, Math.max(0.12, resolvedDuration * 0.18))
        try { video.currentTime = previewTime } catch {}
      }
    }
    const syncTime = () => setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0)
    const syncPlay = () => setPlaying(!video.paused && !video.ended)
    const syncMute = () => setMuted(video.muted)

    video.addEventListener("loadedmetadata", syncDuration)
    video.addEventListener("durationchange", syncDuration)
    video.addEventListener("timeupdate", syncTime)
    video.addEventListener("play", syncPlay)
    video.addEventListener("pause", syncPlay)
    video.addEventListener("ended", syncPlay)
    video.addEventListener("volumechange", syncMute)
    syncDuration()
    syncTime()
    syncPlay()
    syncMute()

    return () => {
      video.removeEventListener("loadedmetadata", syncDuration)
      video.removeEventListener("durationchange", syncDuration)
      video.removeEventListener("timeupdate", syncTime)
      video.removeEventListener("play", syncPlay)
      video.removeEventListener("pause", syncPlay)
      video.removeEventListener("ended", syncPlay)
      video.removeEventListener("volumechange", syncMute)
    }
  }, [durationSeconds, src])

  async function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (!video.paused) {
      video.pause()
      return
    }
    try {
      if (durationValue > 0 && currentTime >= durationValue - 0.08) video.currentTime = 0
      await video.play()
    } catch {
      setPlaying(false)
    }
  }

  function seek(value: number) {
    const video = videoRef.current
    const safeDuration = durationValue > 0 ? durationValue : 1
    if (!video) return
    const next = Math.max(0, Math.min(safeDuration, value))
    video.currentTime = next
    setCurrentTime(next)
  }

  function toggleMute() {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  const safeDuration = durationValue > 0 ? durationValue : 1
  const progress = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100))

  return (
    <div className="journal-video-review-player">
      <video ref={videoRef} playsInline preload="metadata" src={src} className="journal-video-preview" />
      <div className="journal-video-review-overlay" />
      <div className="journal-video-review-controls">
        <div className="journal-video-review-track">
          <div className="journal-video-review-rail" />
          <div className="journal-video-review-progress" style={{ width: `${progress}%` }} />
          <input
            type="range"
            min={0}
            max={safeDuration}
            step={0.01}
            value={Math.min(currentTime, safeDuration)}
            onChange={(event) => seek(Number(event.target.value))}
            className="journal-video-review-range"
            aria-label="Video note playback position"
          />
        </div>
        <div className="journal-video-review-bottom">
          <button type="button" className="journal-video-review-icon" onClick={() => void togglePlay()} aria-label={playing ? "Pause video note" : "Play video note"}>{playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}</button>
          <span className="journal-video-review-time">{duration(currentTime)} / {duration(durationValue)}</span>
          <button type="button" className="journal-video-review-icon" onClick={toggleMute} aria-label={muted ? "Unmute video note" : "Mute video note"}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
        </div>
      </div>
    </div>
  )
}

function EntryDetail({
  entry,
  onClose,
  onUpdated,
}: {
  entry: JournalEntry
  onClose: () => void
  onUpdated: (entry: JournalEntry) => void
}) {
  const [title, setTitle] = useState(entry.title)
  const [body, setBody] = useState(entry.body)
  const [editingField, setEditingField] = useState<"title" | "body" | null>(null)
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved")
  const [error, setError] = useState("")
  const [mediaUrl, setMediaUrl] = useState("")
  const [mediaLoading, setMediaLoading] = useState(false)
  const savedEditRef = useRef<JournalEntry | null>(null)

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

  const dirty = title.trim() !== entry.title.trim() || body.trim() !== entry.body.trim()

  useEffect(() => {
    setSaveStatus(dirty ? "saving" : "saved")
  }, [dirty])

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
      savedEditRef.current = data
      setSaveStatus("saved")
      return data
    } catch (caught) {
      setSaveStatus("error")
      setError(caught instanceof Error ? caught.message : "This note could not be saved.")
      throw caught
    }
  }

  const titlePlaceholder = "Add a title"
  const bodyPlaceholder = "Add a description"
  const showingPlaceholderTitle = isJournalPlaceholderTitle(entry.entry_type, title)
  const showingPlaceholderBody = isJournalPlaceholderBody(entry.entry_type, body)

  return (
    <>
      <div className={entry.entry_type === "text" ? "journal-note-sheet-overlay" : "journal-note-sheet-overlay journal-media-detail-overlay"} role="dialog" aria-modal="true" aria-label="Journal note">
        <article className={entry.entry_type === "text" ? "journal-detail journal-detail-notes journal-detail-reading" : "journal-detail journal-detail-notes journal-detail-media journal-detail-reading"}>
          <div className="journal-detail-top journal-editor-top-notes">
            <button type="button" className="journal-top-circle-button" onClick={onClose} aria-label="Back"><ArrowLeft /></button>
            <span className={`journal-save-status is-${saveStatus}`}>{saveStatus === "error" ? "Not saved" : saveStatus === "saved" ? "Saved" : "Editing"}</span>
            <SaveButton
              className="journal-detail-save-button"
              disabled={!dirty}
              onSave={async () => { await saveEdits(title, body) }}
              onSaved={() => {
                const saved = savedEditRef.current
                if (saved) onUpdated(saved)
                savedEditRef.current = null
                setEditingField(null)
              }}
            />
          </div>
          <p className="journal-entry-date">{journalLongDate(entry.updated_at)}</p>

          {editingField === "title" ? (
            <input
              className="journal-title-input journal-inline-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={titlePlaceholder}
              maxLength={120}
              autoFocus
            />
          ) : (
            <button type="button" className={`journal-inline-title ${showingPlaceholderTitle ? "is-placeholder" : ""}`} onClick={() => { if (showingPlaceholderTitle) setTitle(""); setEditingField("title") }}>
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

          {entry.entry_type === "text" && (editingField === "body" ? (
            <div className="journal-inline-editor-wrap">
              <JournalRichEditor
                value={body}
                onChange={setBody}
                placeholder={bodyPlaceholder}
                autoFocus
                className="journal-inline-rich"
              />
            </div>
          ) : !showingPlaceholderBody ? (
            <div
              role="button"
              tabIndex={0}
              className="journal-inline-body journal-rich-display"
              onClick={() => setEditingField("body")}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setEditingField("body") }}
              dangerouslySetInnerHTML={{ __html: journalDisplayHtml(body) }}
            />
          ) : (
            <button type="button" className="journal-inline-body is-placeholder" onClick={() => { setBody(""); setEditingField("body") }}>
              {bodyPlaceholder}
            </button>
          ))}

          {error && <p className="journal-error mt-3">{error}</p>}
        </article>
      </div>

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

function entryDisplayTitle(entry: JournalEntry) {
  return isJournalPlaceholderTitle(entry.entry_type, entry.title) ? "Untitled" : entry.title.trim()
}

function entryHasDescription(entry: JournalEntry) {
  return !isJournalPlaceholderBody(entry.entry_type, entry.body)
}

function entryPreview(entry: JournalEntry) {
  return entryHasDescription(entry) ? cleanPreview(entry.body, "No description") : "No description"
}

function entryTypeLine(entry: JournalEntry) {
  if (entry.entry_type === "audio") return `Audio · ${duration(entry.media_duration_seconds ?? 0)}`
  if (entry.entry_type === "video") return `Video · ${duration(entry.media_duration_seconds ?? 0)}`
  return "Text"
}

function cleanPreview(value: string, fallback: string) {
  return plainJournalText(value).replace(/\s+/g, " ").trim().slice(0, 110) || fallback
}

function journalWordCount(value: string) {
  const plain = plainJournalText(value).trim()
  return plain ? plain.split(/\s+/).filter(Boolean).length : 0
}

function plainJournalText(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:div|p|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function escapeJournalHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function sanitizeJournalRichText(value: string) {
  if (!value) return ""
  const looksLikeMarkup = /<(?:strong|b|em|i|u|ul|ol|li|p|div|br)\b/i.test(value)
  const source = looksLikeMarkup ? value : escapeJournalHtml(value).replace(/\n/g, "<br>")
  return source
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(?!\/?(?:strong|b|em|i|u|ul|ol|li|p|div|br)\b)[^>]*>/gi, "")
    .replace(/<(strong|b|em|i|u|ul|ol|li|p|div)\b[^>]*>/gi, "<$1>")
    .replace(/<br\b[^>]*>/gi, "<br>")
}

function journalDisplayHtml(value: string) {
  return sanitizeJournalRichText(value)
}

function isJournalPlaceholderTitle(_kind: JournalEntryType, value: string) {
  const normalized = value.trim().toLowerCase()
  return !normalized || normalized === "add a title" || normalized === "untitled note" || normalized === "untitled"
}

function isJournalPlaceholderBody(_kind: JournalEntryType, value: string) {
  const normalized = plainJournalText(value).trim().toLowerCase()
  return !normalized || normalized === "add a description" || normalized === "private audio note" || normalized === "private video note" || normalized === "no description"
}

function journalStoredTitle(kind: JournalEntryType, title: string, _body: string) {
  return isJournalPlaceholderTitle(kind, title) ? "Untitled" : title.trim()
}

function journalStoredBody(kind: JournalEntryType, body: string) {
  if (isJournalPlaceholderBody(kind, body)) return "No description"
  return kind === "text" ? sanitizeJournalRichText(body) : plainJournalText(body).trim()
}

function titleFromBody(value: string) {
  const sentence = plainJournalText(value).split(/[.!?\n]/)[0]?.trim() || "Untitled note"
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
