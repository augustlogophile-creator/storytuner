"use client"

import Link from "next/link"
import { Check, ChevronRight, Lock, Sparkles } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { ProgressBar } from "@/components/progress-bar"
import { courseProgress, FREE_UNIT_LIMIT, hasUnitPlanAccess, isUnitUnlocked, unitProgress, useApp } from "@/lib/app-state"
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
          Fourteen focused units and a capstone, moving from story selection to confident delivery.
        </p>
      </header>

      <section className="min-w-0 rounded-3xl border border-border bg-card p-5">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-3 text-sm">
          <span className="font-medium text-foreground">Your journey</span>
          <span className="shrink-0 text-muted-foreground">{course.done} of {course.total} steps</span>
        </div>
        <ProgressBar value={course.percent} />
        {!state.premium && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            The free plan includes the first {FREE_UNIT_LIMIT} complete lessons. Each one includes Learn, Check, and Practice.
          </p>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        {curriculum.map((unit) => {
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
                    {!planAccess && <span className="shrink-0 rounded-full bg-brand-soft px-2 py-1 text-[0.58rem] font-semibold text-accent-foreground">Membership</span>}
                  </div>
                  <h2 className="mt-1 break-words text-base font-semibold text-foreground">{unit.title}</h2>
                  <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground text-pretty">{unit.description}</p>
                </div>
                {unlocked ? <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /> : <Lock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground"><span>{progress.done} / 3 steps</span><span>{progress.percent}%</span></div>
                <ProgressBar value={progress.percent} />
              </div>
            </article>
          )

          if (!ready) return <div key={unit.id}>{content}</div>
          if (!planAccess) return <Link key={unit.id} href="/membership">{content}</Link>
          return unlocked ? <Link key={unit.id} href={`/activities/${unit.id}`}>{content}</Link> : <div key={unit.id}>{content}</div>
        })}
      </div>

      {!state.premium && (
        <Link href="/membership" className="flex min-w-0 items-center gap-3 rounded-3xl border border-brand/30 bg-brand-soft/35 p-5">
          <Sparkles className="h-5 w-5 shrink-0 text-accent-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Unlock the remaining ten lessons</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Founding waitlist members can join for $11.99 a year.</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>
      )}
    </div>
  )
}
