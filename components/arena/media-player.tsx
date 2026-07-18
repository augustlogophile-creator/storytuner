"use client"

import { useEffect, useState } from "react"
import { getMedia } from "@/lib/media-store"
import { downloadCloudRecording } from "@/lib/recording-cloud"

export function MediaPlayer({
  recordingId,
  kind,
  cloudStoragePath,
  className,
}: {
  recordingId: string
  kind: "video" | "audio" | "none"
  cloudStoragePath?: string
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [playbackKind, setPlaybackKind] = useState<"video" | "audio">(kind === "video" ? "video" : "audio")
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setUrl(null)
    setPlaybackKind(kind === "video" ? "video" : "audio")
    setLoaded(false)

    async function load() {
      try {
        const localBlob = await getMedia(recordingId)
        if (!active) return
        if (localBlob) {
          objectUrl = URL.createObjectURL(localBlob)
          setPlaybackKind(kind === "video" ? "video" : "audio")
          setUrl(objectUrl)
          return
        }

        if (cloudStoragePath) {
          const cloudBlob = await downloadCloudRecording(cloudStoragePath)
          if (!active) return
          objectUrl = URL.createObjectURL(cloudBlob)
          setPlaybackKind("audio")
          setUrl(objectUrl)
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
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [cloudStoragePath, kind, recordingId])

  if (kind === "none") return null
  if (!loaded) return <div className="mt-3 h-12 animate-pulse rounded-2xl bg-secondary" />
  if (!url) return <p className="mt-3 rounded-2xl bg-secondary px-4 py-3 text-xs text-muted-foreground">The media file is unavailable, but the transcript and coaching are still saved.</p>

  return playbackKind === "video"
    ? <video className={className ?? "mt-3 max-h-80 w-full rounded-2xl bg-foreground"} controls playsInline src={url} />
    : <audio className={className ?? "mt-3 w-full"} controls src={url} />
}
