"use client"

import { Weaver } from "@/components/weaver"

export type WeaverEmotionName = "welcome" | "excited" | "thinking" | "celebrate" | "reassure"

/**
 * Legacy compatibility wrapper. The introduction now uses one classic Weaver
 * everywhere, so every former emotion name resolves to the same mascot.
 */
export function WeaverEmotion({ size = 180, className = "" }: { emotion: WeaverEmotionName; size?: number; className?: string }) {
  return <Weaver colorId="classic" size={size} className={className} />
}
