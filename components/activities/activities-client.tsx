"use client"

import type { CSSProperties } from "react"
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
    <div className="flex min-w-0 flex-col gap-3.5">
      <header className="rise-in min-w-0" style={rise(0)}>
        <Eyebrow>Curriculum</Eyebrow>
        <h1 className="text-title mt-2.5 max-w-[22rem] break-words text-[1.78rem] leading-[1.02] text-balance">The craft of true storytelling</h1>
        <p className="mt-2.5 max-w-[23rem] text-[0.86rem] leading-6 text-muted-foreground text-pretty">
          Fourteen focused units and a capstone, carrying you from choosing a story to telling it with confidence.
        </p>
      </header>

      <section className="rise-in min-w-0 rounded-[1.35rem] border border-border bg-card p-4" style={rise(1)}>
        <div className="mb-2 flex min-w-0 items-center justify-between gap-3 text-[0.8rem]">
          <span className="font-semibold text-foreground">Your journey</span>
          <span className="shrink-0 text-muted-foreground">{course.done} of {course.total} steps</span>
        </div>
        <ProgressBar value={course.percent} />
        {!state.premium && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Your free plan includes the first {FREE_UNIT_LIMIT} complete lessons, each with Learn, Check, and Practice.
          </p>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        {curriculum.map((unit, index) => {
          const planAccess = hasUnitPlanAccess(state, unit.index)
          const unlocked = isUnitUnlocked(state, unit.index)
          const progress = unitProgress(state, unit.id)
          const complete = progress.done === progress.total
          const content = (
            <article className={cn("group flex min-w-0 flex-col gap-3 rounded-[1.35rem] border bg-card p-4 transition-all duration-200", unlocked ? "app-surface press border-border hover:border-brand/50" : "border-border/70 opacity-75")}> 
              <div className="flex min-w-0 items-start gap-3">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-sans text-xs font-medium transition-colors", complete ? "bg-brand text-brand-foreground" : unlocked ? "bg-brand-soft text-accent-foreground" : "bg-secondary text-muted-foreground")}> 
                  {complete ? <Check className="h-5 w-5" strokeWidth={2.6} /> : unit.index}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="min-w-0 truncate font-mono text-[0.58rem] uppercase tracking-[0.13em] text-muted-foreground">{unit.kind === "capstone" ? "Capstone" : unit.skill}</p>
                    {!planAccess && <span className="shrink-0 rounded-full bg-brand-soft px-2 py-1 text-[0.58rem] font-semibold text-accent-foreground">Membership</span>}
                  </div>
                  <h2 className="text-title mt-1.5 break-words text-[1.08rem] text-foreground">{unit.title}</h2>
                  <p className="mt-1.5 break-words text-[0.82rem] leading-[1.55] text-muted-foreground text-pretty">{unit.description}</p>
                </div>
                {unlocked ? <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /> : <Lock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground"><span>{progress.done} / 3 steps</span><span>{progress.percent}%</span></div>
                <ProgressBar value={progress.percent} />
              </div>
            </article>
          )

          const wrapperStyle = rise(index + 2)
          if (!ready) return <div key={unit.id} className="rise-in" style={wrapperStyle}>{content}</div>
          if (!planAccess) return <Link key={unit.id} href="/membership" className="rise-in" style={wrapperStyle}>{content}</Link>
          return unlocked ? <Link key={unit.id} href={`/activities/${unit.id}`} className="rise-in" style={wrapperStyle}>{content}</Link> : <div key={unit.id} className="rise-in" style={wrapperStyle}>{content}</div>
        })}
      </div>

      {!state.premium && (
        <Link href="/membership" className="app-surface press flex min-w-0 items-center gap-3 rounded-[1.35rem] border border-brand/20 bg-brand-soft/55 p-4">
          <Sparkles className="h-5 w-5 shrink-0 text-accent-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Open the remaining ten lessons</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Founding members join for $11.99 a year.</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>
      )}
    </div>
  )
}

function rise(index: number) {
  return { "--rise-delay": `${index * 38}ms` } as CSSProperties
}
