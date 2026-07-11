"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Loader2, Lock, Send, Trash2 } from "lucide-react"
import { Weaver } from "@/components/weaver"
import { useApp, type CoachMessage, type Recording } from "@/lib/app-state"

function todayKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function CoachClient() {
  const { state, addCoachExchange, clearCoach } = useApp()
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [recordingId, setRecordingId] = useState(state.recordings[0]?.id ?? "")
  const endRef = useRef<HTMLDivElement | null>(null)
  const sentToday = state.coach.date === todayKey() ? state.coach.sent : 0
  const remaining = Math.max(0, 5 - sentToday)
  const blocked = !state.premium && remaining === 0
  const recording = useMemo(
    () => state.recordings.find((item) => item.id === recordingId) ?? state.recordings[0],
    [recordingId, state.recordings],
  )

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("recording")
    if (id && state.recordings.some((item) => item.id === id)) setRecordingId(id)
  }, [state.recordings])

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [state.coach.messages, loading])

  async function send() {
    const clean = input.trim()
    if (!clean || loading || blocked) return
    setLoading(true)
    setError("")
    try {
      const history = state.coach.messages.slice(-10).map((message) => ({ role: message.role, content: message.content }))
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, { role: "user", content: clean }],
          storyContext: recording ? storyContext(recording) : "No recording selected. Answer as a general storytelling coach.",
          scoreContext: recording ? scoreContext(recording) : "No prior score selected.",
        }),
      })
      const data = (await response.json()) as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || "Weaver could not respond.")
      addCoachExchange(clean, data.reply)
      setInput("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Weaver could not respond.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-5">
      <header>
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <Weaver size={54} />
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">AI story coach</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Ask Weaver</h1>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Ask about a score, strengthen a story, or rephrase a line without losing your voice.
        </p>
      </header>

      <section className="rounded-3xl border border-border bg-card p-4">
        <label htmlFor="coach-story" className="text-xs font-semibold text-muted-foreground">Story context</label>
        <select
          id="coach-story"
          value={recording?.id ?? ""}
          onChange={(event) => setRecordingId(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-brand"
        >
          {state.recordings.length === 0 && <option value="">General storytelling question</option>}
          {state.recordings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{state.premium ? "Unlimited messages with Plus" : `${remaining} of 5 free messages left today`}</span>
          {state.coach.messages.length > 0 && (
            <button type="button" onClick={clearCoach} className="inline-flex items-center gap-1 font-semibold hover:text-foreground">
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </section>

      <section className="flex min-h-[19rem] flex-1 flex-col gap-3 rounded-3xl border border-border bg-card p-4">
        {state.coach.messages.length === 0 ? (
          <div className="m-auto max-w-xs text-center">
            <p className="text-sm font-semibold">Start with a specific question.</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Try: “Why was my development score lower?” or “Make my opening sharper without making it dramatic.”
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {state.coach.messages.map((message: CoachMessage) => (
              <div
                key={message.id}
                className={message.role === "user"
                  ? "ml-8 rounded-3xl rounded-br-lg bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground"
                  : "mr-8 rounded-3xl rounded-bl-lg bg-brand-soft px-4 py-3 text-sm leading-relaxed text-foreground"}
              >
                {message.content}
              </div>
            ))}
            {loading && <div className="mr-8 flex items-center gap-2 rounded-3xl rounded-bl-lg bg-brand-soft px-4 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Weaver is thinking…</div>}
            <div ref={endRef} />
          </div>
        )}
      </section>

      {error && <p className="rounded-2xl bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
      {blocked ? (
        <section className="rounded-3xl border border-border bg-card p-5 text-center">
          <Lock className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">Today&apos;s five free messages are used.</p>
          <p className="mt-1 text-xs text-muted-foreground">Your allowance resets tomorrow. Plus includes unlimited coaching.</p>
          <Link href="/membership" className="mt-4 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Review Plus</Link>
        </section>
      ) : (
        <div className="flex items-end gap-2 rounded-3xl border border-border bg-card p-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
            rows={2}
            placeholder="Ask Weaver about your story…"
            className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <button type="button" disabled={!input.trim() || loading} onClick={() => void send()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground disabled:opacity-40">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  )
}

function storyContext(recording: Recording) {
  return `Title: ${recording.title}\nContext: ${recording.context}\nPrompt: ${recording.prompt}\nTranscript:\n${recording.transcript}`
}

function scoreContext(recording: Recording) {
  return `Hook ${recording.scores.hook}/100, Development ${recording.scores.development}/100, Landing ${recording.scores.landing}/100. Strength: ${recording.praise}. Weakness: ${recording.weakness || recording.fix}. Immediate revision: ${recording.levelUp || recording.nextTake}.`
}
