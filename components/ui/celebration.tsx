"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
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
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.body)
  }, [])

  const pieces = useMemo(() => {
    if (!active) return []
    return Array.from({ length: 40 }, (_, index) => ({
      id: `${index}-${Math.round(Math.random() * 10_000)}`,
      left: 2 + Math.random() * 96,
      top: -3 - Math.random() * 5,
      rotate: -40 + Math.random() * 80,
      drift: `${-34 + Math.random() * 68}px`,
      drop: `${102 + Math.random() * 18}svh`,
      spin: `${320 + Math.random() * 620}deg`,
      duration: `${2.75 + Math.random() * 0.85}s`,
      delay: `${index * 14 + Math.random() * 110}ms`,
      scale: `${0.78 + Math.random() * 0.62}`,
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
    }, 4000)
    return () => window.clearTimeout(timeout)
  }, [active, onDone])

  if (!visible || !portalTarget) return null

  return createPortal(
    <div className={cn("celebration-layer", "celebration-layer-mobile")} aria-hidden="true">
      {pieces.map((piece) => {
        const style: CSSProperties & Record<`--${string}`, string> = {
          left: `${piece.left}%`,
          top: `${piece.top}%`,
          transform: `rotate(${piece.rotate}deg)`,
          animationDelay: piece.delay,
          animationDuration: piece.duration,
          "--confetti-x": piece.drift,
          "--confetti-y": piece.drop,
          "--confetti-rotate": piece.spin,
          "--confetti-scale": piece.scale,
        }

        return (
          <span
            key={piece.id}
            className="celebration-piece"
            data-hue={piece.hue}
            style={style}
          />
        )
      })}
      {label && <span className="celebration-label">{label}</span>}
    </div>,
    portalTarget,
  )
}
