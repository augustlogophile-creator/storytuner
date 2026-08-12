import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Quiet uppercase label used above sections. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "font-sans text-[0.6rem] font-semibold uppercase tracking-[0.135em] text-muted-foreground/70",
        className,
      )}
    >
      {children}
    </p>
  )
}
