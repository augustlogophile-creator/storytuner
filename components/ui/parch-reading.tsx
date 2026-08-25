"use client"

import { useState } from "react"
import { preload } from "react-dom"

const PARCH_WIDTH = 132
const PARCH_HEIGHT = 98.3

export const ParchReading = () => {
  const [ready, setReady] = useState(false)

  preload("/parch-reading-poster.jpg", { as: "image" })
  preload("/parch-reading.mp4", { as: "video", type: "video/mp4" })

  return (
    <div
      className="auth-parch mx-auto"
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
        alt=""
        aria-hidden="true"
        width={752}
        height={560}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        className={`auth-parch-poster ${ready ? "is-hidden" : ""}`}
        draggable={false}
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
        className={`auth-parch-video ${ready ? "is-ready" : ""}`}
      />
    </div>
  )
}
