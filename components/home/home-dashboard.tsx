"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, Check, Flame, Mic2, Shuffle } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { ProgressBar } from "@/components/progress-bar"
import { AccountRestoredNotice } from "@/components/moderation/account-restored-notice"
import { CountUp } from "@/components/ui/count-up"
import { Celebration } from "@/components/ui/celebration"
import { TypewriterText } from "@/components/ui/typewriter-text"
import { courseProgress, freeLessonLimitReached, nextLesson, useApp } from "@/lib/app-state"
import { stageLabels } from "@/lib/curriculum"

export function HomeDashboard({ accountNotice = null, accountNoticeUpdatedAt = null }: { accountNotice?: string | null; accountNoticeUpdatedAt?: string | null }) {
  const { state, ready } = useApp()
  const [celebrateStreak, setCelebrateStreak] = useState(false)
  const progress = courseProgress(state)
  const next = nextLesson(state)
  const freeLimitReached = freeLessonLimitReached(state) && progress.done < progress.total
  const week = getCurrentWeek(state.activityDates)

  useEffect(() => {
    if (!ready || state.streak < 1 || !state.activityDates.includes(localDateKey(new Date()))) return
    const key = `storytuner:streak-celebrated:${localDateKey(new Date())}:${state.streak}`
    try {
      if (window.localStorage.getItem(key)) return
      window.localStorage.setItem(key, "1")
      const timeout = window.setTimeout(() => setCelebrateStreak(true), 380)
      return () => window.clearTimeout(timeout)
    } catch {
      return
    }
  }, [ready, state.activityDates, state.streak])

  if (!ready) return null

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

  const courseHref = next ? `/activities/${next.unit.id}` : freeLimitReached ? "/membership" : "/activities"
  const courseAction = next ? "Continue learning" : freeLimitReached ? "Unlock lessons" : "Review course"
  const activeDays = week.filter((day) => day.active).length

  return (
    <div className="flex flex-col gap-3">
      <Celebration active={celebrateStreak} label={`${state.streak} day streak`} onDone={() => setCelebrateStreak(false)} />
      {accountNotice && <AccountRestoredNotice message={accountNotice} updatedAt={accountNoticeUpdatedAt} />}

      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow className="text-[0.6rem] tracking-[0.2em]">{today()}</Eyebrow>
          <h1 className="mt-1.5 text-[1.55rem] font-semibold leading-[1.1] tracking-[-0.038em] text-balance">
            {greeting()},<br />{state.profile.name}.
          </h1>
          <p className="mt-1.5 max-w-[18rem] text-[0.72rem] leading-[1.42] text-muted-foreground text-pretty">
            Learn one idea, then test it in a story of your own.
          </p>
        </div>

        <div className="flex w-[3.65rem] shrink-0 flex-col items-center rounded-[1.3rem] bg-streak-soft/75 px-2 py-2">
          <Flame className="h-[1.05rem] w-[1.05rem] text-streak" strokeWidth={2.1} />
          <CountUp value={state.streak} className="mt-0.5 text-[1.2rem] font-semibold leading-none text-foreground" />
          <span className="mt-1 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">days</span>
        </div>
      </header>

      <section className="rounded-[1.65rem] bg-[#2b2823] px-4 py-3.5 text-[#f8f7f2] shadow-[0_10px_30px_rgba(31,27,23,0.08)]">
        <div className="flex items-center justify-between gap-3 font-mono text-[0.57rem] uppercase tracking-[0.15em] text-[#aaa49c]">
          <span>{progress.percent}% through the course</span>
          {next && <span>Unit {next.unit.index}</span>}
        </div>
        <h2 className="mt-2.5 text-[1.12rem] font-semibold leading-tight tracking-[-0.025em] text-balance">
          {courseTitle}
        </h2>
        <p className="mt-1 text-[0.69rem] leading-relaxed text-[#bdb7af] text-pretty">{courseSubtitle}</p>

        <div className="mt-2.5">
          <ProgressBar value={progress.percent} className="h-1.5 bg-white/15 [&>div]:bg-white/65" />
        </div>

        <Link
          href={courseHref}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-[0.76rem] font-semibold text-brand-foreground shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]"
        >
          {courseAction}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-[0.95rem] font-semibold tracking-[-0.015em]">Practice</h2>
          <Link href="/arena/recordings" className="text-[0.7rem] font-semibold text-brand hover:underline">Past recordings</Link>
        </div>

        <div className="story-card mb-2 min-h-[6.5rem] rounded-[1.4rem] px-3.5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[0.78rem] font-semibold">This week</p>
              <p className="mt-0.5 text-[0.64rem] text-muted-foreground">Keep the habit moving.</p>
            </div>
            <p className="text-[0.68rem] text-muted-foreground"><CountUp value={activeDays} /> of 7 days</p>
          </div>
          <ul className="mt-3 flex items-center justify-between gap-1.5">
            {week.map((day) => (
              <li key={day.key} className="flex flex-1 justify-center">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-[0.61rem] font-medium ${day.active ? "border-transparent bg-foreground text-background" : day.today ? "border-dashed border-foreground/45 bg-card text-foreground" : "border-border bg-card text-muted-foreground"}`}>
                  {day.active ? <Check className="h-3 w-3" strokeWidth={2.6} /> : day.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <PracticeCard
            href="/arena?mode=free"
            icon={<Mic2 className="h-4 w-4" strokeWidth={2} />}
            title="Tell your own story"
            description="No prompt. Choose any moment you want to tell."
          />
          <PracticeCard
            href="/arena?mode=scenario"
            icon={<Shuffle className="h-4 w-4" strokeWidth={2} />}
            title="Choose a scenario"
            description="Practice an interview, personal question, or real situation."
          />
        </div>

        <div className="flex h-[3.6rem] items-center justify-center overflow-hidden px-1 text-center">
          <TypewriterText className="block w-full whitespace-nowrap text-[0.58rem] leading-none text-[#164f8d] sm:text-[0.62rem]" />
        </div>
      </section>
    </div>
  )
}

function PracticeCard({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link href={href} className="story-card story-card-interactive flex min-h-[7.35rem] flex-col rounded-[1.4rem] p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground">{icon}</span>
      <div className="mt-3">
        <p className="text-[0.79rem] font-semibold leading-snug tracking-[-0.015em]">{title}</p>
        <p className="mt-1 text-[0.62rem] leading-[1.42] text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="mt-auto ml-auto h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
    </Link>
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
