"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play, Volume2, VolumeX } from "lucide-react"
import { getMedia } from "@/lib/media-store"
import { createSignedCloudRecordingUrl } from "@/lib/recording-cloud"

export function MediaPlayer({
  recordingId,
  kind,
  cloudStoragePath,
  durationSeconds,
  className,
}: {
  recordingId: string
  kind: "video" | "audio" | "none"
  cloudStoragePath?: string
  durationSeconds?: number
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [playbackKind, setPlaybackKind] = useState<"video" | "audio">(kind === "video" ? "video" : "audio")
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    let localObjectUrl: string | null = null
    setUrl(null)
    setPlaybackKind(kind === "video" ? "video" : "audio")
    setLoaded(false)

    async function load() {
      try {
        const localBlob = await getMedia(recordingId)
        if (!active) return
        if (localBlob) {
          localObjectUrl = URL.createObjectURL(localBlob)
          setPlaybackKind(kind === "video" ? "video" : "audio")
          setUrl(localObjectUrl)
          return
        }

        if (cloudStoragePath) {
          const signedUrl = await createSignedCloudRecordingUrl(cloudStoragePath)
          if (!active) return
          setPlaybackKind("audio")
          setUrl(signedUrl)
        }
      } catch {
        // The transcript and coaching remain available even if media playback fails.
      } finally {
        if (active) setLoaded(true)
      }
    }

    void load()

    return () => {
      active = false
      if (localObjectUrl) URL.revokeObjectURL(localObjectUrl)
    }
  }, [cloudStoragePath, kind, recordingId])

  if (kind === "none" && !cloudStoragePath) return null
  if (!loaded) return <div className="mt-3 h-12 rounded-2xl bg-secondary/70" aria-hidden="true" />
  if (!url) return <p className="mt-3 rounded-2xl bg-secondary px-4 py-3 text-xs text-muted-foreground">The media file is unavailable, but the transcript and coaching are still saved.</p>

  return playbackKind === "video"
    ? <VideoPlayer src={url} className={className} />
    : <AudioPlayer src={url} durationSeconds={durationSeconds} className={className} />
}

function VideoPlayer({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const pause = () => ref.current?.pause()
    window.addEventListener("storytuner:pause-media", pause)
    return () => window.removeEventListener("storytuner:pause-media", pause)
  }, [])

  return <video ref={ref} className={className ?? "mt-3 max-h-80 w-full rounded-2xl bg-foreground"} controls playsInline preload="metadata" src={src} />
}

function AudioPlayer({ src, durationSeconds, className }: { src: string; durationSeconds?: number; className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.pause()
    try { audio.currentTime = 0 } catch { /* metadata may not be ready yet */ }
    setPlaying(false)
    setCurrentTime(0)
    setDuration(durationSeconds && durationSeconds > 0 ? durationSeconds : 0)

    const syncDuration = () => {
      const next = Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : durationSeconds && durationSeconds > 0 ? durationSeconds : 0
      setDuration(next)
      if (next > 0 && audio.currentTime > next) audio.currentTime = 0
    }
    const syncTime = () => setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0)
    const syncPlay = () => setPlaying(!audio.paused && !audio.ended)
    const pauseFromOutside = () => audio.pause()

    audio.addEventListener("loadedmetadata", syncDuration)
    audio.addEventListener("durationchange", syncDuration)
    audio.addEventListener("timeupdate", syncTime)
    audio.addEventListener("play", syncPlay)
    audio.addEventListener("pause", syncPlay)
    audio.addEventListener("ended", syncPlay)
    window.addEventListener("storytuner:pause-media", pauseFromOutside)

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
      window.removeEventListener("storytuner:pause-media", pauseFromOutside)
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
      await audio.play()
    } catch {
      setPlaying(false)
    }
  }

  function seek(value: number) {
    const audio = audioRef.current
    if (!audio || duration <= 0) return
    const next = Math.max(0, Math.min(duration, value))
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

  const safeDuration = duration > 0 ? duration : 1
  const progress = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100))

  return (
    <div className={className ?? "mt-3"}>
      <audio ref={audioRef} preload="metadata" src={src} />
      <div className="recording-audio-player flex min-h-14 items-center gap-3 rounded-full bg-secondary/85 px-3 py-2.5">
        <button type="button" onClick={() => void togglePlay()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-foreground" aria-label={playing ? "Pause recording" : "Play recording"}>
          {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
        </button>
        <span className="w-9 shrink-0 text-[0.72rem] tabular-nums text-foreground">{formatMediaTime(currentTime)}</span>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-y-1/2 left-0 h-1 w-full -translate-y-1/2 rounded-full bg-white/90" />
          <div className="pointer-events-none absolute inset-y-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-white" style={{ width: `${progress}%` }} />
          <input
            type="range"
            min={0}
            max={safeDuration}
            step={0.01}
            value={Math.min(currentTime, safeDuration)}
            onChange={(event) => seek(Number(event.target.value))}
            className="recording-audio-range relative z-10 block h-8 w-full cursor-pointer appearance-none bg-transparent"
            aria-label="Recording playback position"
          />
        </div>
        <button type="button" onClick={toggleMute} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground" aria-label={muted ? "Unmute recording" : "Mute recording"}>
          {muted ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
        </button>
      </div>
    </div>
  )
}

function formatMediaTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
}
