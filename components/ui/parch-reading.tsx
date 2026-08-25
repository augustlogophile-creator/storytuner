"use client"

import { useState } from "react"
import { preload } from "react-dom"

export const ParchReading = () => {
  const [ready, setReady] = useState(false)

  preload("/parch-reading.mp4", { as: "video", type: "video/mp4" })

  return (
    <div
      className="auth-parch mx-auto"
      style={{ width: 132, minWidth: 132, maxWidth: 132, height: 98.3, minHeight: 98.3, maxHeight: 98.3 }}
    >
      <video
        src="/parch-reading.mp4"
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
