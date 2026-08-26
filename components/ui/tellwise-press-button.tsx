"use client"

import * as React from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TellwisePressButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  showArrow?: boolean
}

export const TellwisePressButton = React.forwardRef<HTMLButtonElement, TellwisePressButtonProps>(
  ({ className, children, showArrow = true, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn("tellwise-press-button", className)}
        {...props}
      >
        <span>{children}</span>
        {showArrow ? <ArrowRight aria-hidden="true" /> : null}
      </button>
    )
  },
)

TellwisePressButton.displayName = "TellwisePressButton"
