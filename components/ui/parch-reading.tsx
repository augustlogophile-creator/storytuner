"use client"

import { useEffect, useRef, useState } from "react"

const PARCH_WIDTH = 132
const PARCH_HEIGHT = (PARCH_WIDTH * 560) / 752
const CANVAS_SCALE = 2
const CANVAS_WIDTH = Math.round(PARCH_WIDTH * CANVAS_SCALE)
const CANVAS_HEIGHT = Math.round(PARCH_HEIGHT * CANVAS_SCALE)

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function smoothstep(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function removeNeutralWhite(image: ImageData) {
  const data = image.data

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const alpha = data[index + 3]
    const maximum = Math.max(red, green, blue)
    const minimum = Math.min(red, green, blue)
    const chroma = maximum - minimum
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722

    // The source animation is rendered on a neutral white/off-white canvas.
    // Key only bright, low-chroma pixels so Parch's warm parchment body and
    // blue book stay intact while the rectangular media canvas disappears.
    const brightnessKey = smoothstep(200, 235, luminance)
    const neutralityKey = 1 - smoothstep(8, 35, chroma)
    const keyStrength = clamp01(brightnessKey * neutralityKey)

    if (keyStrength > 0) {
      data[index + 3] = Math.round(alpha * (1 - keyStrength))
    }
  }
}

export const ParchReading = () => {
  const [ready, setReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) return

    let cancelled = false
    let started = false
    let videoFrameHandle: number | null = null
    let animationFrameHandle: number | null = null
    let hasRenderedFrame = false

    const drawTransparentFrame = () => {
      if (cancelled || video.readyState < 2) return

      context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      context.drawImage(video, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      const image = context.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      removeNeutralWhite(image)
      context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      context.putImageData(image, 0, 0)

      if (!hasRenderedFrame) {
        hasRenderedFrame = true
        setReady(true)
      }
    }

    const candidate = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number
      cancelVideoFrameCallback?: (handle: number) => void
    }

    const scheduleVideoFrame = () => {
      if (cancelled) return
      if (candidate.requestVideoFrameCallback) {
        videoFrameHandle = candidate.requestVideoFrameCallback(() => {
          drawTransparentFrame()
          scheduleVideoFrame()
        })
        return
      }

      const tick = () => {
        if (cancelled) return
        drawTransparentFrame()
        animationFrameHandle = window.requestAnimationFrame(tick)
      }
      animationFrameHandle = window.requestAnimationFrame(tick)
    }

    const start = () => {
      if (cancelled || started) return
      started = true
      video.removeEventListener("loadeddata", start)
      video.removeEventListener("canplay", start)
      drawTransparentFrame()
      scheduleVideoFrame()
      void video.play().catch(() => {})
    }

    if (video.readyState >= 2) {
      start()
    } else {
      video.addEventListener("loadeddata", start, { once: true })
      video.addEventListener("canplay", start, { once: true })
      video.load()
    }

    return () => {
      cancelled = true
      video.removeEventListener("loadeddata", start)
      video.removeEventListener("canplay", start)
      if (videoFrameHandle !== null) candidate.cancelVideoFrameCallback?.(videoFrameHandle)
      if (animationFrameHandle !== null) window.cancelAnimationFrame(animationFrameHandle)
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
      }}
    >
      <img
        src="/parch-reading-poster-transparent.png"
        alt=""
        aria-hidden="true"
        className="auth-parch-transparent-poster"
      />
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        aria-label="Parch reading a book"
        className="auth-parch-transparent-canvas"
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
        aria-hidden="true"
        tabIndex={-1}
        className="auth-parch-video-source"
      />
    </div>
  )
}
