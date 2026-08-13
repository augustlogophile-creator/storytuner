"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const pieces = [
  [5, 10, -14], [10, 25, 8], [15, 42, 16], [20, 15, -7], [24, 33, 11], [28, 52, -12],
  [32, 8, 6], [36, 25, 15], [40, 45, -9], [44, 17, 10], [48, 37, -16], [52, 55, 5],
  [56, 11, 14], [60, 29, -8], [64, 48, 9], [68, 19, -13], [72, 39, 7], [76, 58, 16],
  [80, 12, -5], [84, 31, 12], [88, 50, -15], [92, 21, 6], [96, 41, 13], [8, 60, -10],
  [18, 68, 9], [30, 63, -6], [42, 71, 15], [54, 66, -12], [66, 73, 8], [78, 65, -9],
  [90, 71, 14], [12, 77, -5], [34, 80, 10], [58, 79, -14], [82, 82, 6], [96, 76, -8],
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
    }, 3000)
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
