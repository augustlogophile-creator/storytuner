"use client"

import { useEffect, useRef, useState } from "react"
import { preload } from "react-dom"

const PARCH_WIDTH = 132
const PARCH_HEIGHT = (PARCH_WIDTH * 560) / 752

export const ParchReading = () => {
  const [ready, setReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  preload("/parch-reading.mp4", { as: "video", type: "video/mp4" })

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (video.readyState >= 2) {
      setReady(true)
      void video.play().catch(() => {})
      return
    }

    const markReady = () => {
      setReady(true)
      void video.play().catch(() => {})
    }

    video.addEventListener("loadeddata", markReady, { once: true })
    video.addEventListener("canplay", markReady, { once: true })
    return () => {
      video.removeEventListener("loadeddata", markReady)
      video.removeEventListener("canplay", markReady)
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
        background: "transparent",
      }}
    >
      <img
        src="/parch-reading-poster.jpg"
        width={752}
        height={560}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="auth-parch-poster"
      />
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
      />
    </div>
  )
}
