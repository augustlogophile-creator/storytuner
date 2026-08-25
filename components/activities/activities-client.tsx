"use client"

import Link from "next/link"
import { Check, ChevronRight, ClipboardCheck, Lock } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { ProgressBar } from "@/components/progress-bar"
import {
  courseProgress,
  FREE_UNIT_LIMIT,
  hasUnitPlanAccess,
  isCheckpointComplete,
  isCheckpointUnlocked,
  isUnitUnlocked,
  unitProgress,
  useApp,
} from "@/lib/app-state"
import { getCheckpointAfterUnit, type Checkpoint } from "@/lib/checkpoints"
import { curriculum } from "@/lib/curriculum"
import { cn } from "@/lib/utils"

export function ActivitiesClient() {
  const { state, ready } = useApp()
  const course = courseProgress(state)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="min-w-0">
        <Eyebrow>Curriculum</Eyebrow>
        <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-balance">The craft of true storytelling</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
          Fifteen lessons on the craft of true storytelling.
        </p>
      </header>

      <section className="min-w-0 rounded-3xl border border-border bg-card p-5">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-3 text-sm">
          <span className="font-medium text-foreground">Your journey</span>
          <span className="shrink-0 text-muted-foreground">{course.done} of {course.total} lessons</span>
        </div>
        <ProgressBar value={course.percent}  />
        {!state.premium && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            The first {FREE_UNIT_LIMIT} lessons are free.
          </p>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        {curriculum.flatMap((unit) => {
          const planAccess = hasUnitPlanAccess(state, unit.index)
          const unlocked = isUnitUnlocked(state, unit.index)
          const progress = unitProgress(state, unit.id)
          const complete = progress.done === progress.total
          const content = (
            <article className={cn("group flex min-w-0 flex-col gap-4 rounded-3xl border bg-card p-5 transition-colors", unlocked ? "border-border hover:border-brand/50" : "border-border/70 opacity-75")}>
              <div className="flex min-w-0 items-start gap-4">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-mono text-sm font-semibold", complete ? "bg-brand text-brand-foreground" : unlocked ? "bg-brand-soft text-accent-foreground" : "bg-secondary text-muted-foreground")}>
                  {complete ? <Check className="h-5 w-5" strokeWidth={2.6} /> : unit.index}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="min-w-0 truncate font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">{unit.kind === "capstone" ? "Capstone" : unit.skill}</p>
                    {!planAccess && <span className="shrink-0 rounded-full border border-[#a9cff7] bg-[#e6f2ff] px-2 py-1 text-[0.58rem] font-semibold text-[#155d9f]">Membership</span>}
                  </div>
                  <h2 className="mt-1 break-words text-base font-semibold text-foreground">{unit.title}</h2>
                  <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground text-pretty">{unit.description}</p>
                </div>
                {unlocked ? <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /> : <Lock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground"><span>{progress.done} / 3 steps</span><span>{progress.percent}%</span></div>
                <ProgressBar value={progress.percent}  />
              </div>
            </article>
          )

          const unitNode = !ready
            ? <div key={`unit-${unit.id}`}>{content}</div>
            : !planAccess
              ? <Link prefetch key={`unit-${unit.id}`} href="/membership?from=lessons">{content}</Link>
              : unlocked
                ? <Link prefetch key={`unit-${unit.id}`} href={`/activities/${unit.id}`}>{content}</Link>
                : <div key={`unit-${unit.id}`}>{content}</div>

          const checkpoint = getCheckpointAfterUnit(unit.index)
          if (!checkpoint) return [unitNode]
          return [unitNode, <div key={`checkpoint-${checkpoint.id}`}><CheckpointCard checkpoint={checkpoint} /></div>]
        })}
      </div>
    </div>
  )
}

function CheckpointCard({ checkpoint }: { checkpoint: Checkpoint }) {
  const { state, ready } = useApp()
  const complete = isCheckpointComplete(state, checkpoint.id)
  const unlocked = isCheckpointUnlocked(state, checkpoint)
  const score = state.quizScores[checkpoint.id]
  const planAccess = hasUnitPlanAccess(state, checkpoint.afterUnit)
  const isFoundations = checkpoint.id === "foundations-check"

  const card = (
    <article className={cn(
      "checkpoint-list-card group relative overflow-hidden rounded-[1.55rem] border px-4 py-3.5 transition-all",
      unlocked || complete
        ? isFoundations
          ? "border-[#c9b8e5] bg-[#f8f4fc] hover:-translate-y-px hover:border-[#a991cf] hover:shadow-[0_8px_22px_rgba(90,65,130,.07)]"
          : "border-[#e7c977] bg-[#fffaf0] hover:-translate-y-px hover:border-[#d9b95f] hover:shadow-[0_8px_22px_rgba(112,82,32,.07)]"
        : "border-border/70 bg-card opacity-70",
    )}>
      <div className="relative flex min-w-0 items-center gap-3">
        <span className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem]",
          complete
            ? isFoundations
              ? "bg-[#8b6fb2] text-white"
              : "bg-brand text-brand-foreground"
            : unlocked
              ? (isFoundations ? "bg-[#eee6f8] text-[#6f5599]" : "bg-[#fff0c7] text-[#956119]")
              : "bg-secondary text-muted-foreground",
        )}>
          {complete ? <Check className="h-4.5 w-4.5" strokeWidth={2.6} /> : unlocked ? <ClipboardCheck className="h-4.5 w-4.5" /> : <Lock className="h-4 w-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "checkpoint-list-badge rounded-full px-2 py-0.5 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.15em]",
              unlocked || complete ? (isFoundations ? "bg-[#eee6f8] text-[#6f5599]" : "bg-[#fff0c7] text-[#956119]") : "bg-secondary text-muted-foreground",
            )}>Unit test</span>
            <span className="font-mono text-[0.57rem] uppercase tracking-[0.14em] text-muted-foreground">{checkpoint.subtitle}</span>
          </div>
          <h2 className="mt-1 text-[0.98rem] font-semibold leading-snug text-foreground">{checkpoint.title}</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{checkpoint.questions.length} questions · 1 challenge · ~{checkpoint.estimatedMinutes} min</p>
        </div>

        <div className="shrink-0 text-right">
          {complete && typeof score === "number" ? (
            <>
              <p className="text-sm font-semibold text-foreground">{score}%</p>
              <p className="mt-0.5 text-[0.6rem] text-muted-foreground">Passed</p>
            </>
          ) : unlocked ? (
            <>
              <p className={cn("text-xs font-semibold", isFoundations ? "text-[#6f5599]" : "text-[#956119]")}>+{checkpoint.xp} XP</p>
              <p className="mt-0.5 text-[0.6rem] text-muted-foreground">50% to pass</p>
            </>
          ) : (
            <Lock className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {(unlocked || complete) && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
      </div>
    </article>
  )

  if (!ready) return <div>{card}</div>
  if (!planAccess) return <Link prefetch href="/membership?from=lessons">{card}</Link>
  if (unlocked || complete) return <Link prefetch href={`/test/${checkpoint.id}`}>{card}</Link>
  return <div>{card}</div>
}
