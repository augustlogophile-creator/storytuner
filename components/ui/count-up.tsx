"use client"

import { useEffect, useRef, useState } from "react"

export function CountUp({
  value,
  duration = 520,
  className,
  suffix = "",
  formatter,
}: {
  value: number
  duration?: number
  className?: string
  suffix?: string
  formatter?: (value: number) => string
}) {
  const [display, setDisplay] = useState(0)
  const previous = useRef(0)

  useEffect(() => {
    const start = previous.current
    const end = value
    previous.current = value

    if (start === end || typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(end)
      return
    }

    let frame = 0
    const startedAt = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + (end - start) * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [duration, value])

  const text = formatter ? formatter(display) : display.toLocaleString()
  return <span className={className}>{text}{suffix}</span>
}
