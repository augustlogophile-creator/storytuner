"use client"

import {
  BookOpenCheck,
  Check,
  Ear,
  Footprints,
  HeartHandshake,
  House,
  Layers3,
  Mic2,
  Rocket,
  Shovel,
  Search,
  ShieldAlert,
  Smile,
  Trophy,
  Wrench,
  Users,
  Waypoints,
  type LucideIcon,
} from "lucide-react"
import { BackLink } from "@/components/page-header"
import { ProgressBar } from "@/components/progress-bar"
import { CountUp } from "@/components/ui/count-up"
import { courseProgress, unitProgress, useApp } from "@/lib/app-state"
import { curriculum } from "@/lib/curriculum"

const unitIcons: Record<number, LucideIcon> = {
  1: Layers3,
  2: Shovel,
  3: ShieldAlert,
  4: Waypoints,
  5: Footprints,
  6: Search,
  7: HeartHandshake,
  8: Smile,
  9: House,
  10: Rocket,
  11: Mic2,
  12: Users,
  13: Wrench,
  14: Ear,
  15: Trophy,
}

export function ProgressClient({ sharedStoryCount: _sharedStoryCount }: { sharedStoryCount: number | null }) {
  const { state } = useApp()
  const course = courseProgress(state)
  const scoredStories = state.recordings.filter((recording) => Number.isFinite(recording.overall) && recording.overall > 0)
  const averageStoryScore = scoredStories.length
    ? Math.round(scoredStories.reduce((sum, recording) => sum + recording.overall, 0) / scoredStories.length)
    : null
  const week = getCurrentWeek(state.activityDates)
  const derivedStreaks = calculateStreaks(state.activityDates)
  const streaks = { current: derivedStreaks.current, longest: Math.max(derivedStreaks.longest, state.longestStreak) }

  return <div className="progress-page flex flex-col gap-6">
    <BackLink href="/profile" label="Profile" />
    <header>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Progress</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Your work, accurately counted.</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">A simple view of your course progress, Studio work, and practice consistency.</p>
    </header>

    <section className="grid grid-cols-2 gap-3">
      <BigStat value={course.percent} label="Course complete" suffix="%" />
      <BigStat value={state.xpLifetime} label="Lifetime XP" />
      <BigStat value={state.recordings.length} label="Stories recorded" />
      <BigStat value={averageStoryScore} label="Average story score" suffix={averageStoryScore === null ? "" : "%"} />
    </section>

    <section className="progress-streak-card rounded-3xl border border-border bg-card p-5">
      <div>
        <p className="text-base font-semibold">Streak</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Keep the habit moving, one active day at a time.</p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-1.5">
        {week.map((day, index) => (
          <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className={`flex h-10 w-10 items-center justify-center rounded-full border text-xs font-medium ${day.active ? "border-brand/35 bg-brand-soft text-brand" : day.today ? "border-dashed border-foreground/45 bg-card text-foreground" : "border-border bg-card text-muted-foreground"}`}>
              {day.active ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : (index === 3 ? "T" : day.label)}
            </span>
          </div>
        ))}
      </div>

      <div className="progress-streak-summary mt-5 border-t border-border pt-4 text-center">
        <div>
          <p className="text-[1rem] font-semibold tabular-nums leading-none">{streaks.current}</p>
          <p className="mt-1 text-[0.62rem] text-muted-foreground">Current streak</p>
        </div>
        <div>
          <p className="text-[1rem] font-semibold tabular-nums leading-none">{streaks.longest}</p>
          <p className="mt-1 text-[0.62rem] text-muted-foreground">Longest streak</p>
        </div>
      </div>
    </section>

    <section>
      <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Unit completion</p>
      <div className="flex flex-col gap-3">
        {curriculum.map((unit) => {
          const progress = unitProgress(state, unit.id)
          const Icon = unitIcons[unit.index] ?? BookOpenCheck
          return <div key={unit.id} className="rounded-3xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${progress.done === 3 ? "bg-brand text-brand-foreground" : "bg-brand-soft text-accent-foreground"}`}>
                {progress.done === 3 ? <Check className="h-4.5 w-4.5" strokeWidth={2.6} /> : <Icon className="h-5 w-5" strokeWidth={1.9} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{unit.index}. {unit.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{progress.done} of 3 steps</p>
              </div>
              <span className="text-xs text-muted-foreground">{progress.percent}%</span>
            </div>
            <div className="mt-3"><ProgressBar value={progress.percent} /></div>
          </div>
        })}
      </div>
    </section>
  </div>
}

function BigStat({ value, label, suffix = "" }: { value: number | null; label: string; suffix?: string }) {
  return <div className="rounded-3xl border border-border bg-card p-5">
    {value === null
      ? <span className="text-2xl font-semibold text-muted-foreground">—</span>
      : <CountUp value={value} suffix={suffix} className="text-2xl font-semibold" />}
    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
  </div>
}

function getCurrentWeek(activityDates: string[]) {
  const active = new Set(activityDates)
  const now = new Date()
  const weekday = now.getDay() || 7
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(now.getDate() - weekday + 1)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    const key = localDateKey(date)
    return {
      key,
      label: ["M", "T", "W", "T", "F", "S", "S"][index],
      active: active.has(key),
      today: key === localDateKey(now),
    }
  })
}

function calculateStreaks(activityDates: string[]) {
  const ordinals = [...new Set(activityDates.map(dayOrdinal).filter((value): value is number => value !== null))].sort((a, b) => a - b)
  if (!ordinals.length) return { current: 0, longest: 0 }

  let longest = 1
  let run = 1
  for (let index = 1; index < ordinals.length; index += 1) {
    if (ordinals[index] === ordinals[index - 1] + 1) {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 1
    }
  }

  const today = dayOrdinal(localDateKey(new Date()))!
  const latest = ordinals.at(-1)!
  if (today - latest > 1) return { current: 0, longest }

  let current = 1
  for (let index = ordinals.length - 1; index > 0; index -= 1) {
    if (ordinals[index] !== ordinals[index - 1] + 1) break
    current += 1
  }
  return { current, longest }
}

function dayOrdinal(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
