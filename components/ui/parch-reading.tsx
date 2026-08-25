"use client"

import { useState } from "react"
import { preload } from "react-dom"

const PARCH_WIDTH = 132
const PARCH_HEIGHT = (PARCH_WIDTH * 560) / 752

export const ParchReading = () => {
  const [ready, setReady] = useState(false)

  // Warm the MP4 for direct visits. During onboarding the same URL is already
  // being decoded by an off-screen video, so this normally reuses that work.
  preload("/parch-reading.mp4", { as: "video", type: "video/mp4" })
  preload("/parch-reading-poster.jpg", { as: "image" })

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
      }}
    >
      <img
        src="/parch-reading-poster.jpg"
        width={752}
        height={560}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="sync"
        fetchPriority="high"
        className={`auth-parch-poster ${ready ? "is-hidden" : ""}`}
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "center center",
          opacity: ready ? 0 : 1,
        }}
      />
      <video
        src="/parch-reading.mp4"
        poster="/parch-reading-poster.jpg"
        width={752}
        height={560}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-label="Parch reading a book"
        onLoadedData={() => setReady(true)}
        onCanPlay={() => setReady(true)}
        className="auth-parch-video"
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "center center",
          opacity: ready ? 1 : 0,
        }}
      />
    </div>
  )
}
