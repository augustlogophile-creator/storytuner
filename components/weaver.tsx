"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import { useApp, weaverColors } from "@/lib/app-state"

export function Weaver({
  className,
  size = 84,
  framed = false,
  colorId,
}: {
  className?: string
  size?: number
  framed?: boolean
  colorId?: string
}) {
  const { state } = useApp()
  const color = weaverColors.find((item) => item.id === (colorId ?? state.activeWeaver)) ?? weaverColors[0]

  return (
    <span
      className={cn(
        "relative isolate inline-flex shrink-0 items-center justify-center overflow-visible",
        framed && "rounded-3xl border border-border bg-card",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={`Weaver in ${color.name}`}
    >
      <Image
        src={color.image}
        alt={`Weaver in ${color.name}`}
        width={size}
        height={size}
        className="h-full w-full object-contain drop-shadow-sm"
        priority={false}
      />
    </span>
  )
}
