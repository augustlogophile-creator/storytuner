import { cn } from "@/lib/utils"

export function ProgressBar({
  value,
  className,
  barClassName,
  variant = "solid",
}: {
  /** 0 - 100 */
  value: number
  className?: string
  barClassName?: string
  variant?: "solid" | "sketch"
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-muted",
        variant === "sketch" && "progress-bar-sketch",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-brand transition-[width] duration-500",
          variant === "sketch" && "progress-bar-sketch-fill",
          barClassName,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
