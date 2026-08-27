"use client"

import { useEffect, useRef, useState } from "react"

const PARCH_WIDTH = 132
const PARCH_HEIGHT = (PARCH_WIDTH * 560) / 752

export const ParchReading = () => {
  const [ready, setReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let cancelled = false
    let frameHandle: number | null = null

    const revealOnDecodedFrame = () => {
      if (cancelled) return
      video.removeEventListener("loadeddata", revealOnDecodedFrame)
      video.removeEventListener("canplay", revealOnDecodedFrame)
      const candidate = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (callback: () => void) => number
        cancelVideoFrameCallback?: (handle: number) => void
      }

      if (candidate.requestVideoFrameCallback) {
        frameHandle = candidate.requestVideoFrameCallback(() => {
          if (!cancelled) setReady(true)
        })
      } else {
        setReady(true)
      }
      void video.play().catch(() => {})
    }

    if (video.readyState >= 2) {
      revealOnDecodedFrame()
    } else {
      video.addEventListener("loadeddata", revealOnDecodedFrame, { once: true })
      video.addEventListener("canplay", revealOnDecodedFrame, { once: true })
      video.load()
    }

    return () => {
      cancelled = true
      video.removeEventListener("loadeddata", revealOnDecodedFrame)
      video.removeEventListener("canplay", revealOnDecodedFrame)
      const candidate = video as HTMLVideoElement & {
        cancelVideoFrameCallback?: (handle: number) => void
      }
      if (frameHandle !== null) candidate.cancelVideoFrameCallback?.(frameHandle)
    }
  }, [])

  return (
    <div
      className={`auth-parch auth-parch-stable mx-auto ${ready ? "is-ready" : "is-loading"}`}
      style={{
        width: PARCH_WIDTH,
        minWidth: PARCH_WIDTH,
        maxWidth: PARCH_WIDTH,
        height: PARCH_HEIGHT,
        minHeight: PARCH_HEIGHT,
        maxHeight: PARCH_HEIGHT,
        background: "#F8F4EC",
      }}
    >
      <video
        ref={videoRef}
        src="/parch-reading.mp4"
        width={752}
        height={560}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-label="Parch reading a book"
        className="auth-parch-video"
        style={{ background: "transparent", mixBlendMode: "darken" }}
      />
    </div>
  )
}
