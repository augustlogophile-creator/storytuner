"use client"

import { useState } from "react"
import { preload } from "react-dom"

export const ParchReading = () => {
  const [ready, setReady] = useState(false)

  preload("/parch-reading.mp4", { as: "video", type: "video/mp4" })
  preload("/parch-reading-poster.jpg", { as: "image" })

  return (
    <div className="auth-parch mx-auto" style={{ maxWidth: 132, aspectRatio: "752 / 560" }}>
      <img
        src="/parch-reading-poster.jpg"
        alt=""
        aria-hidden="true"
        className={`auth-parch-poster ${ready ? "is-hidden" : ""}`}
        loading="eager"
        fetchPriority="high"
        draggable={false}
      />
      <video
        src="/parch-reading.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/parch-reading-poster.jpg"
        aria-label="Parch reading a book"
        onLoadedData={() => setReady(true)}
        onCanPlay={() => setReady(true)}
        className={`auth-parch-video ${ready ? "is-ready" : ""}`}
      />
    </div>
  )
}
