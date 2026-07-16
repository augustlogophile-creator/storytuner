"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"
import { ArrowLeft, ArrowUp, Loader2, Lock, Trash2 } from "lucide-react"
import { Weaver } from "@/components/weaver"
import { RichText } from "@/components/rich-text"
import { FREE_COACH_LIMIT, useApp, type CoachMessage, type Recording } from "@/lib/app-state"


export function CoachClient() {
  const { state, addCoachExchange, clearCoach } = useApp()
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [recordingId, setRecordingId] = useState("")
  const endRef = useRef<HTMLDivElement | null>(null)
  const remaining = Math.max(0, FREE_COACH_LIMIT - state.coach.sent)
  const blocked = !state.premium && remaining === 0
  const recording = useMemo(
    () => state.recordings.find((item) => item.id === recordingId),
    [recordingId, state.recordings],
  )

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("recording")
    if (id && state.recordings.some((item) => item.id === id)) setRecordingId(id)
    else if (recordingId && !state.recordings.some((item) => item.id === recordingId)) setRecordingId("")
  }, [state.recordings, recordingId])

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
          personalizationContext: state.settings.aiOptIn ? personalizationContext(state.recordings) : "",
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
    <div className="flex min-h-[calc(100vh-8rem)] min-w-0 flex-col gap-4">
      <header>
        <Link href="/home" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <Weaver size={52} />
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">Story coach</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Ask Weaver</h1>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Improve a specific story or ask a broader craft question. Weaver can help you find material, shape structure, sharpen language, strengthen delivery, and decide what to practice next.
        </p>
      </header>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <span>{state.premium ? "Unlimited messages with Membership" : `${remaining}/${FREE_COACH_LIMIT} free messages remaining`}</span>
        {state.coach.messages.length > 0 && (
          <button type="button" onClick={clearCoach} className="inline-flex items-center gap-1 font-semibold hover:text-foreground">
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      <section className="flex min-h-[25rem] flex-1 flex-col rounded-3xl border border-border bg-card">
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-5">
          {state.coach.messages.length === 0 ? (
            <div className="m-auto max-w-xs text-center">
              <p className="text-sm font-semibold">Bring Weaver any storytelling question.</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Ask about a score, a story you are shaping, a line you want to rephrase, or what skill would most improve your craft right now.
              </p>
            </div>
          ) : (
            <>
              {state.coach.messages.map((message: CoachMessage) => (
                message.role === "user" ? (
                  <div key={message.id} className="ml-10 self-end rounded-3xl rounded-br-lg bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
                    {message.content}
                  </div>
                ) : (
                  <div key={message.id} className="flex items-start gap-3">
                    <Weaver size={30} className="mt-1" />
                    <div className="min-w-0 flex-1 pt-1 text-sm">
                      <RichText markdown={message.content} />
                    </div>
                  </div>
                )
              ))}
              {loading && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Weaver size={30} />
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Weaver is thinking…</span>
                </div>
              )}
              <div ref={endRef} />
            </>
          )}
        </div>

        {error && <p className="mx-4 mb-3 rounded-2xl bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

        {blocked ? (
          <div className="border-t border-border p-5 text-center">
            <Lock className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">Your five free messages are used.</p>
            <p className="mt-1 text-xs text-muted-foreground">Membership includes unlimited coaching whenever you need it.</p>
            <Link href="/membership" className="mt-4 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">See Membership</Link>
          </div>
        ) : (
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-brand">
              <textarea
                value={input}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)}
                onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void send()
                  }
                }}
                rows={1}
                placeholder="Message Weaver…"
                className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
              />
              <button type="button" disabled={!input.trim() || loading} onClick={() => void send()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground disabled:opacity-35" aria-label="Send message">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
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
