"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import { useApp, weaverColors } from "@/lib/app-state"

export function Weaver({ className, size = 84, framed = true }: { className?: string; size?: number; framed?: boolean }) {
  const { state } = useApp()
  const color = weaverColors.find((item) => item.id === state.activeWeaver) ?? weaverColors[0]
  return (
    <span
      className={cn(
        "relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden",
        framed && "rounded-3xl border border-border bg-white",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={`Weaver in ${color.name}`}
    >
      <Image
        src="/weaver.png"
        alt="Weaver, the StoryTuner spider"
        width={Math.round(size * 1.5)}
        height={Math.round(size * 1.2)}
        className="h-full w-full object-contain p-1"
        priority={false}
      />
      {color.overlay && <span className="pointer-events-none absolute inset-0 mix-blend-screen" style={{ backgroundColor: color.overlay }} />}
    </span>
  )
}
