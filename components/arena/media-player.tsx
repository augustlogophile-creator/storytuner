"use client"

import { useEffect, useState } from "react"
import { getMedia } from "@/lib/media-store"

export function MediaPlayer({ recordingId, kind, className }: { recordingId: string; kind: "video" | "audio" | "none"; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setUrl(null)
    setLoaded(false)
    getMedia(recordingId)
      .then((blob) => {
        if (!active) return
        if (blob) {
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
        }
        setLoaded(true)
      })
      .catch(() => {
        if (active) setLoaded(true)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [recordingId])

  if (kind === "none") return null
  if (!loaded) return <div className="mt-3 h-12 animate-pulse rounded-2xl bg-secondary" />
  if (!url) return <p className="mt-3 rounded-2xl bg-secondary px-4 py-3 text-xs text-muted-foreground">The media file is not available on this device. The transcript and coaching are still saved.</p>

  return kind === "video"
    ? <video className={className ?? "mt-3 max-h-80 w-full rounded-2xl bg-foreground"} controls playsInline src={url} />
    : <audio className={className ?? "mt-3 w-full"} controls src={url} />
}
