"use client"

import type { CSSProperties } from "react"
import Link from "next/link"
import { ArrowRight, Check, Flame, Map, MessageCircle, Mic2, Play, Shuffle } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { ProgressBar } from "@/components/progress-bar"
import { Weaver } from "@/components/weaver"
import { AccountRestoredNotice } from "@/components/moderation/account-restored-notice"
import { courseProgress, freeLessonLimitReached, nextLesson, useApp, weaverColors } from "@/lib/app-state"
import { stageLabels } from "@/lib/curriculum"

export function HomeDashboard({ accountNotice = null, accountNoticeUpdatedAt = null }: { accountNotice?: string | null; accountNoticeUpdatedAt?: string | null }) {
  const { state, ready } = useApp()
  const progress = courseProgress(state)
  const next = nextLesson(state)
  const freeLimitReached = freeLessonLimitReached(state) && progress.done < progress.total
  const activeColor = weaverColors.find((item) => item.id === state.activeWeaver) ?? weaverColors[0]
  const week = getCurrentWeek(state.activityDates)
  const latest = state.recordings[0]

  if (!ready) return <HomeSkeleton />

  return (
    <div className="flex flex-col gap-4">
      {accountNotice && <AccountRestoredNotice message={accountNotice} updatedAt={accountNoticeUpdatedAt} />}
      <header className="rise-in flex items-start justify-between gap-4" style={rise(0)}>
        <div className="min-w-0">
          <Eyebrow>{today()}</Eyebrow>
          <h1 className="text-title mt-2.5 text-[1.78rem] leading-[1.02] text-balance">
            {greeting()}, {state.profile.name}.
          </h1>
          <p className="mt-2.5 max-w-[22rem] text-[0.86rem] leading-6 text-muted-foreground text-pretty">
            One idea at a time. Learn it, then tell a story that makes it yours.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center rounded-[1rem] border border-border bg-card px-2.5 py-2.5">
          <Flame className="h-3.5 w-3.5 text-streak" strokeWidth={2.2} />
          <span className="mt-0.5 text-[0.95rem] font-medium leading-none text-foreground">{state.streak}</span>
          <span className="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-muted-foreground">days</span>
        </div>
      </header>

      <section className="rise-in relative overflow-hidden rounded-[1.4rem] bg-primary p-4.5 text-primary-foreground shadow-[0_20px_50px_-24px_color-mix(in_oklch,var(--primary)_80%,transparent)]" style={rise(1)}>
        <div className="hatch-texture pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow className="text-primary-foreground/55">
              {next ? `${progress.percent}% through the course` : freeLimitReached ? "Free lessons complete" : "Course complete"}
            </Eyebrow>
            <span className="font-mono text-[0.7rem] text-primary-foreground/55">
              {next ? `Unit ${next.unit.index}` : freeLimitReached ? "5 of 15" : "15 of 15"}
            </span>
          </div>
          <h2 className="text-title mt-3 text-[1.4rem] text-balance">
            {next ? next.unit.title : freeLimitReached ? "You've finished your five free lessons" : "Your full storytelling path is complete"}
          </h2>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-primary-foreground/70 text-pretty">
            {next ? `${stageLabels[next.stage]} · ${next.unit.skill}` : freeLimitReached ? "Founding Membership opens the remaining ten lessons." : "Revisit any lesson, or record a full story in the Arena."}
          </p>
          <div className="mt-4">
            <ProgressBar value={progress.percent} className="bg-primary-foreground/15" barClassName="bg-brand" />
          </div>
          <Link href={next ? `/lesson/${next.id}` : freeLimitReached ? "/membership" : "/activities"} className="press mt-5 flex items-center justify-center gap-2 rounded-full bg-background px-4 py-2.5 text-[0.78rem] font-medium text-foreground shadow-[0_10px_26px_rgb(0_0_0_/_0.14)] hover:brightness-105">
            <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} />
            {next ? "Pick up where you left off" : freeLimitReached ? "Unlock all 15 lessons" : "Review the course"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="rise-in" style={rise(2)}>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="section-editorial">Practice</h2>
          <Link href="/arena/recordings" className="text-xs font-semibold text-brand transition-colors hover:text-foreground">Past recordings</Link>
        </div>
        <Link href="/planner" className="app-surface press mb-2.5 flex items-center gap-3 rounded-[1.35rem] border border-brand/18 bg-brand-soft/75 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-brand"><Map className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-title text-[1.02rem]">Plan a story with Weaver</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Turn scattered ideas, key facts, and first-take nerves into a plan you can rehearse.</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/arena?mode=free" className="app-surface press rounded-[1.35rem] border border-border bg-card p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-brand-soft text-accent-foreground"><Mic2 className="h-4.5 w-4.5" /></span>
            <p className="text-title mt-3 text-[0.98rem]">Tell your own story</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">No prompt. Pick any moment worth telling.</p>
          </Link>
          <Link href="/arena?mode=scenario" className="app-surface press rounded-[1.35rem] border border-border bg-card p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-brand-soft text-accent-foreground"><Shuffle className="h-4.5 w-4.5" /></span>
            <p className="text-title mt-3 text-[0.98rem]">Try a scenario</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">An interview, a tough question, a real moment.</p>
          </Link>
        </div>
      </section>

      <section className="rise-in rounded-[1.35rem] border border-border bg-card p-4" style={rise(3)}>
        <div className="flex items-baseline justify-between">
          <p className="text-[0.78rem] font-medium tracking-tight text-foreground">This week</p>
          <p className="text-xs text-muted-foreground">{week.filter((day) => day.active).length} of 7 days</p>
        </div>
        <ul className="mt-4 flex items-center justify-between">
          {week.map((day) => (
            <li key={day.key} className="flex flex-col items-center gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${day.active ? "border-transparent bg-brand text-brand-foreground" : day.today ? "border-dashed border-brand text-brand" : "border-border text-muted-foreground"}`}>
                {day.active ? <Check className="h-4 w-4" strokeWidth={2.6} /> : day.label}
              </span>
              <span className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">{day.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <Link href="/shop" className="app-surface press rise-in flex items-center gap-3 rounded-[1.35rem] border border-border bg-card p-4" style={rise(4)}>
        <Weaver size={42} />
        <div className="min-w-0 flex-1">
          <Eyebrow>Weaver shop</Eyebrow>
          <p className="text-title mt-1 text-[0.98rem] text-foreground">Wearing {activeColor.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{state.xpBalance} XP ready to spend on a new palette.</p>
        </div>
        <Chevron />
      </Link>

      {latest && (
        <Link href={`/coach?recording=${latest.id}`} className="app-surface press rise-in flex items-center gap-3 rounded-[1.35rem] border border-border bg-card p-4" style={rise(5)}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-accent-foreground"><MessageCircle className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <Eyebrow>Recent feedback</Eyebrow>
            <p className="text-title mt-1 text-[0.98rem] text-foreground">What to work on now</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{latest.levelUp || latest.nextTake || latest.fix}</p>
          </div>
          <Chevron />
        </Link>
      )}

      <Link href="/coach" className="app-surface press rise-in flex items-center gap-3 rounded-[1.35rem] border border-border bg-card p-4" style={rise(6)}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-secondary"><MessageCircle className="h-4 w-4 text-foreground" /></span>
        <div className="min-w-0 flex-1">
          <Eyebrow>AI story coach</Eyebrow>
          <p className="text-title mt-1 text-[0.98rem] text-foreground">Ask Weaver</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">Find material, shape a story, sharpen your delivery, or figure out what to practice next.</p>
        </div>
        <Chevron />
      </Link>
    </div>
  )
}

function rise(index: number) {
  return { "--rise-delay": `${index * 42}ms` } as CSSProperties
}

function Chevron() { return <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /> }
function HomeSkeleton() { return <div className="flex flex-col gap-5"><div className="h-20 animate-pulse rounded-[1.4rem] bg-secondary" /><div className="h-64 animate-pulse rounded-[1.4rem] bg-secondary" /><div className="h-32 animate-pulse rounded-[1.4rem] bg-secondary" /></div> }
function greeting() { const hour = new Date().getHours(); if (hour < 12) return "Good morning"; if (hour < 18) return "Good afternoon"; return "Good evening" }
function today() { return new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) }
function getCurrentWeek(activityDates: string[]) { const now = new Date(); const day = now.getDay() || 7; const monday = new Date(now); monday.setHours(0,0,0,0); monday.setDate(now.getDate() - day + 1); return Array.from({ length: 7 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); const key = localDateKey(date); return { key, label: ["M","T","W","T","F","S","S"][index], active: activityDates.includes(key), today: key === localDateKey(now) } }) }
function localDateKey(date: Date) { const year=date.getFullYear(); const month=String(date.getMonth()+1).padStart(2,"0"); const day=String(date.getDate()).padStart(2,"0"); return `${year}-${month}-${day}` }
