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
        "font-sans text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/75",
        className,
      )}
    >
      {children}
    </p>
  )
}
