"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"
import { ArrowLeft, ArrowUp, ChevronDown, Lock, Mic, Square, Volume2, VolumeX } from "lucide-react"
import { RichText } from "@/components/rich-text"
import { Weaver } from "@/components/weaver"
import { FREE_COACH_LIMIT, useApp, type CoachMessage, type Recording } from "@/lib/app-state"

type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } }
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike> }
type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export function CoachClient() {
  const { state, addCoachExchange } = useApp()
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [recordingId, setRecordingId] = useState("")
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [serverRemaining, setServerRemaining] = useState<number | null>(null)
  const [archivedMessages, setArchivedMessages] = useState<CoachMessage[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const requestKeyRef = useRef<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const localMessages = useMemo(() => state.coach.messages.filter((message) => Boolean(message) && (message.role === "user" || message.role === "assistant") && typeof message.id === "string" && typeof message.content === "string"), [state.coach.messages])
  const safeMessages = useMemo(() => mergeCoachMessages(archivedMessages, localMessages), [archivedMessages, localMessages])
  const localRemaining = Math.max(0, FREE_COACH_LIMIT - state.coach.sent)
  const remaining = state.premium ? Number.POSITIVE_INFINITY : Math.max(0, Math.min(FREE_COACH_LIMIT, serverRemaining ?? localRemaining))
  const blocked = !state.premium && remaining === 0
  const used = state.premium ? 0 : Math.max(0, FREE_COACH_LIMIT - remaining)
  const recording = useMemo(() => state.recordings.find((item) => item.id === recordingId), [recordingId, state.recordings])


  const loadCoachHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/coach/history", { cache: "no-store" })
      if (!response.ok) return false
      const data = await response.json() as { messages?: CoachMessage[] }
      const messages = Array.isArray(data.messages)
        ? data.messages.filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.id === "string" && typeof message.content === "string")
        : []
      setArchivedMessages(messages)
      setHistoryLoaded(true)
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    void loadCoachHistory()
  }, [loadCoachHistory])

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("recording")
    if (id && state.recordings.some((item) => item.id === id)) setRecordingId(id)
    else if (recordingId && !state.recordings.some((item) => item.id === recordingId)) setRecordingId("")
  }, [state.recordings, recordingId])

  useEffect(() => {
    const node = endRef.current
    if (!node) return
    try { node.scrollIntoView({ behavior: "smooth", block: "end" }) } catch { node.scrollIntoView() }
  }, [safeMessages.length, pendingUserMessage, loading])

  useEffect(() => {
    let cancelled = false
    void fetch("/api/usage", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ coach?: { remaining?: number } }> : null)
      .then((data) => { if (!cancelled && Number.isFinite(data?.coach?.remaining)) setServerRemaining(Math.max(0, Math.min(FREE_COACH_LIMIT, Number(data?.coach?.remaining)))) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [state.premium])

  useEffect(() => () => { recognitionRef.current?.stop(); window.speechSynthesis?.cancel() }, [])

  async function send(override?: string) {
    const clean = (override ?? input).trim()
    if (!clean || loading || blocked) return
    setLoading(true)
    setError("")
    setPendingUserMessage(clean)
    setInput("")
    const requestKey = requestKeyRef.current ?? crypto.randomUUID()
    requestKeyRef.current = requestKey

    try {
      const history = safeMessages.slice(-10).map((message) => ({ role: message.role, content: message.content }))
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, { role: "user", content: clean }],
          storyContext: recording ? storyContext(recording) : "No recording selected. Answer as a general storytelling coach.",
          scoreContext: recording ? scoreContext(recording) : "No prior score selected.",
          personalizationContext: state.settings.aiOptIn ? `${onboardingContext(state.onboardingPreferences)}\n\n${personalizationContext(state.recordings)}` : "",
          requestKey,
        }),
      })
      const data = await response.json().catch(() => ({})) as { reply?: unknown; error?: unknown; code?: unknown; historySaved?: unknown; usage?: { remaining?: unknown } }
      if (Number.isFinite(data.usage?.remaining)) setServerRemaining(Math.max(0, Math.min(FREE_COACH_LIMIT, Number(data.usage?.remaining))))
      const reply = typeof data.reply === "string" ? data.reply.trim() : ""
      if (!response.ok || !reply) {
        if (data.code === "COACH_LIMIT_REACHED") setServerRemaining(0)
        throw new Error(typeof data.error === "string" ? data.error : "Parch could not respond.")
      }
      addCoachExchange(clean, reply)
      setArchivedMessages((current) => mergeCoachMessages(current, [
        { id: `${requestKey}:user`, role: "user", content: clean, createdAt: new Date().toISOString() },
        { id: `${requestKey}:assistant`, role: "assistant", content: reply, createdAt: new Date().toISOString() },
      ]))
      if (data.historySaved !== false) void loadCoachHistory()
      requestKeyRef.current = null
      setPendingUserMessage(null)
    } catch (caught) {
      setPendingUserMessage(null)
      setInput(clean)
      setError(caught instanceof Error ? caught.message : "Parch could not respond.")
    } finally { setLoading(false) }
  }

  function startVoice() {
    if (loading || blocked) return
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Constructor) {
      setError("Voice input is not supported in this browser. Try Chrome or use the keyboard.")
      return
    }

    setError("")
    let finalText = ""
    let latestText = ""
    const recognition = new Constructor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-US"
    recognition.onresult = (event) => {
      let interim = ""
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result?.[0]?.transcript ?? ""
        if (result?.isFinal) finalText += transcript
        else interim += transcript
      }
      latestText = `${finalText}${interim}`.trim()
      setInput(latestText)
    }
    recognition.onerror = () => {
      setListening(false)
      setError("I could not hear that clearly. Try the microphone again.")
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
      const clean = (finalText.trim() || latestText.trim())
      if (clean) {
        requestKeyRef.current = null
        setInput(clean)
      }
    }
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  function toggleSpeech(messageId: string, text: string) {
    if (!("speechSynthesis" in window)) return
    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel()
      setSpeakingMessageId(null)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(stripMarkdown(text))
    utterance.rate = 1
    utterance.onend = () => setSpeakingMessageId((current) => current === messageId ? null : current)
    utterance.onerror = () => setSpeakingMessageId((current) => current === messageId ? null : current)
    setSpeakingMessageId(messageId)
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] min-w-0 flex-col gap-4">
      <header>
        <Link href="/home" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Home</Link>
        <div className="mt-4 flex items-center gap-3"><CoachMark size="lg" /><div><p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">AI story coach</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Ask Parch</h1></div></div>
      </header>

      <section className="rounded-3xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Story context</p><p className="mt-1 truncate text-sm font-semibold">{recording ? recording.title : "General storytelling"}</p></div>
          <div className="relative shrink-0">
            <select value={recordingId} onChange={(event) => setRecordingId(event.target.value)} className="max-w-36 appearance-none rounded-full border border-border bg-background py-2 pl-3 pr-8 text-xs font-semibold outline-none focus:border-brand" aria-label="Choose story context">
              <option value="">General</option>
              {state.recordings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
        {recording && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">Parch can reference this story’s transcript, feedback, and scores while you chat.</p>}
      </section>

      <div className="flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
        <span>{state.premium ? "Unlimited coaching with Membership" : `${used} of ${FREE_COACH_LIMIT} free messages used`}</span>
        <span className="hidden sm:inline">{recording ? `Talking about: ${recording.title}` : "General coaching"}</span>
      </div>

      <section className="flex min-h-[30rem] flex-1 flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 sm:px-5">
          {safeMessages.length === 0 && !pendingUserMessage ? (
            <div className="m-auto max-w-xs text-center"><CoachMark size="lg" className="mx-auto" /><p className="mt-4 text-sm font-semibold">What are you working on?</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Ask about a story, an opening, an ending, your feedback, or what to practice next.</p></div>
          ) : (
            <>
              {safeMessages.map((message: CoachMessage) => message.role === "user" ? (
                <div key={message.id} className="coach-message-in ml-10 self-end rounded-3xl rounded-br-lg bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">{message.content}</div>
              ) : (
                <div key={message.id} className="coach-assistant-in group flex items-start gap-3"><CoachMark className="mt-1" /><div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-secondary/55 px-4 py-3 text-sm"><RichText markdown={message.content} /><button type="button" onClick={() => toggleSpeech(message.id, message.content)} className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[0.68rem] font-semibold text-muted-foreground opacity-75 transition-colors hover:bg-background hover:opacity-100" aria-pressed={speakingMessageId === message.id}>{speakingMessageId === message.id ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />} {speakingMessageId === message.id ? "Mute" : "Listen"}</button></div></div>
              ))}
              {pendingUserMessage && <div className="coach-message-in ml-10 self-end rounded-3xl rounded-br-lg bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">{pendingUserMessage}</div>}
              {loading && <div className="coach-message-in flex items-center gap-3"><CoachMark /><div className="flex items-center gap-1.5 rounded-2xl bg-secondary/55 px-4 py-3" aria-label="Parch is thinking"><span className="weaver-thinking-dot" /><span className="weaver-thinking-dot [animation-delay:120ms]" /><span className="weaver-thinking-dot [animation-delay:240ms]" /></div></div>}
              <div ref={endRef} />
            </>
          )}
        </div>

        {error && <div className="mx-4 mb-3 flex items-start justify-between gap-3 rounded-2xl border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={() => setError("")} className="shrink-0 font-semibold opacity-70 hover:opacity-100">Dismiss</button></div>}

        {blocked ? (
          <div className="border-t border-border p-5 text-center"><Lock className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-2 text-sm font-semibold">Your five free messages are used.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Your five exchanges stay here so you can revisit Parch’s advice. Membership includes unlimited coaching.</p><Link href="/membership" className="mt-4 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">See Membership</Link></div>
        ) : (
          <div className="border-t border-border bg-background/75 p-3 backdrop-blur-sm">
            <div className="flex items-end gap-2 rounded-[1.45rem] border border-border bg-card px-2.5 py-2 shadow-sm focus-within:border-brand">
              <button type="button" onClick={startVoice} disabled={loading} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${listening ? "bg-destructive text-destructive-foreground" : "bg-secondary text-foreground hover:bg-brand-soft"}`} aria-label={listening ? "Stop voice input" : "Speak to Parch"}>{listening ? <Square className="h-3.5 w-3.5" fill="currentColor" /> : <Mic className="h-4 w-4" />}</button>
              <textarea value={input} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { requestKeyRef.current = null; setInput(event.target.value) }} onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send() } }} rows={1} placeholder={listening ? "Listening… speak naturally" : recording ? `Ask Parch about ${recording.title}…` : "Message Parch…"} className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground" />
              <button type="button" disabled={!input.trim() || loading} onClick={() => void send()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-transform active:scale-95 disabled:opacity-30" aria-label="Send message"><ArrowUp className="h-4 w-4" /></button>
            </div>
            <p className="mt-2 px-2 text-[0.62rem] leading-4 text-muted-foreground">Press Enter to send. The microphone fills your message so you can review it before sending.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function CoachMark({ size = "sm", className = "" }: { size?: "sm" | "lg"; className?: string }) {
  return (
    <span className={`${size === "lg" ? "h-11 w-11 rounded-2xl p-1.5" : "h-7 w-7 rounded-lg p-1"} ${className} flex shrink-0 items-center justify-center bg-secondary`}>
      <Weaver size={size === "lg" ? 34 : 22} />
    </span>
  )
}

function onboardingContext(preferences: { goal: string; blocker: string }) {
  if (!preferences.goal && !preferences.blocker) return "No onboarding preferences are available yet."
  return `User setup preferences: primary goal = ${preferences.goal || "not set"}; biggest storytelling blocker = ${preferences.blocker || "not set"}. Use this only to make coaching more relevant, not to repeatedly mention the setup.`
}

function mergeCoachMessages(...sources: CoachMessage[][]) {
  const all = sources.flat().filter((message) =>
    message &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0,
  )

  const pairs: Array<{ user: CoachMessage; assistant: CoachMessage; sortKey: string }> = []
  for (let index = 0; index < all.length; index += 1) {
    const user = all[index]
    const assistant = all[index + 1]
    if (user?.role !== "user" || assistant?.role !== "assistant") continue
    const signature = `${user.content.trim()}\u0000${assistant.content.trim()}`
    if (!pairs.some((pair) => `${pair.user.content.trim()}\u0000${pair.assistant.content.trim()}` === signature)) {
      pairs.push({ user, assistant, sortKey: user.createdAt || assistant.createdAt || "" })
    }
    index += 1
  }

  return pairs
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .slice(-15)
    .flatMap((pair) => [pair.user, pair.assistant])
}

function storyContext(recording: Recording) {
  return `Title: ${recording.title}\nContext: ${recording.context}\nPrompt: ${recording.prompt}\nOriginal clean transcript:\n${recording.transcript}\n\nRevised version:\n${recording.revisedStory || "No revised version is available."}`
}

function scoreContext(recording: Recording) {
  const strengths = recording.strengths?.join(" | ") || recording.praise
  const improvements = recording.improvements?.join(" | ") || recording.weakness || recording.fix
  return `Hook ${recording.scores.hook}/100, Development ${recording.scores.development}/100, Landing ${recording.scores.landing}/100. Strengths: ${strengths}. Improvements: ${improvements}. Immediate revision: ${recording.levelUp || recording.nextTake}.`
}

function personalizationContext(recordings: Recording[]) {
  if (!recordings.length) return "No past recordings are available yet."
  return recordings.slice(0, 5).map((recording, index) => {
    const strengths = recording.strengths?.slice(0, 3).join(" | ") || recording.praise
    const improvements = recording.improvements?.slice(0, 3).join(" | ") || recording.weakness || recording.fix
    const transcript = recording.transcript.trim().slice(0, 1200)
    return `PAST STORY ${index + 1}: ${recording.title}\nScores: hook ${recording.scores.hook}, development ${recording.scores.development}, landing ${recording.scores.landing}.\nStrengths: ${strengths}.\nImprovements: ${improvements}.\nTranscript excerpt: ${transcript}`
  }).join("\n\n")
}

function stripMarkdown(value: string) {
  return value.replace(/[`*_>#~-]/g, " ").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/\s+/g, " ").trim()
}
