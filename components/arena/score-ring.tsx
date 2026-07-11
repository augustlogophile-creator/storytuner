export function ScoreRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  const r = 34
  const c = 2 * Math.PI * r
  const offset = c - (clamped / 100) * c

  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="7"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold leading-none text-foreground">{clamped}</span>
        <span className="font-mono text-[0.5rem] uppercase tracking-wider text-muted-foreground">
          score
        </span>
      </div>
    </div>
  )
}
