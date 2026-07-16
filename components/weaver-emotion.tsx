import Image from "next/image"

export type WeaverEmotionName = "welcome" | "excited" | "thinking" | "celebrate" | "reassure"

const labels: Record<WeaverEmotionName, string> = {
  welcome: "Weaver smiling",
  excited: "Weaver excited",
  thinking: "Weaver thinking",
  celebrate: "Weaver celebrating",
  reassure: "Weaver looking reassuring",
}

export function WeaverEmotion({ emotion, size = 180, className = "" }: { emotion: WeaverEmotionName; size?: number; className?: string }) {
  return (
    <Image
      src={`/weaver-${emotion}.png`}
      alt={labels[emotion]}
      width={size}
      height={size}
      priority
      className={`h-auto w-auto object-contain drop-shadow-[0_16px_22px_rgba(32,27,24,0.12)] ${className}`}
    />
  )
}
