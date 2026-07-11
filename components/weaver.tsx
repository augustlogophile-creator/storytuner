"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import { useApp, weaverColors } from "@/lib/app-state"

export function Weaver({ className, size = 84, framed = false, colorId }: { className?: string; size?: number; framed?: boolean; colorId?: string }) {
  const { state } = useApp()
  const color = weaverColors.find((item) => item.id === (colorId ?? state.activeWeaver)) ?? weaverColors[0]
  const tinted = Boolean(color.overlay)

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
        src="/weaver.png"
        alt="Weaver, the StoryTuner spider"
        width={size}
        height={size}
        className="h-full w-full object-contain drop-shadow-sm"
        style={tinted ? { filter: "grayscale(1) brightness(.58) contrast(1.34)" } : undefined}
        priority={false}
      />
      {color.overlay && (
        <span
          className="pointer-events-none absolute inset-0 opacity-95 mix-blend-screen"
          style={{
            background: color.overlay,
            WebkitMaskImage: "url('/weaver.png')",
            maskImage: "url('/weaver.png')",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
      )}
      {color.overlay && (
        <span
          className="pointer-events-none absolute inset-0 opacity-35 mix-blend-color"
          style={{
            background: color.overlay,
            WebkitMaskImage: "url('/weaver.png')",
            maskImage: "url('/weaver.png')",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
      )}
    </span>
  )
}
