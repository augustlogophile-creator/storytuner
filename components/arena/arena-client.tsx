"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { ArrowRight, Camera, CameraOff, Check, Loader2, Lock, Mic2, Pause, Play, RotateCcw, Share2, Square, Trash2, Video } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { MediaPlayer } from "@/components/arena/media-player"
import { ScoreRing } from "@/components/arena/score-ring"
import { arenaUsesToday, canRecordInArena, useApp, type ArenaScores, type Recording } from "@/lib/app-state"
import { saveMedia } from "@/lib/media-store"
import { cn } from "@/lib/utils"

type Phase = "setup" | "recording" | "review" | "scoring" | "result"
type Feedback = { hook: number; development: number; landing: number; strongest: "hook" | "development" | "landing"; praise: string; fix: string; nextTake: string }

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
  onerror: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

const contexts = [
  { id: "personal", premium: false, name: "Personal story", detail: "A true moment that changed something for you.", prompts: ["Tell a story about a small decision that changed the rest of your day.", "Tell a story about a time you were confidently wrong.", "Tell a story about an ordinary object you still remember clearly."] },
  { id: "interview", premium: true, name: "Interview", detail: "Show a quality through one specific scene.", prompts: ["Tell a story that demonstrates persistence without using the word persistent.", "Tell a story about a mistake and what you changed afterward.", "Tell a story that shows how you work with other people."] },
  { id: "toast", premium: true, name: "Toast or tribute", detail: "Honor someone through a precise memory.", prompts: ["Tell one story that captures what makes someone important to you.", "Tell a story about a small habit that reveals someone's character.", "Tell a story that ends with what you now understand about this person."] },
  { id: "advocacy", premium: true, name: "Advocacy", detail: "Use a personal story to make a larger issue concrete.", prompts: ["Tell a story that shows why an issue matters before naming the issue directly.", "Tell a story about the moment you realized something needed to change.", "Tell a story that leads naturally to one clear action for the listener."] },
]

export function ArenaClient() {
  const { state, addRecording, deleteRecording, shareRecording } = useApp()
  const [tab, setTab] = useState<"record" | "reel">("record")
  const [phase, setPhase] = useState<Phase>("setup")
  const [contextId, setContextId] = useState(contexts[0].id)
  const context = contexts.find((item) => item.id === contextId) ?? contexts[0]
  const usedToday = arenaUsesToday(state)
  const canRecord = canRecordInArena(state)
  const [promptIndex, setPromptIndex] = useState(0)
  const prompt = context.prompts[promptIndex % context.prompts.length]
  const [cameraOn, setCameraOn] = useState(true)
  const [seconds, setSeconds] = useState(0)
  const [paused, setPaused] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [title, setTitle] = useState("")
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaKind, setMediaKind] = useState<"video" | "audio" | "none">("none")
  const [mimeType, setMimeType] = useState("")
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    if (phase !== "recording" || paused) return
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [phase, paused])

  useEffect(() => {
    if (phase === "recording") document.documentElement.dataset.recordingRoom = "true"
    else delete document.documentElement.dataset.recordingRoom
    return () => { delete document.documentElement.dataset.recordingRoom }
  }, [phase])

  useEffect(() => {
    if (phase === "recording" && seconds >= 300) stopRecording()
  }, [phase, seconds])


  useEffect(() => {
    if (phase !== "recording" || !videoRef.current || !streamRef.current) return
    videoRef.current.srcObject = streamRef.current
    void videoRef.current.play().catch(() => undefined)
  }, [phase])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (mediaUrl) URL.revokeObjectURL(mediaUrl)
  }, [mediaUrl])

  function reset() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    recognitionRef.current?.stop()
    if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    setPhase("setup")
    setSeconds(0)
    setPaused(false)
    setTranscript("")
    setTitle("")
    setMediaBlob(null)
    setMediaUrl(null)
    setMediaKind("none")
    setFeedback(null)
    setSavedId(null)
    setError("")
    chunksRef.current = []
  }

  async function startRecording() {
    setError("")
    if (!canRecord) {
      setError("You have used today's free Arena take. StoryTuner Plus removes the daily limit.")
      return
    }
    if (context.premium && !state.premium) {
      setError("That specialized prompt track is part of StoryTuner Plus.")
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser does not support in-app recording. You can still type a transcript for feedback.")
      setCameraOn(false)
      setPhase("review")
      return
    }
    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: cameraOn ? { facingMode: "user" } : false })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        setCameraOn(false)
      }
      streamRef.current = stream
      const hasVideo = stream.getVideoTracks().length > 0
      const candidates = hasVideo
        ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
        : ["audio/webm;codecs=opus", "audio/webm"]
      const chosen = candidates.find((type) => !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(type))
      const recorder = chosen ? new MediaRecorder(stream, { mimeType: chosen }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const kind = stream.getVideoTracks().length ? "video" : "audio"
        const type = recorder.mimeType || (kind === "video" ? "video/webm" : "audio/webm")
        const blob = new Blob(chunksRef.current, { type })
        const url = URL.createObjectURL(blob)
        setMediaBlob(blob)
        setMediaUrl(url)
        setMediaKind(kind)
        setMimeType(type)
        stream.getTracks().forEach((track) => track.stop())
        setPhase("review")
      }
      recorder.start(600)
      startSpeechRecognition()
      setSeconds(0)
      setPhase("recording")
    } catch {
      setError("Microphone access was not available. You can type your story below and still receive feedback.")
      setCameraOn(false)
      setPhase("review")
    }
  }

  function startSpeechRecognition() {
    const root = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
    const Recognition = root.SpeechRecognition ?? root.webkitSpeechRecognition
    if (!Recognition) return
    try {
      const recognition = new Recognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "en-US"
      recognition.onresult = (event) => {
        let combined = ""
        for (let index = 0; index < event.results.length; index += 1) {
          combined += `${event.results[index][0].transcript} `
        }
        setTranscript(combined.trim())
      }
      recognition.onerror = () => undefined
      recognition.start()
      recognitionRef.current = recognition
    } catch {}
  }

  function togglePause() {
    const recorder = recorderRef.current
    if (!recorder) return
    if (recorder.state === "recording") {
      recorder.pause()
      setPaused(true)
    } else if (recorder.state === "paused") {
      recorder.resume()
      setPaused(false)
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") recorder.stop()
    else setPhase("review")
  }

  function toggleCamera() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setCameraOn(track.enabled)
  }

  async function scoreTake() {
    const clean = transcript.trim()
    if (clean.length < 20) {
      setError("Add a fuller transcript so the feedback can be specific.")
      return
    }
    setPhase("scoring")
    setError("")
    let result: Feedback
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "arena", transcript: clean, seconds, prompt, context: context.name, premium: state.premium }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Feedback failed")
      result = data as Feedback
    } catch {
      result = heuristicFeedback(clean, seconds)
      setError("Live coaching was unavailable, so StoryTuner used its on-device craft check for this take.")
    }
    const id = crypto.randomUUID()
    if (mediaBlob) await saveMedia(id, mediaBlob).catch(() => undefined)
    const scores: ArenaScores = { hook: result.hook, development: result.development, landing: result.landing }
    const recording: Recording = {
      id,
      createdAt: new Date().toISOString(),
      title: title.trim() || firstSentence(clean),
      context: context.name,
      prompt,
      duration: seconds,
      transcript: clean,
      scores,
      overall: Math.round((scores.hook + scores.development + scores.landing) / 3),
      praise: result.praise,
      fix: result.fix,
      nextTake: result.nextTake,
      mediaKind,
      mimeType,
      shared: false,
    }
    addRecording(recording)
    setFeedback(result)
    setSavedId(id)
    setPhase("result")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (tab === "reel") return <Reel recordings={state.recordings} onDelete={deleteRecording} onShare={shareRecording} onRecord={() => setTab("record")} premium={state.premium} />

  if (phase === "setup" && !canRecord) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <div className="flex items-center justify-between gap-3">
            <div><Eyebrow>Arena</Eyebrow><h1 className="mt-2 text-2xl font-semibold tracking-tight">Today&apos;s free take is complete.</h1></div>
            <button type="button" onClick={() => setTab("reel")} className="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold">Story Reel · {state.recordings.length}</button>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your curriculum and Story Reel remain available. The free Arena allowance resets tomorrow.</p>
        </header>
        <section className="rounded-3xl border border-border bg-card p-6 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">One of one free takes used</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Plus adds unlimited daily recordings and every specialized prompt track.</p>
          <Link href="/membership" className="mt-5 flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground">Review StoryTuner Plus<ArrowRight className="h-4 w-4" /></Link>
          <button type="button" onClick={() => setTab("reel")} className="mt-2 w-full rounded-full px-5 py-3 text-sm font-medium text-muted-foreground">Open your Story Reel</button>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-center justify-between gap-3">
          <div><Eyebrow>Arena</Eyebrow><h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">Tell it out loud.</h1></div>
          <button type="button" onClick={() => setTab("reel")} className="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground">Story Reel · {state.recordings.length}</button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">Record a real take, review the transcript, and receive one clear priority for the next version.</p>
        <span className="mt-3 inline-flex rounded-full bg-brand-soft px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-accent-foreground">{state.premium ? "Unlimited with Plus" : `${Math.max(0, 1 - usedToday)} of 1 free today`}</span>
      </header>

      {phase === "setup" && (
        <>
          <section>
            <p className="mb-3 text-sm font-semibold text-foreground">Choose the situation</p>
            <div className="grid grid-cols-2 gap-3">
              {contexts.map((item) => {
                const locked = item.premium && !state.premium
                return <button key={item.id} type="button" disabled={locked} onClick={() => { setContextId(item.id); setPromptIndex(0) }} className={cn("relative rounded-3xl border p-4 text-left transition-colors", item.id === contextId ? "border-brand bg-brand-soft/45" : "border-border bg-card hover:border-brand/50", locked && "cursor-not-allowed opacity-60")}><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{item.name}</p>{locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}</div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>{locked && <p className="mt-2 font-mono text-[0.55rem] uppercase tracking-wider text-muted-foreground">Plus track</p>}</button>
              })}
            </div>
            {!state.premium && <Link href="/membership" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">See specialized tracks <ArrowRight className="h-3.5 w-3.5" /></Link>}
          </section>
          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3"><Eyebrow>Your prompt</Eyebrow><button type="button" onClick={() => setPromptIndex((value) => (value + 1) % context.prompts.length)} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reroll</button></div>
            <p className="mt-3 text-base font-semibold leading-relaxed text-balance">{prompt}</p>
          </section>
          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold">Camera</p><p className="mt-0.5 text-xs text-muted-foreground">Turn it off for an audio-only take.</p></div><button type="button" onClick={() => setCameraOn((value) => !value)} className={cn("flex h-10 w-16 items-center rounded-full p-1 transition-colors", cameraOn ? "justify-end bg-brand" : "justify-start bg-secondary")}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">{cameraOn ? <Camera className="h-4 w-4 text-accent-foreground" /> : <CameraOff className="h-4 w-4 text-muted-foreground" />}</span></button></div>
          </section>
          <button type="button" onClick={startRecording} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]"><Video className="h-4 w-4" />Enter the recording room<ArrowRight className="h-4 w-4" /></button>
        </>
      )}

      {phase === "recording" && (
        <section className="relative min-h-[610px] overflow-hidden rounded-[2rem] bg-foreground shadow-xl">
          <video ref={videoRef} muted playsInline className={cn("absolute inset-0 h-full w-full scale-x-[-1] object-cover", !cameraOn && "opacity-0")} />
          {!cameraOn && <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-foreground to-primary p-8 text-center text-primary-foreground"><Mic2 className="h-12 w-12" /><p className="mt-4 text-lg font-semibold">Camera off</p><p className="mt-1 text-sm text-primary-foreground/60">Your microphone is still recording.</p></div>}
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-transparent to-black/75" />
          <div className="relative z-10 flex flex-col items-center p-6 text-center text-white">
            <p className="max-w-sm text-sm font-semibold leading-relaxed">{prompt}</p>
            <p className="mt-4 font-mono text-3xl font-semibold tabular-nums">{formatTime(seconds)}</p>
            <span className="mt-2 rounded-full bg-black/35 px-3 py-1 font-mono text-[0.62rem] uppercase tracking-wider">{paused ? "Paused" : "Recording"}</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center gap-7 p-7 text-white">
            <Control label={cameraOn ? "Camera" : "Camera off"} onClick={toggleCamera} icon={cameraOn ? Camera : CameraOff} />
            <Control label={paused ? "Resume" : "Pause"} onClick={togglePause} icon={paused ? Play : Pause} large />
            <Control label="End" onClick={stopRecording} icon={Square} danger />
          </div>
        </section>
      )}

      {phase === "review" && (
        <>
          <section className="rounded-3xl border border-border bg-card p-5">
            <Eyebrow>Review your take</Eyebrow>
            {mediaUrl && mediaKind === "video" && <video src={mediaUrl} controls playsInline className="mt-4 max-h-80 w-full rounded-2xl bg-foreground" />}
            {mediaUrl && mediaKind === "audio" && <audio src={mediaUrl} controls className="mt-4 w-full" />}
            {!mediaUrl && <div className="mt-4 flex h-28 items-center justify-center rounded-2xl bg-secondary text-sm text-muted-foreground">Transcript-only review</div>}
          </section>
          <section className="rounded-3xl border border-border bg-card p-5">
            <label className="text-sm font-semibold" htmlFor="arena-title">Title <span className="font-normal text-muted-foreground">optional</span></label>
            <input id="arena-title" value={title} onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)} placeholder="A short name for this take" className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand" />
            <label className="mt-5 block text-sm font-semibold" htmlFor="arena-transcript">Transcript</label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Correct anything the browser misheard. The feedback is based on these words.</p>
            <textarea id="arena-transcript" value={transcript} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setTranscript(event.target.value)} rows={9} placeholder="Type or correct what you said…" className="mt-3 w-full resize-none rounded-2xl border border-border bg-background p-4 text-sm leading-7 outline-none focus:border-brand" />
          </section>
          {error && <p className="rounded-2xl bg-streak-soft p-4 text-sm leading-relaxed">{error}</p>}
          <button type="button" onClick={scoreTake} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]"><SparkleIcon />Read this take<ArrowRight className="h-4 w-4" /></button>
          <button type="button" onClick={reset} className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-muted-foreground"><RotateCcw className="h-4 w-4" />Discard and start again</button>
        </>
      )}

      {phase === "scoring" && <div className="flex min-h-96 flex-col items-center justify-center rounded-3xl border border-border bg-card p-8 text-center"><Loader2 className="h-8 w-8 animate-spin text-brand" /><h2 className="mt-5 text-lg font-semibold">Reading your story</h2><p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">Looking at the hook, development, and landing as one complete spoken take.</p></div>}

      {phase === "result" && feedback && savedId && (
        <Result feedback={feedback} recording={state.recordings.find((item) => item.id === savedId)} error={error} onShare={() => shareRecording(savedId)} onAgain={reset} shared={Boolean(state.recordings.find((item) => item.id === savedId)?.shared)} premium={state.premium} />
      )}
    </div>
  )
}

function Control({ label, onClick, icon: Icon, large, danger }: { label: string; onClick: () => void; icon: typeof Camera; large?: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} className="flex flex-col items-center gap-2"><span className={cn("flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md", large ? "h-16 w-16" : "h-14 w-14", danger && "bg-destructive")}><Icon className="h-5 w-5" fill={danger ? "currentColor" : "none"} /></span><span className="text-[0.68rem] font-semibold">{label}</span></button>
}

function Result({ feedback, recording, error, onShare, onAgain, shared, premium }: { feedback: Feedback; recording?: Recording; error: string; onShare: () => void; onAgain: () => void; shared: boolean; premium: boolean }) {
  if (!recording) return null
  const strongest = feedback.strongest === "development" ? "Development" : feedback.strongest[0].toUpperCase() + feedback.strongest.slice(1)
  return <div className="flex flex-col gap-5">
    {error && <p className="rounded-2xl bg-streak-soft p-4 text-sm leading-relaxed">{error}</p>}
    <section className="flex items-center gap-5 rounded-3xl border border-border bg-card p-5"><ScoreRing value={recording.overall} /><div><Eyebrow>Saved privately</Eyebrow><h2 className="mt-1 text-lg font-semibold leading-snug">{recording.title}</h2><p className="mt-1 text-xs text-muted-foreground">{recording.context} · {formatTime(recording.duration)}</p></div></section>
    <section className="grid grid-cols-3 gap-3"><SubScore label="Hook" value={feedback.hook} /><SubScore label="Development" value={feedback.development} /><SubScore label="Landing" value={feedback.landing} /></section>
    <section className="rounded-3xl border border-brand/40 bg-brand-soft/40 p-5"><p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">Strongest · {strongest}</p><p className="mt-2 text-sm leading-relaxed">{feedback.praise}</p></section>
    <section className="rounded-3xl border border-border bg-card p-5"><p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">One priority</p><p className="mt-2 text-sm leading-relaxed">{feedback.fix}</p><p className="mt-4 rounded-2xl bg-secondary p-4 text-sm font-medium leading-relaxed">Next take: {feedback.nextTake}</p></section>
    <section className="rounded-3xl border border-border bg-card p-5"><h3 className="text-sm font-semibold">Transcript</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{recording.transcript}</p></section>
    <button type="button" onClick={onAgain} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground"><RotateCcw className="h-4 w-4" />Record another take</button>
    <button type="button" disabled={shared} onClick={onShare} className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3.5 text-sm font-semibold disabled:opacity-60"><Share2 className="h-4 w-4" />{shared ? "Shared to Community" : premium || recording.mediaKind === "none" ? "Share to Community" : "Share transcript"}</button>
    <p className="text-center text-xs leading-relaxed text-muted-foreground">Recordings are private unless you choose to share this specific take.</p>
  </div>
}

function Reel({ recordings, onDelete, onShare, onRecord, premium }: { recordings: Recording[]; onDelete: (id: string) => Promise<void>; onShare: (id: string) => void; onRecord: () => void; premium: boolean }) {
  return <div className="flex flex-col gap-6">
    <header><div className="flex items-center justify-between"><div><Eyebrow>Private archive</Eyebrow><h1 className="mt-2 text-2xl font-semibold tracking-tight">Story Reel</h1></div><button type="button" onClick={onRecord} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Record</button></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Every take stays on this device until you remove it. Sharing is always a separate choice.</p></header>
    {recordings.length === 0 ? <section className="rounded-3xl border border-dashed border-border p-8 text-center"><Mic2 className="mx-auto h-7 w-7 text-muted-foreground" /><h2 className="mt-3 text-base font-semibold">No takes yet</h2><p className="mt-1 text-sm text-muted-foreground">Record a story and it will appear here.</p></section> : recordings.map((recording) => <article key={recording.id} className="rounded-3xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold leading-snug">{recording.title}</p><p className="mt-1 text-xs text-muted-foreground">{recording.context} · {new Date(recording.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {formatTime(recording.duration)}</p></div><span className="rounded-2xl bg-brand-soft px-3 py-2 text-sm font-semibold text-accent-foreground">{recording.overall}</span></div><MediaPlayer recordingId={recording.id} kind={recording.mediaKind} /><details className="mt-4"><summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Transcript and coaching</summary><p className="mt-3 whitespace-pre-wrap rounded-2xl bg-secondary p-4 text-sm leading-7">{recording.transcript}</p><p className="mt-3 text-sm leading-relaxed"><strong>One priority:</strong> {recording.fix}</p></details><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={recording.shared} onClick={() => onShare(recording.id)} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold disabled:opacity-60"><Share2 className="h-3.5 w-3.5" />{recording.shared ? "Shared" : premium || recording.mediaKind === "none" ? "Share" : "Share transcript"}</button><button type="button" onClick={() => { if (window.confirm("Delete this recording permanently?")) void onDelete(recording.id) }} className="flex items-center gap-1.5 rounded-full border border-destructive/25 px-3 py-2 text-xs font-semibold text-destructive"><Trash2 className="h-3.5 w-3.5" />Delete</button></div></article>)}
  </div>
}

function SubScore({ label, value }: { label: string; value: number }) { return <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card px-2 py-4"><span className="text-lg font-semibold">{value}</span><span className="font-mono text-[0.54rem] uppercase tracking-wider text-muted-foreground">{label}</span></div> }
function SparkleIcon() { return <Check className="h-4 w-4" /> }
function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` }
function firstSentence(text: string) { const sentence = text.split(/(?<=[.!?])\s/)[0] || "Untitled story"; return sentence.length > 70 ? `${sentence.slice(0, 67)}…` : sentence }
function heuristicFeedback(text: string, seconds: number): Feedback {
  const words = text.trim().split(/\s+/)
  const sentenceCount = Math.max(1, text.split(/[.!?]+/).filter(Boolean).length)
  const hasTurn = /but|until|then|suddenly|realized|instead|however/i.test(text)
  const hasReflection = /I realized|I learned|I understood|now I|afterward/i.test(text)
  const specific = /\b\d+\b|yesterday|morning|night|kitchen|hallway|car|room|phone|door/i.test(text)
  const lengthScore = Math.min(18, words.length / 8)
  const hook = Math.round(Math.min(92, 58 + lengthScore + (specific ? 10 : 0)))
  const development = Math.round(Math.min(94, 55 + lengthScore + (hasTurn ? 16 : 0)))
  const landing = Math.round(Math.min(93, 54 + Math.min(15, sentenceCount * 2) + (hasReflection ? 18 : 0)))
  const scores = { hook, development, landing }
  const strongest = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]) as Feedback["strongest"]
  return { hook, development, landing, strongest, praise: specific ? "You used concrete information that gives the listener something to picture rather than only summarizing the event." : "The take has a clear subject and enough forward movement for a listener to follow.", fix: hasTurn ? "Make the exact moment of change more visible by slowing down for one sentence at the turn." : "Name the moment when the situation changed. Right now the events move forward, but the central turn is still understated.", nextTake: seconds < 45 ? "Add one scene before the ending and let it play for a few sentences." : "Retell it once with less setup and a longer pause before the turn." }
}
