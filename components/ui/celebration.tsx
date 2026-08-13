"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const pieces = [
  [8, 18, -12], [16, 34, 7], [24, 12, 16], [31, 44, -5], [39, 22, 12], [47, 9, -10],
  [55, 35, 5], [63, 15, 15], [72, 40, -8], [80, 20, 8], [88, 33, -15], [94, 12, 4],
  [13, 54, 12], [28, 63, -8], [43, 52, 6], [59, 68, -14], [74, 57, 11], [90, 65, -4],
] as const

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

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }
    setVisible(true)
    const timeout = window.setTimeout(() => {
      setVisible(false)
      onDone?.()
    }, 1500)
    return () => window.clearTimeout(timeout)
  }, [active, onDone])

  if (!visible) return null

  return (
    <div className={cn("celebration-layer", mobileOnly && "celebration-layer-mobile")} aria-hidden="true">
      {pieces.map(([left, top, rotate], index) => (
        <span
          key={`${left}-${top}`}
          className="celebration-piece"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            transform: `rotate(${rotate}deg)`,
            animationDelay: `${index * 24}ms`,
          }}
        />
      ))}
      {label && <span className="celebration-label">{label}</span>}
    </div>
  )
}
