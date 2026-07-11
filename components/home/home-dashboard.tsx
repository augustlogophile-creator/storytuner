"use client"

import Link from "next/link"
import { ArrowRight, Check, Flame, Mic2, Play, ShoppingBag, Sparkles } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { ProgressBar } from "@/components/progress-bar"
import { courseProgress, levelForXp, nextLesson, useApp, weaverColors } from "@/lib/app-state"
import { stageLabels } from "@/lib/curriculum"

export function HomeDashboard() {
  const { state, ready } = useApp()
  const progress = courseProgress(state)
  const next = nextLesson(state)
  const level = levelForXp(state.xpLifetime)
  const activeColor = weaverColors.find((item) => item.id === state.activeWeaver) ?? weaverColors[0]
  const week = getCurrentWeek(state.activityDates)

  if (!ready) return <HomeSkeleton />

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>{today()}</Eyebrow>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">
            {greeting()}, {state.profile.name}.
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
            Build one part of a story today, then test it out loud.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center rounded-2xl bg-streak-soft px-3 py-2">
          <Flame className="h-5 w-5 text-streak" strokeWidth={2.2} />
          <span className="mt-0.5 text-lg font-semibold leading-none text-foreground">{state.streak}</span>
          <span className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">days</span>
        </div>
      </header>

      <section className="rounded-3xl bg-primary p-5 text-primary-foreground">
        <div className="flex items-center justify-between">
          <Eyebrow className="text-primary-foreground/60">
            {next ? "Continue where you left off" : "Course complete"}
          </Eyebrow>
          <span className="font-mono text-[0.7rem] text-primary-foreground/60">
            {next ? `Unit ${next.unit.index}` : "15 of 15"}
          </span>
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-balance">
          {next ? next.unit.title : "Your full storytelling path is complete"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-primary-foreground/70 text-pretty">
          {next ? `${stageLabels[next.stage]} · ${next.unit.skill}` : "Return to any unit, or record a complete story in the Arena."}
        </p>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-primary-foreground/60">
            <span>Course progress</span>
            <span>{progress.percent}%</span>
          </div>
          <ProgressBar value={progress.percent} className="bg-primary-foreground/15" barClassName="bg-brand" />
        </div>
        <Link href={next ? `/lesson/${next.id}` : "/arena"} className="mt-5 flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-transform active:scale-[0.98]">
          {next ? <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} /> : <Mic2 className="h-4 w-4" />}
          {next ? `Continue ${stageLabels[next.stage].toLowerCase()}` : "Tell a complete story"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft">
              <Sparkles className="h-5 w-5 text-accent-foreground" strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Level {level.level} · {level.title}</p>
              <p className="text-xs text-muted-foreground">{state.xpLifetime.toLocaleString()} XP earned</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">{state.xpBalance}</p>
            <p className="font-mono text-[0.58rem] uppercase tracking-wider text-muted-foreground">to spend</p>
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar value={(level.into / level.needed) * 100} />
          <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{level.needed - level.into} XP</span> to Level {level.level + 1}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-foreground">This week</p>
          <p className="text-xs text-muted-foreground">{week.filter((day) => day.active).length} of 7 days</p>
        </div>
        <ul className="mt-4 flex items-center justify-between">
          {week.map((day) => (
            <li key={day.key} className="flex flex-col items-center gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-medium ${day.active ? "border-transparent bg-brand text-brand-foreground" : day.today ? "border-dashed border-brand text-brand" : "border-border text-muted-foreground"}`}>
                {day.active ? <Check className="h-4 w-4" strokeWidth={2.6} /> : day.label}
              </span>
              <span className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">{day.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <Link href="/shop" className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-brand/50">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary">
          <ShoppingBag className="h-5 w-5 text-foreground" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <Eyebrow>Weaver shop</Eyebrow>
          <p className="mt-1 text-sm font-semibold text-foreground">Current color: {activeColor.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">Use XP to unlock a different Weaver palette.</p>
        </div>
        <Chevron />
      </Link>

      <Link href="/arena" className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-brand/50">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary">
          <Mic2 className="h-5 w-5 text-foreground" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <Eyebrow>Arena</Eyebrow>
          <p className="mt-1 text-sm font-semibold text-foreground">Record a real take</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">Private by default, with feedback after you finish.</p>
        </div>
        <Chevron />
      </Link>
    </div>
  )
}

function Chevron() {
  return <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
}

function HomeSkeleton() {
  return <div className="flex flex-col gap-5"><div className="h-20 animate-pulse rounded-3xl bg-secondary" /><div className="h-64 animate-pulse rounded-3xl bg-secondary" /><div className="h-32 animate-pulse rounded-3xl bg-secondary" /></div>
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

function today() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
}

function getCurrentWeek(activityDates: string[]) {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(now.getDate() - day + 1)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    const key = localDateKey(date)
    return { key, label: ["M", "T", "W", "T", "F", "S", "S"][index], active: activityDates.includes(key), today: key === localDateKey(now) }
  })
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
