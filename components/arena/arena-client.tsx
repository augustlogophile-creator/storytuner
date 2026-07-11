"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import {
  ArrowRight,
  Camera,
  CameraOff,
  Loader2,
  Lock,
  MessageCircle,
  Mic2,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Square,
  Video,
} from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { ScoreRing } from "@/components/arena/score-ring"
import { arenaUsesToday, canRecordInArena, useApp, type ArenaScores, type Recording } from "@/lib/app-state"
import { saveMedia } from "@/lib/media-store"
import { cn } from "@/lib/utils"

type Phase = "setup" | "recording" | "review" | "scoring" | "result"
type StoryMode = "free" | "scenario"
type ScoreArea = "hook" | "development" | "landing"
type Feedback = {
  hook: number
  development: number
  landing: number
  strongest: ScoreArea
  weakest: ScoreArea
  praise: string
  weakness: string
  levelUp: string
}

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

type Scenario = {
  id: string
  premium: boolean
  name: string
  detail: string
  prompts: string[]
}

const scenarios: Scenario[] = [
  {
    id: "personal",
    premium: false,
    name: "Personal stories",
    detail: "Questions that help you find a specific, meaningful moment.",
    prompts: [
      "Tell a story about a small decision that changed the rest of your day.",
      "Tell a story about a time you were confidently wrong.",
      "Tell a story about an ordinary object you still remember clearly.",
    ],
  },
  {
    id: "quick",
    premium: false,
    name: "Quick challenges",
    detail: "Short prompts for practicing shape, stakes, and a clean ending.",
    prompts: [
      "Tell a complete story in under one minute about something that went slightly wrong.",
      "Tell a story that begins at the most interesting moment.",
      "Tell a story that ends with one sentence of reflection.",
    ],
  },
  {
    id: "interview",
    premium: true,
    name: "Interviews",
    detail: "Show a quality through one precise scene instead of a claim.",
    prompts: [
      "Tell a story that demonstrates persistence without using the word persistent.",
      "Tell a story about a mistake and what you changed afterward.",
      "Tell a story that shows how you work with other people.",
    ],
  },
  {
    id: "social",
    premium: true,
    name: "Social situations",
    detail: "Practice stories that feel natural in conversation.",
    prompts: [
      "Tell a story you could use when someone asks how your week has been.",
      "Tell a funny story without explaining why it is funny.",
      "Tell a story that helps a new person understand something about you.",
    ],
  },
  {
    id: "school",
    premium: true,
    name: "School and presentations",
    detail: "Make an idea memorable through one human example.",
    prompts: [
      "Open a presentation with a short story that makes the topic matter.",
      "Explain a difficult idea through a moment you personally observed.",
      "Tell a story that supports one clear argument.",
    ],
  },
  {
    id: "difficult",
    premium: true,
    name: "Difficult conversations",
    detail: "Practice clarity, restraint, and emotional honesty.",
    prompts: [
      "Tell someone what happened without exaggerating or minimizing it.",
      "Explain why a moment affected you while keeping the focus on your experience.",
      "Tell a story that leads naturally to a clear request.",
    ],
  },
]

export function ArenaClient() {
  const { state, addRecording, shareRecording } = useApp()
  const [phase, setPhase] = useState<Phase>("setup")
  const [storyMode, setStoryMode] = useState<StoryMode>("free")
  const [scenarioId, setScenarioId] = useState(scenarios[0].id)
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0]
  const [promptIndex, setPromptIndex] = useState(0)
  const prompt = storyMode === "free" ? "Tell any story you choose." : scenario.prompts[promptIndex % scenario.prompts.length]
  const contextName = storyMode === "free" ? "Your own story" : scenario.name
  const usedToday = arenaUsesToday(state)
  const canRecord = canRecordInArena(state)
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
  const [transcribing, setTranscribing] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioRecorderRef = useRef<MediaRecorder | null>(null)
  const transcriptionBlobRef = useRef<Blob | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioChunksRef = useRef<Blob[]>([])

  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("mode")
    if (mode === "scenario") setStoryMode("scenario")
    if (mode === "free") setStoryMode("free")
  }, [])

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
    const audioRecorder = audioRecorderRef.current
    if (audioRecorder && audioRecorder.state !== "inactive") audioRecorder.stop()
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
    setTranscribing(false)
    setSavedId(null)
    setError("")
    chunksRef.current = []
    audioChunksRef.current = []
    transcriptionBlobRef.current = null
  }

  async function startRecording() {
    setError("")
    if (!canRecord) {
      setError("You have used today's free Arena take. StoryTuner Plus removes the daily limit.")
      return
    }
    if (storyMode === "scenario" && scenario.premium && !state.premium) {
      setError("That scenario collection is included with StoryTuner Plus.")
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser does not support in-app recording. You can still type a transcript for OpenAI feedback.")
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
      const recorder = chosen
        ? new MediaRecorder(stream, { mimeType: chosen, ...(hasVideo ? {} : { audioBitsPerSecond: 48000 }) })
        : new MediaRecorder(stream, hasVideo ? undefined : { audioBitsPerSecond: 48000 })
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const kind = stream.getVideoTracks().length ? "video" : "audio"
        const type = recorder.mimeType || (kind === "video" ? "video/webm" : "audio/webm")
        const blob = new Blob(chunksRef.current, { type })
        if (kind === "audio") transcriptionBlobRef.current = blob
        const url = URL.createObjectURL(blob)
        setMediaBlob(blob)
        setMediaUrl(url)
        setMediaKind(kind)
        setMimeType(type)
        stream.getTracks().forEach((track) => track.stop())
        setPhase("review")
      }

      if (hasVideo && stream.getAudioTracks().length) {
        const audioStream = new MediaStream(stream.getAudioTracks())
        const audioType = ["audio/webm;codecs=opus", "audio/webm"].find((type) => !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(type))
        const audioRecorder = audioType ? new MediaRecorder(audioStream, { mimeType: audioType, audioBitsPerSecond: 48000 }) : new MediaRecorder(audioStream, { audioBitsPerSecond: 48000 })
        audioRecorderRef.current = audioRecorder
        audioChunksRef.current = []
        audioRecorder.ondataavailable = (event) => { if (event.data.size) audioChunksRef.current.push(event.data) }
        audioRecorder.onstop = () => {
          transcriptionBlobRef.current = new Blob(audioChunksRef.current, { type: audioRecorder.mimeType || "audio/webm" })
        }
        audioRecorder.start(600)
      }

      recorder.start(600)
      startSpeechRecognition()
      setSeconds(0)
      setPhase("recording")
    } catch {
      setError("Microphone access was not available. You can type your story below and still receive OpenAI feedback.")
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
        for (let index = 0; index < event.results.length; index += 1) combined += `${event.results[index][0].transcript} `
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
    if (recorder.state === "recording") { recorder.pause(); setPaused(true) }
    else if (recorder.state === "paused") { recorder.resume(); setPaused(false) }
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    const audioRecorder = audioRecorderRef.current
    if (audioRecorder && audioRecorder.state !== "inactive") audioRecorder.stop()
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

  async function transcribeRecording() {
    const source = transcriptionBlobRef.current ?? mediaBlob
    if (!source) return transcript.trim()
    if (source.size > 4_000_000) throw new Error("This recording is too large to transcribe in the browser. Use the draft transcript below, then request feedback.")
    const form = new FormData()
    form.set("file", new File([source], "storytuner-recording.webm", { type: source.type || "audio/webm" }))
    const response = await fetch("/api/transcribe", { method: "POST", body: form })
    const data = (await response.json()) as { text?: string; error?: string }
    if (!response.ok || !data.text) throw new Error(data.error || "OpenAI transcription failed.")
    setTranscript(data.text)
    return data.text.trim()
  }

  async function requestOpenAITranscript() {
    if (!mediaBlob || transcribing) return
    setTranscribing(true)
    setError("")
    try {
      await transcribeRecording()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "OpenAI could not transcribe this recording.")
    } finally {
      setTranscribing(false)
    }
  }

  async function scoreTake() {
    setPhase("scoring")
    setError("")
    try {
      let clean = transcript.trim()
      if (clean.length < 20 && mediaBlob) clean = await transcribeRecording()
      if (clean.length < 20) throw new Error("Add a fuller transcript so OpenAI can give specific feedback.")
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "arena", transcript: clean, seconds, prompt, context: contextName, premium: state.premium }),
      })
      const data = (await response.json()) as Feedback & { error?: string }
      if (!response.ok) throw new Error(data.error || "OpenAI feedback failed.")
      const id = crypto.randomUUID()
      if (mediaBlob) await saveMedia(id, mediaBlob).catch(() => undefined)
      const scores: ArenaScores = { hook: data.hook, development: data.development, landing: data.landing }
      const recording: Recording = {
        id,
        createdAt: new Date().toISOString(),
        title: title.trim() || firstSentence(clean),
        context: contextName,
        prompt,
        duration: seconds,
        transcript: clean,
        scores,
        overall: Math.round((scores.hook + scores.development + scores.landing) / 3),
        praise: data.praise,
        weakest: data.weakest,
        weakness: data.weakness,
        levelUp: data.levelUp,
        fix: data.weakness,
        nextTake: data.levelUp,
        mediaKind,
        mimeType,
        shared: false,
      }
      addRecording(recording)
      setFeedback(data)
      setSavedId(id)
      setPhase("result")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "OpenAI could not review this take.")
      setPhase("review")
    }
  }

  if (phase === "setup" && !canRecord) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <div className="flex items-center justify-between gap-3">
            <div><Eyebrow>Arena</Eyebrow><h1 className="mt-2 text-2xl font-semibold tracking-tight">Today&apos;s free take is complete.</h1></div>
            <Link href="/arena/recordings" className="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold">Recordings · {state.recordings.length}</Link>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your lessons and past recordings remain available. The free Arena allowance resets tomorrow.</p>
        </header>
        <section className="rounded-3xl border border-border bg-card p-6 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">One of one free takes used</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Plus includes unlimited recordings and every specialized scenario collection.</p>
          <Link href="/membership" className="mt-5 flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground">Review StoryTuner Plus<ArrowRight className="h-4 w-4" /></Link>
          <Link href="/arena/recordings" className="mt-2 flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium text-muted-foreground">View past recordings</Link>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-center justify-between gap-3">
          <div><Eyebrow>Arena</Eyebrow><h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">Tell it out loud.</h1></div>
          <Link href="/arena/recordings" className="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground">Recordings · {state.recordings.length}</Link>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">Record a story, let OpenAI transcribe it, and receive a focused review.</p>
        <span className="mt-3 inline-flex rounded-full bg-brand-soft px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-accent-foreground">{state.premium ? "Unlimited with Plus" : `${Math.max(0, 1 - usedToday)} of 1 free today`}</span>
      </header>

      {phase === "setup" && (
        <>
          <button type="button" onClick={() => setStoryMode("free")} className={cn("rounded-3xl border p-5 text-left transition-colors", storyMode === "free" ? "border-brand bg-brand-soft/45" : "border-border bg-card hover:border-brand/50")}>
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-brand-foreground"><Mic2 className="h-5 w-5" /></span><div><Eyebrow>Open story</Eyebrow><h2 className="mt-1 text-base font-semibold">Tell a story</h2></div></div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">No prompt. Choose any experience, moment, or idea you want to tell.</p>
          </button>

          <section>
            <div className="mb-3 flex items-baseline justify-between"><p className="text-sm font-semibold">Or practice a scenario</p><span className="text-xs text-muted-foreground">Choose a situation</span></div>
            <div className="grid grid-cols-2 gap-3">
              {scenarios.map((item) => {
                const locked = item.premium && !state.premium
                const selected = storyMode === "scenario" && item.id === scenarioId
                return (
                  <button key={item.id} type="button" onClick={() => { setStoryMode("scenario"); setScenarioId(item.id); setPromptIndex(0) }} className={cn("relative rounded-3xl border p-4 text-left transition-colors", selected ? "border-brand bg-brand-soft/45" : "border-border bg-card hover:border-brand/50", locked && "opacity-70")}>
                    <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{item.name}</p>{locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                    {locked && <p className="mt-2 font-mono text-[0.55rem] uppercase tracking-wider text-muted-foreground">Plus collection</p>}
                  </button>
                )
              })}
            </div>
          </section>

          {storyMode === "scenario" && (
            <section className="rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3"><Eyebrow>Your prompt</Eyebrow><button type="button" onClick={() => setPromptIndex((value) => (value + 1) % scenario.prompts.length)} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />New prompt</button></div>
              <p className="mt-3 text-base font-semibold leading-relaxed text-balance">{prompt}</p>
            </section>
          )}

          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold">Camera</p><p className="mt-0.5 text-xs text-muted-foreground">Turn it off for an audio-only take.</p></div><button type="button" onClick={() => setCameraOn((value) => !value)} className={cn("flex h-10 w-16 items-center rounded-full p-1 transition-colors", cameraOn ? "justify-end bg-brand" : "justify-start bg-secondary")}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">{cameraOn ? <Camera className="h-4 w-4 text-accent-foreground" /> : <CameraOff className="h-4 w-4 text-muted-foreground" />}</span></button></div>
          </section>
          {error && <p className="rounded-2xl bg-destructive/5 p-4 text-sm leading-relaxed text-destructive">{error}</p>}
          <button type="button" onClick={startRecording} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]"><Video className="h-4 w-4" />Enter the recording room<ArrowRight className="h-4 w-4" /></button>
          <Link href="/arena/recordings" className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3.5 text-sm font-semibold"><Play className="h-4 w-4" />View, review, or share past recordings</Link>
        </>
      )}

      {phase === "recording" && (
        <section className="relative min-h-[610px] overflow-hidden rounded-[2rem] bg-foreground shadow-xl">
          <video ref={videoRef} muted playsInline className={cn("absolute inset-0 h-full w-full scale-x-[-1] object-cover", !cameraOn && "opacity-0")} />
          {!cameraOn && <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-foreground to-primary p-8 text-center text-primary-foreground"><Mic2 className="h-12 w-12" /><p className="mt-4 text-lg font-semibold">Camera off</p><p className="mt-1 text-sm text-primary-foreground/60">Your microphone is still recording.</p></div>}
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-transparent to-black/75" />
          <div className="relative z-10 flex flex-col items-center p-6 text-center text-white"><p className="max-w-sm text-sm font-semibold leading-relaxed">{prompt}</p><p className="mt-4 font-mono text-3xl font-semibold tabular-nums">{formatTime(seconds)}</p><span className="mt-2 rounded-full bg-black/35 px-3 py-1 font-mono text-[0.62rem] uppercase tracking-wider">{paused ? "Paused" : "Recording"}</span></div>
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center gap-7 p-7 text-white"><Control label={cameraOn ? "Camera" : "Camera off"} onClick={toggleCamera} icon={cameraOn ? Camera : CameraOff} /><Control label={paused ? "Resume" : "Pause"} onClick={togglePause} icon={paused ? Play : Pause} large /><Control label="End" onClick={stopRecording} icon={Square} danger /></div>
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
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Use OpenAI transcription, then correct anything it misheard before requesting feedback.</p>
            <textarea id="arena-transcript" value={transcript} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setTranscript(event.target.value)} rows={9} placeholder="Type what you said, or let OpenAI transcribe the recording…" className="mt-3 w-full resize-none rounded-2xl border border-border bg-background p-4 text-sm leading-7 outline-none focus:border-brand" />
          </section>
          {error && <p className="rounded-2xl bg-destructive/5 p-4 text-sm leading-relaxed text-destructive">{error}</p>}
          {mediaBlob && <button type="button" disabled={transcribing} onClick={() => void requestOpenAITranscript()} className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3.5 text-sm font-semibold disabled:opacity-50">{transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic2 className="h-4 w-4" />}{transcribing ? "OpenAI is transcribing…" : "Transcribe with OpenAI"}</button>}
          <button type="button" onClick={() => void scoreTake()} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]"><Mic2 className="h-4 w-4" />Review with OpenAI<ArrowRight className="h-4 w-4" /></button>
          <button type="button" onClick={reset} className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-muted-foreground"><RotateCcw className="h-4 w-4" />Discard and start again</button>
        </>
      )}

      {phase === "scoring" && <div className="flex min-h-96 flex-col items-center justify-center rounded-3xl border border-border bg-card p-8 text-center"><Loader2 className="h-8 w-8 animate-spin text-brand" /><h2 className="mt-5 text-lg font-semibold">OpenAI is reading your story</h2><p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">Transcribing the take, then reviewing the hook, development, and landing.</p></div>}

      {phase === "result" && feedback && savedId && (
        <Result feedback={feedback} recording={state.recordings.find((item) => item.id === savedId)} onShare={() => shareRecording(savedId)} onAgain={reset} shared={Boolean(state.recordings.find((item) => item.id === savedId)?.shared)} premium={state.premium} />
      )}
    </div>
  )
}

function Control({ label, onClick, icon: Icon, large, danger }: { label: string; onClick: () => void; icon: typeof Camera; large?: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} className="flex flex-col items-center gap-2"><span className={cn("flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md", large ? "h-16 w-16" : "h-14 w-14", danger && "bg-destructive")}><Icon className="h-5 w-5" fill={danger ? "currentColor" : "none"} /></span><span className="text-[0.68rem] font-semibold">{label}</span></button>
}

function Result({ feedback, recording, onShare, onAgain, shared, premium }: { feedback: Feedback; recording?: Recording; onShare: () => void; onAgain: () => void; shared: boolean; premium: boolean }) {
  if (!recording) return null
  const strongest = labelArea(feedback.strongest)
  const weakest = labelArea(feedback.weakest)
  return (
    <div className="flex flex-col gap-5">
      <section className="flex items-center gap-5 rounded-3xl border border-border bg-card p-5"><ScoreRing value={recording.overall} /><div><Eyebrow>Saved privately</Eyebrow><h2 className="mt-1 text-lg font-semibold leading-snug">{recording.title}</h2><p className="mt-1 text-xs text-muted-foreground">{recording.context} · {formatTime(recording.duration)}</p></div></section>
      <section className="grid grid-cols-3 gap-3"><SubScore label="Hook" value={feedback.hook} /><SubScore label="Development" value={feedback.development} /><SubScore label="Landing" value={feedback.landing} /></section>
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"><p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-emerald-700">Strongest · {strongest}</p><p className="mt-2 text-sm leading-relaxed text-foreground">{feedback.praise}</p></section>
      <section className="rounded-3xl border border-red-200 bg-red-50 p-5"><p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-red-700">Needs work · {weakest}</p><p className="mt-2 text-sm leading-relaxed text-foreground">{feedback.weakness}</p></section>
      <section className="rounded-3xl border border-brand/35 bg-brand-soft p-5"><p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-accent-foreground">Level up now</p><p className="mt-2 text-sm font-medium leading-relaxed text-foreground">{feedback.levelUp}</p></section>
      <section className="rounded-3xl border border-border bg-card p-5"><h3 className="text-sm font-semibold">Transcript</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{recording.transcript}</p></section>
      <Link href={`/coach?recording=${recording.id}`} className="flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3.5 text-sm font-semibold text-brand-foreground"><MessageCircle className="h-4 w-4" />Ask Weaver about this review</Link>
      <button type="button" onClick={onAgain} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground"><RotateCcw className="h-4 w-4" />Record another take</button>
      <button type="button" disabled={shared} onClick={onShare} className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3.5 text-sm font-semibold disabled:opacity-60"><Share2 className="h-4 w-4" />{shared ? "Shared to Community" : premium || recording.mediaKind === "none" ? "Share to Community" : "Share transcript"}</button>
      <Link href="/arena/recordings" className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3.5 text-sm font-semibold"><Play className="h-4 w-4" />Open all recordings</Link>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">Recordings remain private unless you share a specific take.</p>
    </div>
  )
}

function SubScore({ label, value }: { label: string; value: number }) { return <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card px-2 py-4"><span className="text-lg font-semibold">{value}</span><span className="font-mono text-[0.54rem] uppercase tracking-wider text-muted-foreground">{label}</span></div> }
function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` }
function firstSentence(text: string) { const sentence = text.split(/(?<=[.!?])\s/)[0] || "Untitled story"; return sentence.length > 70 ? `${sentence.slice(0, 67)}…` : sentence }
function labelArea(area: ScoreArea) { return area === "development" ? "Development" : area[0].toUpperCase() + area.slice(1) }
