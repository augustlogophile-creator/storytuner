"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"

export function Celebration({
  active,
  label,
  onDone,
  mobileOnly = false,
}: {
  active: boolean
  label?: string
  onDone?: () => void
  mobileOnly?: boolean
}) {
  const [visible, setVisible] = useState(active)

  const pieces = useMemo(() => {
    if (!active) return []
    return Array.from({ length: 30 }, (_, index) => ({
      id: `${index}-${Math.round(Math.random() * 10_000)}`,
      left: 8 + Math.random() * 84,
      top: 10 + Math.random() * 58,
      rotate: -30 + Math.random() * 60,
      drift: `${-40 + Math.random() * 80}px`,
      drop: `${150 + Math.random() * 140}px`,
      spin: `${180 + Math.random() * 420}deg`,
      duration: `${1.45 + Math.random() * 0.95}s`,
      delay: `${index * 22 + Math.random() * 70}ms`,
      scale: `${0.8 + Math.random() * 0.55}`,
      hue: index % 4,
    }))
  }, [active])

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }
    setVisible(true)
    const timeout = window.setTimeout(() => {
      setVisible(false)
      onDone?.()
    }, 2200)
    return () => window.clearTimeout(timeout)
  }, [active, onDone])

  if (!visible) return null

  return (
    <div className={cn("celebration-layer", mobileOnly && "celebration-layer-mobile")} aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="celebration-piece"
          data-hue={piece.hue}
          style={{
            left: `${piece.left}%`,
            top: `${piece.top}%`,
            transform: `rotate(${piece.rotate}deg)`,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            ["--confetti-x" as "--confetti-x"]: piece.drift,
            ["--confetti-y" as "--confetti-y"]: piece.drop,
            ["--confetti-rotate" as "--confetti-rotate"]: piece.spin,
            ["--confetti-scale" as "--confetti-scale"]: piece.scale,
          }}
        />
      ))}
      {label && <span className="celebration-label">{label}</span>}
    </div>
  )
}
