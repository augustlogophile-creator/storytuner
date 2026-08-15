"use client"

import {
  BookOpenCheck,
  Check,
  Ear,
  Footprints,
  Flame,
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

export function ProgressClient() {
  const { state } = useApp()
  const course = courseProgress(state)
  const completedUnits = curriculum.filter((unit) => unitProgress(state, unit.id).done === 3).length
  const shared = state.recordings.filter((item) => item.shared).length
  const week = getCurrentWeek(state.activityDates)
  const activeDays = week.filter((day) => day.active).length
  return <div className="flex flex-col gap-6">
    <BackLink href="/profile" label="Profile" />
    <header><p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Progress</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Your work, accurately counted.</h1><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Every figure below comes from completed lessons, recorded takes, and active days on this device.</p></header>
    <section className="grid grid-cols-2 gap-3">
      <BigStat value={course.percent} label="Course complete" suffix="%" />
      <BigStat value={state.xpLifetime} label="Lifetime XP" />
      <BigStat value={completedUnits} label="Units complete" formatter={(value) => `${value}/15`} />
      <BigStat value={state.sessions} label="App sessions" />
      <BigStat value={state.recordings.length} label="Stories recorded" />
      <BigStat value={shared} label="Stories shared" />
    </section>
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold">Streak</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Keep the habit moving this week.</p>
        </div>
        <div className="flex items-center gap-1.5 text-[#c96f4e]">
          <Flame className="h-4 w-4" strokeWidth={2} />
          <span className="text-sm font-semibold tabular-nums">{state.streak}d</span>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-1.5">
        {week.map((day) => (
          <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className={`flex h-10 w-10 items-center justify-center rounded-full border text-xs font-medium ${day.active ? "border-brand/35 bg-brand-soft text-brand" : day.today ? "border-dashed border-foreground/45 bg-card text-foreground" : "border-border bg-card text-muted-foreground"}`}>
              {day.active ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : day.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 divide-x divide-border border-t border-border pt-4 text-center">
        <div><p className="text-lg font-semibold tabular-nums">{activeDays}/7</p><p className="mt-0.5 text-[0.68rem] text-muted-foreground">This week</p></div>
        <div><p className="text-lg font-semibold tabular-nums">{state.streak}</p><p className="mt-0.5 text-[0.68rem] text-muted-foreground">Current streak</p></div>
        <div><p className="text-lg font-semibold tabular-nums">{state.longestStreak}</p><p className="mt-0.5 text-[0.68rem] text-muted-foreground">Longest streak</p></div>
      </div>
    </section>
    <section><p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Unit completion</p><div className="flex flex-col gap-3">{curriculum.map((unit) => { const progress=unitProgress(state,unit.id); const Icon=unitIcons[unit.index] ?? BookOpenCheck; return <div key={unit.id} className="rounded-3xl border border-border bg-card p-4"><div className="flex items-center gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${progress.done===3?"bg-brand text-brand-foreground":"bg-brand-soft text-accent-foreground"}`}>{progress.done===3?<Check className="h-4.5 w-4.5" strokeWidth={2.6} />:<Icon className="h-5 w-5" strokeWidth={1.9} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{unit.index}. {unit.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{progress.done} of 3 steps</p></div><span className="text-xs text-muted-foreground">{progress.percent}%</span></div><div className="mt-3"><ProgressBar value={progress.percent} /></div></div>})}</div></section>
  </div>
}
function BigStat({value,label,suffix="",formatter}:{value:number;label:string;suffix?:string;formatter?:(value:number)=>string}){return <div className="rounded-3xl border border-border bg-card p-5"><CountUp value={value} suffix={suffix} formatter={formatter} className="text-2xl font-semibold" /><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>}
function getCurrentWeek(activityDates: string[]) {
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
      active: activityDates.includes(key),
      today: key === localDateKey(now),
    }
  })
}
function localDateKey(date:Date){const year=date.getFullYear();const month=String(date.getMonth()+1).padStart(2,"0");const day=String(date.getDate()).padStart(2,"0");return `${year}-${month}-${day}`}
