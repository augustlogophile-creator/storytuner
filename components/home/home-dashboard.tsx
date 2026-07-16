"use client"

import Link from "next/link"
import { ArrowRight, Check, Flame, MessageCircle, Mic2, Play, Shuffle } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { ProgressBar } from "@/components/progress-bar"
import { Weaver } from "@/components/weaver"
import { courseProgress, freeLessonLimitReached, nextLesson, useApp, weaverColors } from "@/lib/app-state"
import { stageLabels } from "@/lib/curriculum"

export function HomeDashboard() {
  const { state, ready } = useApp()
  const progress = courseProgress(state)
  const next = nextLesson(state)
  const freeLimitReached = freeLessonLimitReached(state) && progress.done < progress.total
  const activeColor = weaverColors.find((item) => item.id === state.activeWeaver) ?? weaverColors[0]
  const week = getCurrentWeek(state.activityDates)
  const latest = state.recordings[0]

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
            Learn one idea, then test it in a story of your own.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center rounded-2xl bg-streak-soft px-3 py-2">
          <Flame className="h-5 w-5 text-streak" strokeWidth={2.2} />
          <span className="mt-0.5 text-lg font-semibold leading-none text-foreground">{state.streak}</span>
          <span className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">days</span>
        </div>
      </header>

      <section className="rounded-3xl bg-primary p-5 text-primary-foreground">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow className="text-primary-foreground/60">
            {next ? `${progress.percent}% through the course` : freeLimitReached ? "Free lessons complete" : "Course complete"}
          </Eyebrow>
          <span className="font-mono text-[0.7rem] text-primary-foreground/60">
            {next ? `Unit ${next.unit.index}` : freeLimitReached ? "5 of 15" : "15 of 15"}
          </span>
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-balance">
          {next ? next.unit.title : freeLimitReached ? "You finished your five free lessons" : "Your full storytelling path is complete"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-primary-foreground/70 text-pretty">
          {next ? `${stageLabels[next.stage]} · ${next.unit.skill}` : freeLimitReached ? "Founding Membership unlocks the remaining ten lessons." : "Review any lesson, or record a complete story in the Arena."}
        </p>
        <div className="mt-4">
          <ProgressBar value={progress.percent} className="bg-primary-foreground/15" barClassName="bg-brand" />
        </div>
        <Link href={next ? `/lesson/${next.id}` : freeLimitReached ? "/membership" : "/activities"} className="mt-5 flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-transform active:scale-[0.98]">
          <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} />
          {next ? "Continue learning" : freeLimitReached ? "Unlock all 15 lessons" : "Review the course"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Practice</h2>
          <Link href="/arena/recordings" className="text-xs font-semibold text-brand">Past recordings</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/arena?mode=free" className="rounded-3xl border border-border bg-card p-4 transition-colors hover:border-brand/50">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-soft text-accent-foreground"><Mic2 className="h-4.5 w-4.5" /></span>
            <p className="mt-3 text-sm font-semibold">Tell your own story</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">No prompt. Choose any moment you want to tell.</p>
          </Link>
          <Link href="/arena?mode=scenario" className="rounded-3xl border border-border bg-card p-4 transition-colors hover:border-brand/50">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-soft text-accent-foreground"><Shuffle className="h-4.5 w-4.5" /></span>
            <p className="mt-3 text-sm font-semibold">Choose a scenario</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Practice an interview, personal question, or real situation.</p>
          </Link>
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
        <Weaver size={52} />
        <div className="min-w-0 flex-1">
          <Eyebrow>Weaver shop</Eyebrow>
          <p className="mt-1 text-sm font-semibold text-foreground">Current color: {activeColor.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{state.xpBalance} XP available for a new palette.</p>
        </div>
        <Chevron />
      </Link>

      {latest && (
        <Link href={`/coach?recording=${latest.id}`} className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-brand/50">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-accent-foreground"><MessageCircle className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <Eyebrow>Recent feedback</Eyebrow>
            <p className="mt-1 text-sm font-semibold text-foreground">Your current focus</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{latest.levelUp || latest.nextTake || latest.fix}</p>
          </div>
          <Chevron />
        </Link>
      )}

      <Link href="/coach" className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-brand/50">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary"><MessageCircle className="h-5 w-5 text-foreground" /></span>
        <div className="min-w-0 flex-1">
          <Eyebrow>AI story coach</Eyebrow>
          <p className="mt-1 text-sm font-semibold text-foreground">Ask Weaver</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">Find material, shape a story, strengthen your delivery, or understand what to practice next.</p>
        </div>
        <Chevron />
      </Link>
    </div>
  )
}

function Chevron() { return <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" /> }
function HomeSkeleton() { return <div className="flex flex-col gap-5"><div className="h-20 animate-pulse rounded-3xl bg-secondary" /><div className="h-64 animate-pulse rounded-3xl bg-secondary" /><div className="h-32 animate-pulse rounded-3xl bg-secondary" /></div> }
function greeting() { const hour = new Date().getHours(); if (hour < 12) return "Good morning"; if (hour < 18) return "Good afternoon"; return "Good evening" }
function today() { return new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) }
function getCurrentWeek(activityDates: string[]) { const now = new Date(); const day = now.getDay() || 7; const monday = new Date(now); monday.setHours(0,0,0,0); monday.setDate(now.getDate() - day + 1); return Array.from({ length: 7 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); const key = localDateKey(date); return { key, label: ["M","T","W","T","F","S","S"][index], active: activityDates.includes(key), today: key === localDateKey(now) } }) }
function localDateKey(date: Date) { const year=date.getFullYear(); const month=String(date.getMonth()+1).padStart(2,"0"); const day=String(date.getDate()).padStart(2,"0"); return `${year}-${month}-${day}` }
