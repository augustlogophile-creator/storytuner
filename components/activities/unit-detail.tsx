"use client"

import Link from "next/link"
import { BookOpen, Check, ChevronRight, FilePenLine, Lock, ListChecks } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { ProgressBar } from "@/components/progress-bar"
import { hasUnitPlanAccess, isUnitUnlocked, unitProgress, useApp } from "@/lib/app-state"
import { lessonId, stageLabels, stageOrder, type CurriculumUnit, type LessonStage } from "@/lib/curriculum"
import { cn } from "@/lib/utils"

const stageMeta: Record<LessonStage, { detail: string; icon: typeof BookOpen }> = {
  read: { detail: "Read the complete concept, examples, and breakdown.", icon: BookOpen },
  drill: { detail: "Apply the idea to a story of your own after the check.", icon: FilePenLine },
  quiz: { detail: "Check your understanding before you practice.", icon: ListChecks },
}

export function UnitDetail({ unit }: { unit: CurriculumUnit }) {
  const { state } = useApp()
  const progress = unitProgress(state, unit.id)
  const planAccess = hasUnitPlanAccess(state, unit.index)
  const unitUnlocked = isUnitUnlocked(state, unit.index)
  const stages = stageOrder

  if (!planAccess) {
    return (
      <div className="flex min-w-0 flex-col gap-5">
        <BackLink href="/activities" label="Curriculum" />
        <section className="rounded-3xl border border-brand/30 bg-brand-soft/35 px-6 py-10 text-center">
          <Lock className="mx-auto h-8 w-8 text-accent-foreground" />
          <h1 className="mt-4 text-xl font-semibold">This lesson is part of Membership.</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">The free plan includes the first five complete lessons. Membership unlocks all fifteen.</p>
          <Link href="/membership" className="mt-5 flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground">See the founding offer<ChevronRight className="h-4 w-4" /></Link>
        </section>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BackLink href="/activities" label="Curriculum" />
      <header className="min-w-0">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">{unit.kind === "capstone" ? "Capstone" : `Unit ${unit.index} · ${unit.skill}`}</p>
        <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-balance">{unit.title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">{unit.description}</p>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground"><span>{progress.done} / 3 steps complete</span><span>{progress.percent}%</span></div>
          <ProgressBar value={progress.percent} />
        </div>
      </header>

      <ol className="flex flex-col gap-3">
        {stages.map((stage, index) => {
          const key = lessonId(unit.id, stage)
          const done = state.completed.includes(key)
          const priorDone = index === 0 || state.completed.includes(lessonId(unit.id, stages[index - 1]))
          const unlocked = unitUnlocked && priorDone
          const Icon = stageMeta[stage].icon
          const row = (
            <div className={cn("flex items-center gap-4 rounded-2xl border p-4 transition-colors", unlocked ? "border-border bg-card hover:border-brand/50" : "border-border/70 bg-card/60 opacity-75")}>
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", done ? "bg-brand text-brand-foreground" : unlocked ? "bg-brand-soft text-accent-foreground" : "bg-secondary text-muted-foreground")}>
                {done ? <Check className="h-4 w-4" strokeWidth={2.6} /> : unlocked ? <Icon className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">Step {index + 1}</p>
                <h2 className="mt-0.5 text-sm font-semibold text-foreground">{stageLabels[stage]}</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{stageMeta[stage].detail}</p>
              </div>
              {unlocked && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
            </div>
          )
          return <li key={stage}>{unlocked ? <Link href={`/lesson/${key}`}>{row}</Link> : row}</li>
        })}
      </ol>
    </div>
  )
}
