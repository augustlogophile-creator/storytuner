"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react"
import {
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Mic2,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  Share2,
  Video,
  X,
} from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ScoreRing } from "@/components/arena/score-ring"
import { canRecordInArena, FREE_ARENA_LIMIT, freeArenaRemaining, useApp, type ArenaScores, type Recording } from "@/lib/app-state"
import { saveMedia } from "@/lib/media-store"
import {
  deleteCloudRecording,
  finalizeCloudRecording,
  uploadAndTranscribeRecording,
  type CloudRecordingRef,
  type CloudTranscriptionStage,
} from "@/lib/recording-cloud"
import { cn } from "@/lib/utils"

type Phase = "setup" | "ready" | "recording" | "review" | "scoring" | "result"
type StoryMode = "free" | "scenario"
type TranscriptionOutcome = "idle" | "success" | "no-speech" | "error"
type ArenaConfirmAction = "leave" | "retake-recording" | "retake-review" | "discard" | null
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
const MIN_STORY_WORDS = 50

const scenarios: Scenario[] = [
  {
    id: "personal",
    name: "Personal stories",
    detail: "Find the shape and meaning inside a real moment from your life.",
    prompts: [
      "Tell me about a time you changed your mind about someone.",
      "Tell me about a small moment you still remember clearly.",
      "Tell your own story or response.",
    ],
  },
  {
    id: "interview",
    name: "Interviews",
    detail: "Answer common questions with a story instead of a general claim.",
    prompts: [
      "Tell me about a time you made a mistake and what you did next.",
      "Tell me about a time you worked through a difficult problem.",
      "Tell your own story or response.",
    ],
  },
  {
    id: "point",
    name: "Proving your point",
    detail: "Use a story as evidence for an idea, opinion, or argument.",
    prompts: [
      "Tell a story that shows why preparation matters.",
      "Tell a story that supports the idea that first impressions can be wrong.",
      "Tell your own story or response.",
    ],
  },
  {
    id: "presentation",
    name: "Presentations",
    detail: "Open, explain, or close a presentation with a memorable story.",
    prompts: [
      "Open a presentation with a story that makes your topic matter.",
      "Tell a short story that helps explain a difficult idea.",
      "Tell your own story or response.",
    ],
  },
  {
    id: "difficult",
    name: "Difficult conversations",
    detail: "Use one honest moment to explain what happened and why it mattered.",
    prompts: [
      "Tell someone about a specific moment when their actions affected you.",
      "Explain a misunderstanding by telling the moment it first began.",
      "Tell your own story or response.",
    ],
  },
  {
    id: "conversation",
    name: "Everyday conversation",
    detail: "Practice natural stories for the questions people ask all the time.",
    prompts: [
      "What is the most interesting thing that happened to you this week?",
      "Tell me about a recent moment that made you laugh.",
      "Tell your own story or response.",
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
  const isOpenResponse = storyMode === "scenario" && promptIndex % scenario.prompts.length === scenario.prompts.length - 1
  const contextName = storyMode === "free" ? "Open story" : scenario.name
  const remainingFreeStories = freeArenaRemaining(state)
  const canRecord = canRecordInArena(state)
  const [cameraOn, setCameraOn] = useState(true)
  const [targetSeconds, setTargetSeconds] = useState(90)
  const [showDurationOptions, setShowDurationOptions] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ArenaConfirmAction>(null)
  const [pendingHref, setPendingHref] = useState("")
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
  const [transcriptionStage, setTranscriptionStage] = useState<CloudTranscriptionStage | "idle">("idle")
  const [transcriptionOutcome, setTranscriptionOutcome] = useState<TranscriptionOutcome>("idle")
  const [savedId, setSavedId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const transcriptRef = useRef<HTMLTextAreaElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioRecorderRef = useRef<MediaRecorder | null>(null)
  const transcriptionBlobRef = useRef<Blob | null>(null)
  const cloudUploadRef = useRef<CloudRecordingRef | null>(null)
  const transcriptionPromiseRef = useRef<Promise<string> | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioChunksRef = useRef<Blob[]>([])
  const stoppingRef = useRef(false)
  const autoTranscriptionStartedRef = useRef(false)
  const preparingRoomRef = useRef(false)
  const captureVersionRef = useRef(0)
  const transcriptWordCount = meaningfulWordCount(transcript)

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
    if (["ready", "recording"].includes(phase)) document.documentElement.dataset.recordingRoom = "true"
    else delete document.documentElement.dataset.recordingRoom
    return () => { delete document.documentElement.dataset.recordingRoom }
  }, [phase])

  useEffect(() => {
    if (phase !== "recording") return
    const handleLinkClick = (event: MouseEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const element = event.target instanceof Element ? event.target.closest("a[href]") : null
      if (!element || element.getAttribute("target") === "_blank") return
      const href = element.getAttribute("href")
      if (!href || href.startsWith("#")) return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      setPendingHref(href)
      setConfirmAction("leave")
    }
    document.addEventListener("click", handleLinkClick, true)
    return () => document.removeEventListener("click", handleLinkClick, true)
  }, [phase])

  useEffect(() => {
    if (phase === "recording" && seconds >= limitSeconds && !stoppingRef.current) stopRecording()
  }, [phase, seconds, limitSeconds])

  useEffect(() => {
    if (!["ready", "recording"].includes(phase) || !videoRef.current || !streamRef.current) return
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

  useEffect(() => () => {
    const cloudUpload = cloudUploadRef.current
    cloudUploadRef.current = null
    if (cloudUpload) void deleteCloudRecording(cloudUpload).catch(() => undefined)
  }, [])

  async function cleanupDraftCloudUpload() {
    const cloudUpload = cloudUploadRef.current
    cloudUploadRef.current = null
    if (cloudUpload) await deleteCloudRecording(cloudUpload).catch(() => undefined)
  }

  function reset() {
    captureVersionRef.current += 1
    void cleanupDraftCloudUpload()
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
    setTranscriptionOutcome("idle")
    setMediaBlob(null)
    setMediaUrl(null)
    setMediaKind("none")
    setMimeType("")
    setFeedback(null)
    setTranscribing(false)
    setTranscriptionStage("idle")
    setSavedId(null)
    setError("")
    chunksRef.current = []
    audioChunksRef.current = []
    transcriptionBlobRef.current = null
    transcriptionPromiseRef.current = null
    stoppingRef.current = false
    autoTranscriptionStartedRef.current = false
    preparingRoomRef.current = false
    streamRef.current = null
    recorderRef.current = null
    audioRecorderRef.current = null
  }

  function enterRecordingRoom() {
    setError("")
    if (!canRecord) {
      setError("You have used both free spoken story reviews. Membership unlocks unlimited practice.")
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser does not support in-app recording. You can still type your story and ask Weaver to grade it.")
      setCameraOn(false)
      setPhase("review")
      return
    }

    preparingRoomRef.current = false
    void prepareRecordingRoom()
  }

  async function prepareRecordingRoom() {
    if (preparingRoomRef.current) return
    preparingRoomRef.current = true
    setError("")

    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: cameraOn ? { facingMode: "user" } : false })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        setCameraOn(false)
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = stream
      setCameraOn(stream.getVideoTracks().length > 0)
      setSeconds(0)
      setExtraSeconds(0)
      setPaused(false)
      setPhase("ready")
    } catch {
      setError("Microphone access was not available. Check your browser permissions, then try again.")
      setPhase("setup")
    } finally {
      preparingRoomRef.current = false
    }
  }

  function startRecording() {
    setError("")
    const stream = streamRef.current
    if (!stream) {
      setError("The recording room is not ready yet. Try entering again.")
      setPhase("setup")
      return
    }

    try {
      const hasVideo = stream.getVideoTracks().length > 0
      const candidates = hasVideo
        ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
        : ["audio/webm;codecs=opus", "audio/webm"]
      const chosen = candidates.find((type) => typeof MediaRecorder.isTypeSupported !== "function" || MediaRecorder.isTypeSupported(type))
      const recorder = chosen
        ? new MediaRecorder(stream, { mimeType: chosen, ...(hasVideo ? {} : { audioBitsPerSecond: 48000 }) })
        : new MediaRecorder(stream, hasVideo ? undefined : { audioBitsPerSecond: 48000 })

      recorderRef.current = recorder
      const captureVersion = ++captureVersionRef.current
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
        if (captureVersion !== captureVersionRef.current) return
        if (!mainStopped || !audioStopped || !mainBlob) return
        const kind = hasVideo ? "video" : "audio"
        transcriptionBlobRef.current = audioBlob ?? mainBlob
        const url = URL.createObjectURL(mainBlob)
        setMediaBlob(mainBlob)
        setMediaUrl(url)
        setMediaKind(kind)
        setMimeType(mainBlob.type || (kind === "video" ? "video/webm" : "audio/webm"))
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        audioRecorderRef.current = null
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
      setTranscriptionOutcome("idle")
      setPaused(false)
      setPhase("recording")
    } catch {
      setError("The recording could not start. Check your microphone permissions and try again.")
      setPhase("ready")
    }
  }

  function retakeRecording() {
    setConfirmAction("retake-recording")
  }

  function performRetakeRecording() {
    captureVersionRef.current += 1
    void cleanupDraftCloudUpload()
    const audioRecorder = audioRecorderRef.current
    if (audioRecorder && audioRecorder.state !== "inactive") audioRecorder.stop()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") recorder.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    audioRecorderRef.current = null
    chunksRef.current = []
    audioChunksRef.current = []
    transcriptionBlobRef.current = null
    stoppingRef.current = false
    setSeconds(0)
    setExtraSeconds(0)
    setPaused(false)
    setTranscript("")
    setTitle("")
    setTranscriptionOutcome("idle")
    setMediaBlob(null)
    setMediaUrl(null)
    setMediaKind("none")
    setMimeType("")
    preparingRoomRef.current = false
    setPhase("ready")
    void prepareRecordingRoom()
  }

  function retakeFromReview() {
    setConfirmAction("retake-review")
  }

  function performRetakeFromReview() {
    captureVersionRef.current += 1
    void cleanupDraftCloudUpload()
    if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    setSeconds(0)
    setExtraSeconds(0)
    setPaused(false)
    setTranscript("")
    setTitle("")
    setTranscriptionOutcome("idle")
    setMediaBlob(null)
    setMediaUrl(null)
    setMediaKind("none")
    setMimeType("")
    setFeedback(null)
    setSavedId(null)
    setError("")
    chunksRef.current = []
    audioChunksRef.current = []
    transcriptionBlobRef.current = null
    stoppingRef.current = false
    autoTranscriptionStartedRef.current = false
    preparingRoomRef.current = false
    void prepareRecordingRoom()
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
    if (transcriptionPromiseRef.current) return transcriptionPromiseRef.current

    const source = transcriptionBlobRef.current ?? mediaBlob
    if (!source) return transcript.trim()
    const captureVersion = captureVersionRef.current

    const task = (async () => {
      setTranscribing(true)
      setTranscriptionStage("preparing")
      setTranscriptionOutcome("idle")
      setError("")

      try {
        const result = await uploadAndTranscribeRecording({
          blob: source,
          durationSeconds: Math.max(1, seconds),
          onCreated: (cloudUpload) => {
            if (captureVersion === captureVersionRef.current) cloudUploadRef.current = cloudUpload
            else void deleteCloudRecording(cloudUpload).catch(() => undefined)
          },
          onStage: (stage) => {
            if (captureVersion === captureVersionRef.current) setTranscriptionStage(stage)
          },
        })

        if (captureVersion !== captureVersionRef.current) {
          await deleteCloudRecording(result).catch(() => undefined)
          return ""
        }

        cloudUploadRef.current = { id: result.id, storagePath: result.storagePath }
        setTranscript(result.transcript)
        setTitle((current) => current.trim() || result.title)
        setTranscriptionOutcome("success")
        return result.transcript.trim()
      } catch (cloudError) {
        cloudUploadRef.current = null
        if (captureVersion !== captureVersionRef.current) return ""

        // Do not silently fall back to the old Vercel upload route. Long
        // recordings depend on the private Supabase pipeline, so surface the
        // exact cloud error and preserve its failed database row for diagnosis.
        setTranscriptionOutcome("error")
        throw cloudError
      } finally {
        if (captureVersion === captureVersionRef.current) {
          setTranscribing(false)
          setTranscriptionStage("idle")
        }
      }
    })()

    transcriptionPromiseRef.current = task
    try {
      return await task
    } finally {
      if (transcriptionPromiseRef.current === task) transcriptionPromiseRef.current = null
    }
  }

  async function scoreTake() {
    setPhase("scoring")
    setError("")
    try {
      let clean = transcript.trim()
      if (meaningfulWordCount(clean) < MIN_STORY_WORDS && mediaBlob) clean = await transcribeRecording()
      const wordCount = meaningfulWordCount(clean)
      if (wordCount < MIN_STORY_WORDS) {
        setTranscriptionOutcome(wordCount === 0 ? "no-speech" : "success")
        throw new Error(wordCount === 0
          ? "Weaver could not hear a story. Check your microphone and try another take."
          : `Weaver caught ${wordCount} ${wordCount === 1 ? "word" : "words"}. Tell at least ${MIN_STORY_WORDS} words, then try again.`)
      }
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
      const cloudUpload = cloudUploadRef.current
      if (cloudUpload) {
        await finalizeCloudRecording(cloudUpload.id, {
          title: title.trim() || firstSentence(clean),
          transcript: clean,
        }).catch(() => undefined)
      }
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
        cloudRecordingId: cloudUpload?.id,
        cloudStoragePath: cloudUpload?.storagePath,
        shared: false,
      }
      addRecording(recording)
      cloudUploadRef.current = null
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
      <div className="flex min-w-0 flex-col gap-6">
        <header className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0"><Eyebrow>Arena</Eyebrow><h1 className="mt-2 break-words text-2xl font-semibold tracking-tight">Your two free story reviews are complete.</h1></div>
            <Link href="/arena/recordings" className="shrink-0 whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold">{recordingCountLabel(state.recordings.length)}</Link>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your lessons and past recordings remain available. Membership unlocks unlimited spoken story reviews.</p>
        </header>
        <section className="rounded-3xl border border-border bg-card p-6 text-center">
          <Clock3 className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Two free spoken stories total</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Each free story includes recording, transcription, a full grade, and a revised version. Membership removes the limit.</p>
          <Link href="/membership" className="mt-5 flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground">See the founding membership<ArrowRight className="h-4 w-4" /></Link>
          <Link href="/arena/recordings" className="mt-2 flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium text-muted-foreground">View past recordings</Link>
        </section>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><Eyebrow>Arena</Eyebrow><h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">Tell a story. See what lands.</h1></div>
          <Link href="/arena/recordings" className="shrink-0 whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground">{recordingCountLabel(state.recordings.length)}</Link>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">Tell any story you choose, or practice storytelling in a real-life situation. Weaver grades the craft, not the topic.</p>
        <span className="mt-3 inline-flex rounded-full bg-brand-soft px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-accent-foreground">{state.premium ? "Unlimited with Membership" : `${remainingFreeStories} of ${FREE_ARENA_LIMIT} free stories remaining`}</span>
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
                {isOpenResponse && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Unprompted. Choose what you want to talk about.</p>}
              </section>
            </>
          )}

          <section className="rounded-3xl border border-border bg-card p-5">
            <p className="text-sm font-semibold">Choose your target length</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {durationOptions.map((duration) => (
                <button
                  key={duration}
                  type="button"
                  onClick={() => { setTargetSeconds(duration); setExtraSeconds(0) }}
                  className={cn(
                    "rounded-2xl border px-2 py-3 text-sm font-semibold tabular-nums transition",
                    targetSeconds === duration ? "border-brand bg-brand-soft text-accent-foreground" : "border-border bg-background text-muted-foreground hover:border-brand/45",
                  )}
                >
                  {formatTime(duration)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowDurationOptions(true)}
              className={cn(
                "mt-3 flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 text-left transition",
                !durationOptions.includes(targetSeconds) ? "border-brand bg-brand-soft/55" : "border-border bg-background hover:border-brand/45",
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">See other options</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {!durationOptions.includes(targetSeconds) ? `${formatTime(targetSeconds)} target selected` : "10 minutes, 20 minutes, or a custom target"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                {!state.premium && <LockKeyhole className="h-4 w-4" />}
                <ChevronRight className="h-4 w-4" />
              </span>
            </button>
            <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-5">
              <div><p className="text-sm font-semibold">Camera</p><p className="mt-0.5 text-xs text-muted-foreground">Turn it off for an audio-only take.</p></div>
              <button type="button" onClick={() => setCameraOn((value) => !value)} className={cn("flex h-10 w-16 items-center rounded-full p-1 transition-colors", cameraOn ? "justify-end bg-brand" : "justify-start bg-secondary")}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">{cameraOn ? <Camera className="h-4 w-4 text-accent-foreground" /> : <CameraOff className="h-4 w-4 text-muted-foreground" />}</span></button>
            </div>
          </section>
          {error && transcriptionOutcome !== "no-speech" && <p className="rounded-2xl bg-destructive/5 p-4 text-sm leading-relaxed text-destructive">{error}</p>}
          <button type="button" onClick={enterRecordingRoom} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]"><Video className="h-4 w-4" />Enter the recording room<ArrowRight className="h-4 w-4" /></button>
          <Link href="/arena/recordings" className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3.5 text-sm font-semibold"><Play className="h-4 w-4" />View, review, or share past recordings</Link>
        </>
      )}

      {phase === "ready" && (
        <section className="relative min-h-[610px] overflow-hidden rounded-[2rem] bg-foreground shadow-xl">
          <video ref={videoRef} muted playsInline className={cn("absolute inset-0 h-full w-full scale-x-[-1] object-cover", !cameraOn && "opacity-0")} />
          {!cameraOn && <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-foreground to-primary p-8 text-center text-primary-foreground"><Mic2 className="h-12 w-12" /><p className="mt-4 text-lg font-semibold">Camera off</p><p className="mt-1 text-sm text-primary-foreground/60">Your microphone is ready.</p></div>}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />
          <div className="relative z-10 flex flex-col items-center p-6 text-center text-white">
            <p className="max-w-sm text-sm font-semibold leading-relaxed">{prompt}</p>
            {isOpenResponse && <p className="mt-1 text-xs text-white/60">Unprompted. Choose what you want to talk about.</p>}
            <p className="mt-5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-white/65">Ready when you are</p>
            <p className="mt-2 text-sm font-semibold tabular-nums">Target · {formatTime(limitSeconds)}</p>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center gap-7 p-7 text-white">
            <Control label={cameraOn ? "Camera" : "Camera off"} onClick={toggleCamera} icon={cameraOn ? Camera : CameraOff} />
            <Control label="Start" onClick={startRecording} icon={Play} large tone="brand" />
            <Control label="Setup" onClick={reset} icon={RotateCcw} />
          </div>
        </section>
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
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-5 text-white">
            <div className="flex items-end gap-2.5">
              <Control label={cameraOn ? "Camera" : "Camera off"} onClick={toggleCamera} icon={cameraOn ? Camera : CameraOff} />
              <Control label={paused ? "Resume" : "Pause"} onClick={togglePause} icon={paused ? Play : Pause} />
              <Control label="Retake" onClick={retakeRecording} icon={Rewind} />
            </div>
            <Control label="Done" onClick={stopRecording} icon={Check} large tone="success" />
          </div>
        </section>
      )}

      {phase === "review" && (
        <>
          <section className="rounded-3xl border border-border bg-card p-5">
            <Eyebrow>Review your take</Eyebrow>
            {mediaUrl && mediaKind !== "none" && <ReviewMediaPlayer src={mediaUrl} kind={mediaKind} duration={Math.max(1, seconds)} />}
            {!mediaUrl && <div className="mt-4 flex h-28 items-center justify-center rounded-2xl bg-secondary text-sm text-muted-foreground">Text-only review</div>}
          </section>
          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div><Eyebrow>Prepared by Weaver</Eyebrow><h2 className="mt-1 text-base font-semibold">Title and clean transcript</h2></div>
              {transcribing && <Loader2 className="h-5 w-5 animate-spin text-brand" />}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{transcribing ? transcriptionStageLabel(transcriptionStage) : "Weaver creates a readable transcript while preserving your voice and events. Edit anything before grading."}</p>
            <label className="mt-5 block text-sm font-semibold" htmlFor="arena-title">Title</label>
            <input id="arena-title" value={title} onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)} placeholder={transcribing ? "Preparing your story…" : "Give this story a title"} className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand" />
            <div className="mt-5 flex items-center justify-between gap-3">
              <label className="block text-sm font-semibold" htmlFor="arena-transcript">Clean transcript</label>
              <span className={cn("text-xs font-medium tabular-nums", transcriptWordCount >= MIN_STORY_WORDS ? "text-emerald-600" : "text-muted-foreground")}>{transcriptWordCount} / {MIN_STORY_WORDS} words</span>
            </div>
            <textarea ref={transcriptRef} id="arena-transcript" value={transcript} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { setTranscript(event.target.value); setTranscriptionOutcome("success"); if (error) setError("") }} rows={10} placeholder={transcribing ? "Your private audio is uploading and being transcribed…" : "Type or paste what you said here…"} className="mt-3 w-full resize-none rounded-2xl border border-border bg-background p-4 text-sm leading-7 outline-none focus:border-brand" />
          </section>
          {!transcribing && transcriptionOutcome !== "error" && (transcriptionOutcome !== "idle" || !mediaBlob) && transcriptWordCount < MIN_STORY_WORDS && (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-semibold text-amber-950">{transcriptWordCount === 0 ? "Weaver could not hear a story." : "Your story needs a little more before grading."}</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-900/80">{transcriptWordCount === 0 ? "Check your microphone and try another take. This will not use one of your free stories." : `Weaver caught ${transcriptWordCount} ${transcriptWordCount === 1 ? "word" : "words"}. Tell at least ${MIN_STORY_WORDS} words, then try again. This will not use one of your free stories.`}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" onClick={retakeFromReview} className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"><RotateCcw className="h-4 w-4" />Retake</button>
                <button type="button" onClick={() => transcriptRef.current?.focus()} className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold"><FileText className="h-4 w-4" />Review transcript</button>
              </div>
            </section>
          )}
          {error && transcriptionOutcome !== "no-speech" && <p className="rounded-2xl bg-destructive/5 p-4 text-sm leading-relaxed text-destructive">{error}</p>}
          <button type="button" disabled={transcribing || transcriptWordCount < MIN_STORY_WORDS} onClick={() => void scoreTake()} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"><Mic2 className="h-4 w-4" />Get graded<ArrowRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => setConfirmAction("discard")} className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-muted-foreground"><RotateCcw className="h-4 w-4" />Discard and start again</button>
        </>
      )}

      {phase === "scoring" && <div className="flex min-h-96 flex-col items-center justify-center rounded-3xl border border-border bg-card p-8 text-center"><Loader2 className="h-8 w-8 animate-spin text-brand" /><h2 className="mt-5 text-lg font-semibold">Weaver is grading your story</h2><p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">Reviewing the hook, development, landing, and the clearest next revision.</p></div>}

      {phase === "result" && feedback && savedId && (
        <Result feedback={feedback} recording={state.recordings.find((item) => item.id === savedId)} onShare={() => shareRecording(savedId)} onAgain={reset} shared={Boolean(state.recordings.find((item) => item.id === savedId)?.shared)} premium={state.premium} />
      )}

      <DurationOptionsDialog
        open={showDurationOptions}
        premium={state.premium}
        current={targetSeconds}
        onClose={() => setShowDurationOptions(false)}
        onSelect={(duration) => {
          setTargetSeconds(duration)
          setExtraSeconds(0)
          setShowDurationOptions(false)
        }}
      />
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction === "leave" ? "Leave this recording?" : confirmAction === "discard" ? "Discard this take?" : "Retake this story?"}
        confirmLabel={confirmAction === "leave" ? "Leave recording" : confirmAction === "discard" ? "Discard take" : "Retake"}
        onCancel={() => {
          setConfirmAction(null)
          setPendingHref("")
        }}
        onConfirm={() => {
          const action = confirmAction
          setConfirmAction(null)
          if (action === "retake-recording") performRetakeRecording()
          if (action === "retake-review") performRetakeFromReview()
          if (action === "discard") reset()
          if (action === "leave" && pendingHref) {
            const href = pendingHref
            void cleanupDraftCloudUpload().finally(() => window.location.assign(href))
          }
          setPendingHref("")
        }}
      >
        {confirmAction === "leave"
          ? <>Your current recording will not be saved. <strong className="text-foreground">This cannot be undone.</strong></>
          : <>Your current take will be permanently removed. <strong className="text-foreground">This cannot be undone.</strong></>}
      </ConfirmDialog>
    </div>
  )
}

function transcriptionStageLabel(stage: CloudTranscriptionStage | "idle") {
  if (stage === "preparing") return "Preparing a secure private upload…"
  if (stage === "uploading") return "Uploading the audio directly to your private StoryTuner storage…"
  if (stage === "transcribing") return "Weaver is transcribing the private audio…"
  if (stage === "saving") return "Saving the transcript securely…"
  return "Weaver is preparing your transcript…"
}

function DurationOptionsDialog({
  open,
  premium,
  current,
  onClose,
  onSelect,
}: {
  open: boolean
  premium: boolean
  current: number
  onClose: () => void
  onSelect: (duration: number) => void
}) {
  const [minutes, setMinutes] = useState("8")
  const [seconds, setSeconds] = useState("0")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [onClose, open])

  useEffect(() => {
    if (!open || current <= 0) return
    if (![600, 1200].includes(current) && !durationOptions.includes(current)) {
      setMinutes(String(Math.floor(current / 60)))
      setSeconds(String(current % 60))
    }
    setError("")
  }, [current, open])

  if (!open) return null

  function applyCustomTime() {
    if (!premium) return
    const minuteValue = Number.parseInt(minutes || "0", 10)
    const secondValue = Number.parseInt(seconds || "0", 10)
    if (!Number.isFinite(minuteValue) || !Number.isFinite(secondValue) || minuteValue < 0 || secondValue < 0 || secondValue > 59) {
      return setError("Enter valid minutes and seconds.")
    }
    const total = minuteValue * 60 + secondValue
    if (total < 60 || total > 1800) return setError("Choose a target between 1:00 and 30:00.")
    onSelect(total)
  }

  const customSelected = current !== 600 && current !== 1200 && !durationOptions.includes(current)

  return (
    <div className="app-dialog-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="duration-options-title" className="app-dialog-panel max-w-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">Target length</p>
            <h2 id="duration-options-title" className="mt-1.5 text-lg font-semibold tracking-[-0.025em]">Choose a longer time</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Member targets can run up to 30 minutes.</p>
          </div>
          <button type="button" onClick={onClose} className="app-dialog-close" aria-label="Close target length options">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {[600, 1200].map((duration) => {
            const selected = current === duration
            return (
              <button
                key={duration}
                type="button"
                disabled={!premium}
                onClick={() => onSelect(duration)}
                className={cn(
                  "relative flex min-h-20 flex-col justify-center rounded-2xl border px-4 text-left transition",
                  selected ? "border-brand bg-brand-soft" : "border-border bg-background",
                  premium ? "hover:border-brand/50" : "cursor-not-allowed opacity-80",
                )}
              >
                <span className="text-base font-semibold tabular-nums">{duration === 600 ? "10 minutes" : "20 minutes"}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">Long-form practice</span>
                {!premium && <LockKeyhole className="absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            )
          })}
        </div>

        <div className={cn("mt-2.5 rounded-2xl border p-3.5", customSelected ? "border-brand bg-brand-soft/45" : "border-border bg-background", !premium && "opacity-80")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Custom time</p>
              <p className="mt-0.5 text-xs text-muted-foreground">From 1:00 to 30:00</p>
            </div>
            {!premium && <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Minutes</span>
              <input
                type="number"
                min={0}
                max={30}
                inputMode="numeric"
                value={minutes}
                disabled={!premium}
                onChange={(event) => { setMinutes(event.target.value.slice(0, 2)); setError("") }}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-center text-sm font-semibold tabular-nums outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed"
                aria-label="Minutes"
              />
            </label>
            <span className="text-sm font-semibold text-muted-foreground">:</span>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Seconds</span>
              <input
                type="number"
                min={0}
                max={59}
                inputMode="numeric"
                value={seconds}
                disabled={!premium}
                onChange={(event) => { setSeconds(event.target.value.slice(0, 2)); setError("") }}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-center text-sm font-semibold tabular-nums outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed"
                aria-label="Seconds"
              />
            </label>
            {premium && (
              <button type="button" onClick={applyCustomTime} className="shrink-0 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition active:scale-[0.98]">
                Use
              </button>
            )}
          </div>
          {error && <p role="alert" className="mt-2 text-xs font-medium text-destructive">{error}</p>}
        </div>

        {!premium && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand-soft/45 px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-card text-accent-foreground"><LockKeyhole className="h-3.5 w-3.5" /></span>
              <div className="min-w-0">
                <p className="text-xs font-semibold">Available with Membership</p>
                <p className="mt-0.5 text-[0.68rem] text-muted-foreground">Unlock long and custom timers.</p>
              </div>
            </div>
            <Link href="/membership" className="shrink-0 rounded-full border border-brand/25 bg-card px-3 py-2 text-xs font-semibold text-accent-foreground">
              View
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}

function Control({ label, onClick, icon: Icon, large, tone = "default" }: { label: string; onClick: () => void; icon: typeof Camera; large?: boolean; tone?: "default" | "success" | "brand" }) {
  return <button type="button" onClick={onClick} className="flex min-w-0 flex-col items-center gap-2"><span className={cn("flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md transition-transform active:scale-95", large ? "h-16 w-16" : "h-14 w-14", tone === "success" && "bg-emerald-500", tone === "brand" && "bg-blue-500")}><Icon className="h-5 w-5" /></span><span className="max-w-16 truncate text-[0.66rem] font-semibold">{label}</span></button>
}

function ReviewMediaPlayer({ src, kind, duration }: { src: string; kind: "video" | "audio"; duration: number }) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const safeDuration = Math.max(1, duration)
  const progress = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100))

  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    const media = mediaRef.current
    if (media) {
      media.pause()
      try { media.currentTime = 0 } catch {}
    }
  }, [src])

  function togglePlayback() {
    const media = mediaRef.current
    if (!media) return
    if (media.paused) {
      if (currentTime >= safeDuration - 0.1) media.currentTime = 0
      void media.play()
      setPlaying(true)
    } else {
      media.pause()
      setPlaying(false)
    }
  }

  function seek(event: ReactPointerEvent<HTMLDivElement>) {
    const media = mediaRef.current
    if (!media) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const next = ratio * safeDuration
    try { media.currentTime = next } catch {}
    setCurrentTime(next)
  }

  const sharedProps = {
    src,
    preload: "metadata" as const,
    onLoadedMetadata: () => {
      const media = mediaRef.current
      if (!media) return
      media.pause()
      try { media.currentTime = 0 } catch {}
      setCurrentTime(0)
      setPlaying(false)
    },
    onTimeUpdate: () => setCurrentTime(Math.min(safeDuration, mediaRef.current?.currentTime ?? 0)),
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => { setPlaying(false); setCurrentTime(safeDuration) },
  }

  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl bg-foreground text-white">
      {kind === "video" ? (
        <video ref={(node) => { mediaRef.current = node }} playsInline className="max-h-80 w-full bg-foreground object-contain" {...sharedProps} />
      ) : (
        <div className="flex h-36 items-center justify-center bg-gradient-to-br from-slate-800 to-black"><Mic2 className="h-9 w-9 text-white/70" /></div>
      )}
      {kind === "audio" && <audio ref={(node) => { mediaRef.current = node }} className="hidden" {...sharedProps} />}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-4 pt-10">
        <div role="slider" aria-label="Recording progress" aria-valuemin={0} aria-valuemax={safeDuration} aria-valuenow={currentTime} tabIndex={0} onPointerDown={seek} className="h-5 cursor-pointer py-2">
          <div className="h-1 overflow-hidden rounded-full bg-white/30"><span className="block h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${progress}%` }} /></div>
        </div>
        <div className="mt-1 flex items-center gap-3">
          <button type="button" onClick={togglePlayback} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/18 backdrop-blur-md" aria-label={playing ? "Pause recording" : "Play recording"}>{playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}</button>
          <span className="text-xs font-semibold tabular-nums">{formatTime(Math.floor(currentTime))}</span>
          <span className="text-xs text-white/60">/ {formatTime(safeDuration)}</span>
        </div>
      </div>
    </div>
  )
}

function Result({ feedback, recording, onShare, onAgain, shared, premium }: { feedback: Feedback; recording?: Recording; onShare: () => void; onAgain: () => void; shared: boolean; premium: boolean }) {
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
      <section className="rounded-3xl border border-brand/35 bg-brand-soft p-5"><p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-accent-foreground">One change for your next take</p><p className="mt-2 text-sm font-medium leading-relaxed text-foreground">{feedback.levelUp}</p></section>
      <section className="rounded-3xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-3"><div><Eyebrow>Revised story</Eyebrow><h3 className="mt-1 text-sm font-semibold">A stronger version in your voice</h3></div></div><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/90">{feedback.revisedStory}</p></section>
      <Link href={`/coach?recording=${recording.id}`} className="flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3.5 text-sm font-semibold text-brand-foreground"><MessageCircle className="h-4 w-4" />Ask Weaver about this grade</Link>
      <button type="button" onClick={onAgain} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground"><RotateCcw className="h-4 w-4" />Record another story</button>
      {isShared ? (
        <Link href={`/community#post-${recording.id}`} className="flex items-center justify-center gap-2 rounded-full border border-brand bg-brand-soft px-5 py-3.5 text-sm font-semibold text-accent-foreground"><Share2 className="h-4 w-4" />View shared story</Link>
      ) : premium ? (
        <button type="button" onClick={() => { onShare(); setJustShared(true) }} className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3.5 text-sm font-semibold"><Share2 className="h-4 w-4" />Share transcript to Community</button>
      ) : (
        <Link href="/membership" className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3.5 text-sm font-semibold"><Share2 className="h-4 w-4" />Unlock Community sharing</Link>
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
function meaningfulWordCount(text: string) {
  const fillerWords = new Set(["um", "uh", "erm", "hmm", "mhm", "ah", "eh"])
  const words = text.toLowerCase().match(/[a-z0-9]+(?:['’][a-z0-9]+)*/g) ?? []
  return words.filter((word) => !fillerWords.has(word)).length
}
function recordingCountLabel(count: number) { return `${count} ${count === 1 ? "recording" : "recordings"}` }
function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` }
function firstSentence(text: string) { const sentence = text.split(/(?<=[.!?])\s/)[0] || "Untitled story"; return sentence.length > 70 ? `${sentence.slice(0, 67)}…` : sentence }
function labelArea(area: ScoreArea) { return area === "development" ? "Development" : area[0].toUpperCase() + area.slice(1) }
