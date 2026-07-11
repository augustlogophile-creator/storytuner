import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Small uppercase monospace label used above sections. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  )
}
