"use client"

import { useState } from "react"
import {
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
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
import { activityStreaks, courseProgress, unitProgress, useApp } from "@/lib/app-state"
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
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekDirection, setWeekDirection] = useState<"back" | "forward">("back")
  const week = getWeek(state.activityDates, weekOffset)
  const earliestWeekOffset = getEarliestWeekOffset(state.activityDates)
  const derivedStreaks = calculateStreaks(state.activityDates)
  const streaks = { current: derivedStreaks.current, longest: Math.max(derivedStreaks.longest, state.longestStreak) }

  const moveWeek = (direction: "back" | "forward") => {
    setWeekDirection(direction)
    setWeekOffset((current) => {
      if (direction === "back") return Math.max(earliestWeekOffset, current - 1)
      return Math.min(0, current + 1)
    })
  }

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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="text-base font-semibold">Streak</p>
            <p className="progress-week-range tabular-nums">{week.rangeLabel}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1" aria-label="Browse weekly activity">
          <button
            type="button"
            onClick={() => moveWeek("back")}
            disabled={weekOffset <= earliestWeekOffset}
            aria-label="Previous week"
            className="progress-week-arrow flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition disabled:cursor-default disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={() => moveWeek("forward")}
            disabled={weekOffset >= 0}
            aria-label="Next week"
            className="progress-week-arrow flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition disabled:cursor-default disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div key={week.startKey} className={`progress-week-strip progress-week-strip-${weekDirection}`}>
        <div className="mt-5 flex items-center justify-between gap-1.5">
          {week.days.map((day) => (
            <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className={`flex h-10 w-10 items-center justify-center rounded-full border text-xs font-medium ${day.active ? "border-brand/35 bg-brand-soft text-brand" : day.today ? "border-dashed border-foreground/45 bg-card text-foreground" : "border-border bg-card text-muted-foreground"}`}>
                {day.active ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : day.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="progress-streak-summary mt-4 border-t border-border pt-4 text-center">
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


function calculateStreaks(activityDates: string[]) {
  return activityStreaks(activityDates)
}

function getWeek(activityDates: string[], offset: number) {
  const active = new Set(activityDates)
  const now = new Date()
  const currentMonday = startOfWeek(now)
  const monday = new Date(currentMonday)
  monday.setDate(currentMonday.getDate() + offset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    startKey: localDateKey(monday),
    rangeLabel: formatWeekRange(monday, sunday),
    days: Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      const key = localDateKey(date)
      return {
        key,
        label: ["M", "T", "W", "T", "F", "S", "S"][index],
        active: active.has(key),
        today: offset === 0 && key === localDateKey(now),
      }
    }),
  }
}

function getEarliestWeekOffset(activityDates: string[]) {
  if (!activityDates.length) return 0
  const nowMonday = startOfWeek(new Date())
  const validDates = activityDates
    .map(parseLocalDateKey)
    .filter((date): date is Date => date !== null)
  if (!validDates.length) return 0
  const earliestMonday = startOfWeek(validDates.sort((a, b) => a.getTime() - b.getTime())[0])
  return Math.min(0, Math.round((earliestMonday.getTime() - nowMonday.getTime()) / (7 * 86_400_000)))
}

function startOfWeek(date: Date) {
  const result = new Date(date)
  const weekday = result.getDay() || 7
  result.setHours(0, 0, 0, 0)
  result.setDate(result.getDate() - weekday + 1)
  return result
}

function parseLocalDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatWeekRange(start: Date, end: Date) {
  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()
  const startMonth = start.toLocaleDateString("en-US", { month: "short" })
  const endMonth = end.toLocaleDateString("en-US", { month: "short" })

  if (sameMonth) return `${startMonth} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
  if (sameYear) return `${startMonth} ${start.getDate()}–${endMonth} ${end.getDate()}, ${end.getFullYear()}`
  return `${startMonth} ${start.getDate()}, ${start.getFullYear()}–${endMonth} ${end.getDate()}, ${end.getFullYear()}`
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
