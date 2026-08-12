"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, Check, Flame, Map, Mic2, Shuffle } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { ProgressBar } from "@/components/progress-bar"
import { AccountRestoredNotice } from "@/components/moderation/account-restored-notice"
import { courseProgress, freeLessonLimitReached, nextLesson, useApp } from "@/lib/app-state"
import { stageLabels } from "@/lib/curriculum"

export function HomeDashboard({ accountNotice = null, accountNoticeUpdatedAt = null }: { accountNotice?: string | null; accountNoticeUpdatedAt?: string | null }) {
  const { state, ready } = useApp()
  const progress = courseProgress(state)
  const next = nextLesson(state)
  const freeLimitReached = freeLessonLimitReached(state) && progress.done < progress.total
  const week = getCurrentWeek(state.activityDates)

  if (!ready) return <HomeSkeleton />

  const courseTitle = next
    ? next.unit.title
    : freeLimitReached
      ? "You finished your five free lessons"
      : "Your storytelling course is complete"

  const courseSubtitle = next
    ? `Unit ${next.unit.index} · ${stageLabels[next.stage]} · ${next.unit.skill}`
    : freeLimitReached
      ? "Founding Membership unlocks the remaining ten lessons."
      : "Review any lesson or record a complete story in the Arena."

  const courseHref = next ? `/lesson/${next.id}` : freeLimitReached ? "/membership" : "/activities"
  const courseAction = next ? "Continue learning" : freeLimitReached ? "Unlock lessons" : "Review course"

  return (
    <div className="flex flex-col gap-7">
      {accountNotice && <AccountRestoredNotice message={accountNotice} updatedAt={accountNoticeUpdatedAt} />}

      <header className="flex items-start justify-between gap-5">
        <div className="min-w-0 pt-1">
          <Eyebrow className="text-[0.68rem] tracking-[0.2em]">{today()}</Eyebrow>
          <h1 className="mt-3 text-[2rem] font-semibold leading-[1.16] tracking-[-0.035em] text-balance">
            {greeting()},<br />{state.profile.name}.
          </h1>
          <p className="mt-3 max-w-[19rem] text-[0.92rem] leading-relaxed text-muted-foreground text-pretty">
            Learn one idea, then test it in a story of your own.
          </p>
        </div>

        <div className="flex w-[4.7rem] shrink-0 flex-col items-center rounded-[1.7rem] bg-brand-soft/55 px-2 py-3.5">
          <Flame className="h-5 w-5 text-brand" strokeWidth={2.1} />
          <span className="mt-1 text-[1.55rem] font-semibold leading-none text-foreground">{state.streak}</span>
          <span className="mt-1.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">days</span>
        </div>
      </header>

      <section className="rounded-[1.9rem] border border-brand/10 bg-brand-soft/20 px-5 py-5 shadow-[0_10px_32px_rgba(22,74,130,0.035)]">
        <Eyebrow>Your course</Eyebrow>
        <h2 className="mt-3 text-[1.48rem] font-semibold leading-tight tracking-[-0.025em] text-balance">
          {courseTitle}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
          {courseSubtitle}
        </p>

        <div className="mt-5">
          <ProgressBar value={progress.percent} className="h-2 bg-foreground/[0.08]" />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
            {progress.percent}% complete
          </span>
          <Link
            href={courseHref}
            className="flex shrink-0 items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-transform active:scale-[0.98]"
          >
            {courseAction}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[1.05rem] font-semibold tracking-[-0.015em]">Practice</h2>

        <Link
          href="/planner"
          className="mb-3 flex min-h-[6.2rem] items-center gap-4 rounded-[1.8rem] border border-border bg-card px-4 py-4 transition-colors hover:border-brand/40"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft/65 text-brand">
            <Map className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.98rem] font-semibold tracking-[-0.015em]">Plan a story with Weaver</span>
            <span className="mt-1 block text-[0.78rem] leading-relaxed text-muted-foreground">
              Turn rough ideas into a clear rehearsal plan before you record.
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <PracticeCard
            href="/arena?mode=free"
            icon={<Mic2 className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} />}
            title="Tell your own story"
            description="No prompt. Choose any moment you want to tell."
          />
          <PracticeCard
            href="/arena?mode=scenario"
            icon={<Shuffle className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} />}
            title="Choose a scenario"
            description="Practice an interview, personal question, or real situation."
          />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[1.05rem] font-semibold tracking-[-0.015em]">This week</h2>
          <p className="text-sm text-muted-foreground">{week.filter((day) => day.active).length} of 7 days</p>
        </div>

        <ul className="mt-4 flex items-start justify-between gap-1">
          {week.map((day) => (
            <li key={day.key} className="flex flex-1 flex-col items-center gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-medium ${day.active ? "border-transparent bg-brand text-brand-foreground" : day.today ? "border-dashed border-brand text-brand" : "border-border bg-card text-muted-foreground"}`}>
                {day.active ? <Check className="h-4 w-4" strokeWidth={2.6} /> : day.label}
              </span>
              <span className="font-mono text-[0.58rem] uppercase tracking-wider text-muted-foreground">{day.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function PracticeCard({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[12.5rem] flex-col rounded-[1.8rem] border border-border bg-card p-4 transition-colors hover:border-brand/40"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft/65 text-brand">{icon}</span>
      <div className="mt-5">
        <p className="text-[0.98rem] font-semibold leading-snug tracking-[-0.015em]">{title}</p>
        <p className="mt-2 text-[0.78rem] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="mt-auto ml-auto h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
    </Link>
  )
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      <div className="h-28 animate-pulse rounded-[1.8rem] bg-secondary" />
      <div className="h-64 animate-pulse rounded-[1.9rem] bg-secondary" />
      <div className="h-80 animate-pulse rounded-[1.8rem] bg-secondary" />
    </div>
  )
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
    return {
      key,
      label: ["M", "T", "W", "T", "F", "S", "S"][index],
      active: activityDates.includes(key),
      today: key === localDateKey(now),
    }
  })
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
