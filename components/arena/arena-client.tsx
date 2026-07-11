"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import {
  ArrowRight,
  Camera,
  CameraOff,
  Clock3,
  Loader2,
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
  strengths: string[]
  improvements: string[]
  levelUp: string
  revisedStory: string
}

type Scenario = {
  id: string
  name: string
  detail: string
  prompts: string[]
}

const durationOptions = [60, 90, 120, 300]

const scenarios: Scenario[] = [
  {
    id: "personal",
    name: "Personal stories",
    detail: "Find the shape and meaning inside a real moment from your life.",
    prompts: [
      "Tell me about a time you changed your mind about someone.",
      "Tell me about a small moment you still remember clearly.",
      "Tell me about a time something did not go as planned.",
    ],
  },
  {
    id: "interview",
    name: "Interviews",
    detail: "Answer common questions with a story instead of a general claim.",
    prompts: [
      "Tell me about a time you made a mistake and what you did next.",
      "Tell me about a time you worked through a difficult problem.",
      "Tell me about a time you helped a group succeed.",
    ],
  },
  {
    id: "point",
    name: "Proving your point",
    detail: "Use a story as evidence for an idea, opinion, or argument.",
    prompts: [
      "Tell a story that shows why preparation matters.",
      "Tell a story that supports the idea that first impressions can be wrong.",
      "Tell a story that proves a small choice can have a large effect.",
    ],
  },
  {
    id: "presentation",
    name: "Presentations",
    detail: "Open, explain, or close a presentation with a memorable story.",
    prompts: [
      "Open a presentation with a story that makes your topic matter.",
      "Tell a short story that helps explain a difficult idea.",
      "Tell a story that gives your audience a reason to care about your point.",
    ],
  },
  {
    id: "difficult",
    name: "Difficult conversations",
    detail: "Use one honest moment to explain what happened and why it mattered.",
    prompts: [
      "Tell someone about a specific moment when their actions affected you.",
      "Explain a misunderstanding by telling the moment it first began.",
      "Tell a story that leads naturally to an apology or a clear request.",
    ],
  },
  {
    id: "conversation",
    name: "Everyday conversation",
    detail: "Practice natural stories for the questions people ask all the time.",
    prompts: [
      "What is the most interesting thing that happened to you this week?",
      "Tell me about a recent moment that made you laugh.",
      "Tell me about a place you visited that surprised you.",
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
  const prompt = storyMode === "free" ? "Tell a story of your choice." : scenario.prompts[promptIndex % scenario.prompts.length]
  const contextName = storyMode === "free" ? "Open story" : scenario.name
  const usedToday = arenaUsesToday(state)
  const canRecord = canRecordInArena(state)
  const [cameraOn, setCameraOn] = useState(true)
  const [targetSeconds, setTargetSeconds] = useState(90)
  const [extraSeconds, setExtraSeconds] = useState(0)
  const limitSeconds = targetSeconds + extraSeconds
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
  const chunksRef = useRef<Blob[]>([])
  const audioChunksRef = useRef<Blob[]>([])
  const stoppingRef = useRef(false)
  const autoTranscriptionStartedRef = useRef(false)

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
    if (phase === "recording" && seconds >= limitSeconds && !stoppingRef.current) stopRecording()
  }, [phase, seconds, limitSeconds])

  useEffect(() => {
    if (phase !== "recording" || !videoRef.current || !streamRef.current) return
    videoRef.current.srcObject = streamRef.current
    void videoRef.current.play().catch(() => undefined)
  }, [phase])

  useEffect(() => {
    if (phase !== "review" || !mediaBlob || autoTranscriptionStartedRef.current) return
    autoTranscriptionStartedRef.current = true
    void transcribeRecording().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Weaver could not transcribe this recording.")
    })
  }, [phase, mediaBlob])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (mediaUrl) URL.revokeObjectURL(mediaUrl)
  }, [mediaUrl])

  function reset() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    const audioRecorder = audioRecorderRef.current
    if (audioRecorder && audioRecorder.state !== "inactive") audioRecorder.stop()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") recorder.stop()
    if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    setPhase("setup")
    setSeconds(0)
    setExtraSeconds(0)
    setPaused(false)
    setTranscript("")
    setTitle("")
    setMediaBlob(null)
    setMediaUrl(null)
    setMediaKind("none")
    setMimeType("")
    setFeedback(null)
    setTranscribing(false)
    setSavedId(null)
    setError("")
    chunksRef.current = []
    audioChunksRef.current = []
    transcriptionBlobRef.current = null
    stoppingRef.current = false
    autoTranscriptionStartedRef.current = false
  }

  async function startRecording() {
    setError("")
    if (!canRecord) {
      setError("You have used today's free Arena take. StoryTuner Plus removes the daily limit.")
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser does not support in-app recording. You can still type your story and ask Weaver to grade it.")
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
      const chosen = candidates.find((type) => typeof MediaRecorder.isTypeSupported !== "function" || MediaRecorder.isTypeSupported(type))
      const recorder = chosen
        ? new MediaRecorder(stream, { mimeType: chosen, ...(hasVideo ? {} : { audioBitsPerSecond: 48000 }) })
        : new MediaRecorder(stream, hasVideo ? undefined : { audioBitsPerSecond: 48000 })

      recorderRef.current = recorder
      chunksRef.current = []
      audioChunksRef.current = []
      transcriptionBlobRef.current = null
      autoTranscriptionStartedRef.current = false
      stoppingRef.current = false

      let mainBlob: Blob | null = null
      let audioBlob: Blob | null = null
      let mainStopped = false
      let audioStopped = !hasVideo

      const finish = () => {
        if (!mainStopped || !audioStopped || !mainBlob) return
        const kind = hasVideo ? "video" : "audio"
        transcriptionBlobRef.current = audioBlob ?? mainBlob
        const url = URL.createObjectURL(mainBlob)
        setMediaBlob(mainBlob)
        setMediaUrl(url)
        setMediaKind(kind)
        setMimeType(mainBlob.type || (kind === "video" ? "video/webm" : "audio/webm"))
        stream.getTracks().forEach((track) => track.stop())
        setPaused(false)
        setPhase("review")
      }

      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        mainBlob = new Blob(chunksRef.current, { type: recorder.mimeType || (hasVideo ? "video/webm" : "audio/webm") })
        mainStopped = true
        finish()
      }

      if (hasVideo && stream.getAudioTracks().length) {
        const audioStream = new MediaStream(stream.getAudioTracks())
        const audioType = ["audio/webm;codecs=opus", "audio/webm"].find((type) => typeof MediaRecorder.isTypeSupported !== "function" || MediaRecorder.isTypeSupported(type))
        const audioRecorder = audioType
          ? new MediaRecorder(audioStream, { mimeType: audioType, audioBitsPerSecond: 48000 })
          : new MediaRecorder(audioStream, { audioBitsPerSecond: 48000 })
        audioRecorderRef.current = audioRecorder
        audioRecorder.ondataavailable = (event) => { if (event.data.size) audioChunksRef.current.push(event.data) }
        audioRecorder.onstop = () => {
          audioBlob = new Blob(audioChunksRef.current, { type: audioRecorder.mimeType || "audio/webm" })
          audioStopped = true
          finish()
        }
        audioRecorder.onerror = () => {
          audioStopped = true
          finish()
        }
        audioRecorder.start(600)
      } else {
        audioRecorderRef.current = null
      }

      recorder.start(600)
      setSeconds(0)
      setExtraSeconds(0)
      setTranscript("")
      setTitle("")
      setPaused(false)
      setPhase("recording")
    } catch {
      setError("Microphone access was not available. You can type your story and still ask Weaver to grade it.")
      setCameraOn(false)
      setPhase("review")
    }
  }

  function togglePause() {
    const recorder = recorderRef.current
    if (!recorder) return
    const audioRecorder = audioRecorderRef.current
    if (recorder.state === "recording") {
      recorder.pause()
      if (audioRecorder?.state === "recording") audioRecorder.pause()
      setPaused(true)
    } else if (recorder.state === "paused") {
      recorder.resume()
      if (audioRecorder?.state === "paused") audioRecorder.resume()
      setPaused(false)
    }
  }

  function stopRecording() {
    if (stoppingRef.current) return
    stoppingRef.current = true
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
    if (source.size > 4_000_000) throw new Error("This recording is too large for automatic transcription. Type or paste the story below, then get graded.")
    setTranscribing(true)
    setError("")
    try {
      const form = new FormData()
      form.set("file", new File([source], "storytuner-recording.webm", { type: source.type || "audio/webm" }))
      const response = await fetch("/api/transcribe", { method: "POST", body: form })
      const data = (await response.json()) as { text?: string; title?: string; error?: string }
      if (!response.ok || !data.text) throw new Error(data.error || "Weaver could not transcribe this recording.")
      setTranscript(data.text)
      setTitle((current) => current.trim() || data.title?.trim() || "")
      return data.text.trim()
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
      if (clean.length < 20) throw new Error("Add a fuller story so Weaver can give specific feedback.")
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "arena",
          transcript: clean,
          seconds,
          targetSeconds: limitSeconds,
          prompt,
          context: contextName,
        }),
      })
      const data = (await response.json()) as Feedback & { error?: string }
      if (!response.ok) throw new Error(data.error || "Weaver could not grade this story.")
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
        praise: data.strengths[0],
        strengths: data.strengths,
        weakest: data.weakest,
        weakness: data.improvements[0],
        improvements: data.improvements,
        levelUp: data.levelUp,
        revisedStory: data.revisedStory,
        fix: data.improvements[0],
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
      setError(caught instanceof Error ? caught.message : "Weaver could not grade this story.")
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
          <Clock3 className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">One free story per day</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Plus includes unlimited recordings. Every scenario is available whenever you have a take.</p>
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
          <div><Eyebrow>Arena</Eyebrow><h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">Tell a story. See what lands.</h1></div>
          <Link href="/arena/recordings" className="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground">Recordings · {state.recordings.length}</Link>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">Tell any story you choose, or practice storytelling in a real-life situation. Weaver grades the craft, not the topic.</p>
        <span className="mt-3 inline-flex rounded-full bg-brand-soft px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-accent-foreground">{state.premium ? "Unlimited with Plus" : `${Math.max(0, 1 - usedToday)} of 1 free today`}</span>
      </header>

      {phase === "setup" && (
        <>
          <section className="rounded-3xl border border-border bg-card p-4">
            <p className="px-1 text-sm font-semibold">Choose how you want to practice</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setStoryMode("free")} className={cn("rounded-2xl border p-4 text-left transition-colors", storyMode === "free" ? "border-brand bg-brand-soft/55" : "border-border bg-background hover:border-brand/50")}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-foreground"><Mic2 className="h-4 w-4" /></span>
                <p className="mt-3 text-sm font-semibold">Tell any story</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">No prompt. Choose the story yourself.</p>
              </button>
              <button type="button" onClick={() => setStoryMode("scenario")} className={cn("rounded-2xl border p-4 text-left transition-colors", storyMode === "scenario" ? "border-brand bg-brand-soft/55" : "border-border bg-background hover:border-brand/50")}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground"><Video className="h-4 w-4" /></span>
                <p className="mt-3 text-sm font-semibold">Choose a scenario</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Practice a common storytelling situation.</p>
              </button>
            </div>
          </section>

          {storyMode === "free" ? (
            <section className="rounded-3xl border border-brand/35 bg-brand-soft/45 p-5">
              <Eyebrow>Your instruction</Eyebrow>
              <p className="mt-2 text-lg font-semibold">Tell a story of your choice.</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Choose any real experience with a beginning, a meaningful turn, and an ending.</p>
            </section>
          ) : (
            <>
              <section>
                <div className="mb-3 flex items-baseline justify-between"><p className="text-sm font-semibold">Choose a storytelling situation</p><span className="text-xs text-muted-foreground">All included</span></div>
                <div className="grid grid-cols-2 gap-3">
                  {scenarios.map((item) => {
                    const selected = item.id === scenarioId
                    return (
                      <button key={item.id} type="button" onClick={() => { setScenarioId(item.id); setPromptIndex(0) }} className={cn("rounded-3xl border p-4 text-left transition-colors", selected ? "border-brand bg-brand-soft/45" : "border-border bg-card hover:border-brand/50")}>
                        <p className="text-sm font-semibold leading-snug">{item.name}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                      </button>
                    )
                  })}
                </div>
              </section>
              <section className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3"><Eyebrow>Your prompt</Eyebrow><button type="button" onClick={() => setPromptIndex((value) => (value + 1) % scenario.prompts.length)} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />New prompt</button></div>
                <p className="mt-3 text-base font-semibold leading-relaxed text-balance">{prompt}</p>
              </section>
            </>
          )}

          <section className="rounded-3xl border border-border bg-card p-5">
            <p className="text-sm font-semibold">Choose your target length</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {durationOptions.map((duration) => (
                <button key={duration} type="button" onClick={() => setTargetSeconds(duration)} className={cn("rounded-2xl border px-2 py-3 text-sm font-semibold tabular-nums", targetSeconds === duration ? "border-brand bg-brand-soft text-accent-foreground" : "border-border bg-background text-muted-foreground")}>
                  {formatTime(duration)}
                </button>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-5">
              <div><p className="text-sm font-semibold">Camera</p><p className="mt-0.5 text-xs text-muted-foreground">Turn it off for an audio-only take.</p></div>
              <button type="button" onClick={() => setCameraOn((value) => !value)} className={cn("flex h-10 w-16 items-center rounded-full p-1 transition-colors", cameraOn ? "justify-end bg-brand" : "justify-start bg-secondary")}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">{cameraOn ? <Camera className="h-4 w-4 text-accent-foreground" /> : <CameraOff className="h-4 w-4 text-muted-foreground" />}</span></button>
            </div>
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
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />
          <div className="relative z-10 flex flex-col items-center p-6 text-center text-white">
            <p className="max-w-sm text-sm font-semibold leading-relaxed">{prompt}</p>
            <p className="mt-4 font-mono text-3xl font-semibold tabular-nums">{formatTime(seconds)}</p>
            <div className="mt-3 w-full max-w-xs">
              <div className="flex items-center justify-between text-[0.68rem] font-semibold text-white/75"><span>{paused ? "Paused" : "Recording"}</span><span>{formatTime(Math.max(0, limitSeconds - seconds))} left</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"><span className="block h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${Math.min(100, (seconds / limitSeconds) * 100)}%` }} /></div>
            </div>
            {limitSeconds - seconds <= 10 && limitSeconds - seconds > 0 && extraSeconds === 0 && (
              <button type="button" onClick={() => setExtraSeconds(45)} className="mt-4 rounded-full bg-white/18 px-4 py-2 text-xs font-semibold backdrop-blur-md">Add 45 seconds</button>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center gap-7 p-7 text-white"><Control label={cameraOn ? "Camera" : "Camera off"} onClick={toggleCamera} icon={cameraOn ? Camera : CameraOff} /><Control label={paused ? "Resume" : "Pause"} onClick={togglePause} icon={paused ? Play : Pause} large /><Control label="End" onClick={stopRecording} icon={Square} danger /></div>
        </section>
      )}

      {phase === "review" && (
        <>
          <section className="rounded-3xl border border-border bg-card p-5">
            <Eyebrow>Review your take</Eyebrow>
            {mediaUrl && mediaKind === "video" && <video src={mediaUrl} controls playsInline className="mt-4 max-h-80 w-full rounded-2xl bg-foreground" />}
            {mediaUrl && mediaKind === "audio" && <audio src={mediaUrl} controls className="mt-4 w-full" />}
            {!mediaUrl && <div className="mt-4 flex h-28 items-center justify-center rounded-2xl bg-secondary text-sm text-muted-foreground">Text-only review</div>}
          </section>
          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div><Eyebrow>Prepared by Weaver</Eyebrow><h2 className="mt-1 text-base font-semibold">Title and clean transcript</h2></div>
              {transcribing && <Loader2 className="h-5 w-5 animate-spin text-brand" />}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Weaver removes empty filler and fixes punctuation while preserving your voice, wording, and events. Edit anything before grading.</p>
            <label className="mt-5 block text-sm font-semibold" htmlFor="arena-title">Title</label>
            <input id="arena-title" value={title} onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)} placeholder={transcribing ? "Weaver is creating a title…" : "Give this story a title"} className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand" />
            <label className="mt-5 block text-sm font-semibold" htmlFor="arena-transcript">Clean transcript</label>
            <textarea id="arena-transcript" value={transcript} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setTranscript(event.target.value)} rows={10} placeholder={transcribing ? "Weaver is transcribing and cleaning your story…" : "Type or paste what you said here…"} className="mt-3 w-full resize-none rounded-2xl border border-border bg-background p-4 text-sm leading-7 outline-none focus:border-brand" />
          </section>
          {error && <p className="rounded-2xl bg-destructive/5 p-4 text-sm leading-relaxed text-destructive">{error}</p>}
          <button type="button" disabled={transcribing || transcript.trim().length < 20} onClick={() => void scoreTake()} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"><Mic2 className="h-4 w-4" />Get graded<ArrowRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => { if (window.confirm("Discard this take and start again?")) reset() }} className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-muted-foreground"><RotateCcw className="h-4 w-4" />Discard and start again</button>
        </>
      )}

      {phase === "scoring" && <div className="flex min-h-96 flex-col items-center justify-center rounded-3xl border border-border bg-card p-8 text-center"><Loader2 className="h-8 w-8 animate-spin text-brand" /><h2 className="mt-5 text-lg font-semibold">Weaver is grading your story</h2><p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">Reviewing the hook, development, landing, and the clearest next revision.</p></div>}

      {phase === "result" && feedback && savedId && (
        <Result feedback={feedback} recording={state.recordings.find((item) => item.id === savedId)} onShare={() => shareRecording(savedId)} onAgain={reset} shared={Boolean(state.recordings.find((item) => item.id === savedId)?.shared)} />
      )}
    </div>
  )
}

function Control({ label, onClick, icon: Icon, large, danger }: { label: string; onClick: () => void; icon: typeof Camera; large?: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} className="flex flex-col items-center gap-2"><span className={cn("flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md", large ? "h-16 w-16" : "h-14 w-14", danger && "bg-destructive")}><Icon className="h-5 w-5" fill={danger ? "currentColor" : "none"} /></span><span className="text-[0.68rem] font-semibold">{label}</span></button>
}

function Result({ feedback, recording, onShare, onAgain, shared }: { feedback: Feedback; recording?: Recording; onShare: () => void; onAgain: () => void; shared: boolean }) {
  const [justShared, setJustShared] = useState(false)
  if (!recording) return null
  const isShared = shared || justShared
  const strongest = labelArea(feedback.strongest)
  const weakest = labelArea(feedback.weakest)
  return (
    <div className="flex flex-col gap-5">
      <section className="flex items-center gap-5 rounded-3xl border border-border bg-card p-5"><ScoreRing value={recording.overall} /><div><Eyebrow>Saved privately</Eyebrow><h2 className="mt-1 text-lg font-semibold leading-snug">{recording.title}</h2><p className="mt-1 text-xs text-muted-foreground">{recording.context} · {formatTime(recording.duration)}</p></div></section>
      <section className="grid grid-cols-3 gap-3"><SubScore label="Hook" value={feedback.hook} /><SubScore label="Development" value={feedback.development} /><SubScore label="Landing" value={feedback.landing} /></section>
      <FeedbackList tone="good" title={`What is working · ${strongest}`} items={feedback.strengths} />
      <FeedbackList tone="bad" title={`What to improve · ${weakest}`} items={feedback.improvements} />
      <section className="rounded-3xl border border-brand/35 bg-brand-soft p-5"><p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-accent-foreground">Level up now</p><p className="mt-2 text-sm font-medium leading-relaxed text-foreground">{feedback.levelUp}</p></section>
      <section className="rounded-3xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-3"><div><Eyebrow>Revised story</Eyebrow><h3 className="mt-1 text-sm font-semibold">A stronger version in your voice</h3></div></div><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/90">{feedback.revisedStory}</p></section>
      <Link href={`/coach?recording=${recording.id}`} className="flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3.5 text-sm font-semibold text-brand-foreground"><MessageCircle className="h-4 w-4" />Ask Weaver about this grade</Link>
      <button type="button" onClick={onAgain} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground"><RotateCcw className="h-4 w-4" />Record another story</button>
      {isShared ? (
        <Link href={`/community#post-${recording.id}`} className="flex items-center justify-center gap-2 rounded-full border border-brand bg-brand-soft px-5 py-3.5 text-sm font-semibold text-accent-foreground"><Share2 className="h-4 w-4" />View shared story</Link>
      ) : (
        <button type="button" onClick={() => { onShare(); setJustShared(true) }} className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3.5 text-sm font-semibold"><Share2 className="h-4 w-4" />Share transcript to Community</button>
      )}
      <Link href="/arena/recordings" className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3.5 text-sm font-semibold"><Play className="h-4 w-4" />Open all recordings</Link>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">Recordings remain private unless you share a specific story.</p>
    </div>
  )
}

function FeedbackList({ tone, title, items }: { tone: "good" | "bad"; title: string; items: string[] }) {
  return (
    <section className={cn("rounded-3xl border p-5", tone === "good" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50")}>
      <p className={cn("font-mono text-[0.6rem] uppercase tracking-[0.16em]", tone === "good" ? "text-emerald-700" : "text-red-700")}>{title}</p>
      <ul className="mt-3 space-y-2.5 pl-5 text-sm leading-relaxed text-foreground">
        {items.map((item, index) => <li key={index} className="list-disc pl-1">{item}</li>)}
      </ul>
    </section>
  )
}

function SubScore({ label, value }: { label: string; value: number }) { return <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card px-2 py-4"><span className="text-lg font-semibold">{value}</span><span className="font-mono text-[0.54rem] uppercase tracking-wider text-muted-foreground">{label}</span></div> }
function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` }
function firstSentence(text: string) { const sentence = text.split(/(?<=[.!?])\s/)[0] || "Untitled story"; return sentence.length > 70 ? `${sentence.slice(0, 67)}…` : sentence }
function labelArea(area: ScoreArea) { return area === "development" ? "Development" : area[0].toUpperCase() + area.slice(1) }
