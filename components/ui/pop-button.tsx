"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type Tone = "ink" | "paper" | "blue"
type SizeVariant = "sm" | "default" | "lg"

export interface PopButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone
  size?: SizeVariant
  children: React.ReactNode
}

const PopButton = React.forwardRef<HTMLButtonElement, PopButtonProps>(
  ({ className, tone = "ink", size = "default", children, ...props }, ref) => {
    const tones: Record<Tone, string> = {
      ink: "bg-[#2f2b26] hover:bg-[#25211d] border-[#171411] text-[#fffdf8]",
      paper: "bg-[#fffdf8] hover:bg-[#f8f3e9] border-[#b9aa97] text-[#2f2b26]",
      blue: "bg-[#527bad] hover:bg-[#466f9f] border-[#294e78] text-white",
    }

    const sizes: Record<SizeVariant, string> = {
      sm: "h-10 px-4 text-sm",
      default: "h-12 px-5 text-[0.9rem]",
      lg: "h-14 px-7 text-[1rem]",
    }

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[1rem] border-x border-t border-b-[4px] font-semibold transition-[transform,background-color,border-color,filter] duration-150 origin-bottom focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b86a4]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8f2] active:translate-y-[2px] active:scale-[0.992] active:border-b-2 disabled:pointer-events-none disabled:opacity-50",
          tones[tone],
          sizes[size],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  },
)

PopButton.displayName = "PopButton"

export { PopButton }
