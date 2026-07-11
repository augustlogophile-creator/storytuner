"use client"

import { Check, Circle } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { ProgressBar } from "@/components/progress-bar"
import { courseProgress, unitProgress, useApp } from "@/lib/app-state"
import { curriculum } from "@/lib/curriculum"

export function ProgressClient() {
  const { state } = useApp()
  const course = courseProgress(state)
  const completedUnits = curriculum.filter((unit) => unitProgress(state, unit.id).done === 3).length
  const shared = state.recordings.filter((item) => item.shared).length
  const days = lastThirtyDays(state.activityDates)
  return <div className="flex flex-col gap-6">
    <BackLink href="/profile" label="Profile" />
    <header><p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Progress</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Your work, accurately counted.</h1><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Every figure below comes from completed lessons, recorded takes, and active days on this device.</p></header>
    <section className="grid grid-cols-2 gap-3">
      <BigStat value={`${course.percent}%`} label="Course complete" />
      <BigStat value={state.xpLifetime.toLocaleString()} label="Lifetime XP" />
      <BigStat value={`${completedUnits}/15`} label="Units complete" />
      <BigStat value={state.sessions.toLocaleString()} label="App sessions" />
      <BigStat value={state.recordings.length.toLocaleString()} label="Stories recorded" />
      <BigStat value={shared.toLocaleString()} label="Stories shared" />
    </section>
    <section className="rounded-3xl border border-border bg-card p-5"><div className="flex items-baseline justify-between"><div><p className="text-sm font-semibold">Activity</p><p className="mt-0.5 text-xs text-muted-foreground">Last 30 days</p></div><p className="text-xs text-muted-foreground">Longest streak · {state.longestStreak}</p></div><div className="mt-5 grid grid-cols-10 gap-2">{days.map((day) => <span key={day.key} title={day.key} className={`aspect-square rounded-md ${day.active ? "bg-brand" : "bg-secondary"}`} />)}</div><p className="mt-4 text-xs text-muted-foreground">{state.activityDates.length} active days recorded · current streak {state.streak}</p></section>
    <section><p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Unit completion</p><div className="flex flex-col gap-3">{curriculum.map((unit) => { const progress=unitProgress(state,unit.id); return <div key={unit.id} className="rounded-3xl border border-border bg-card p-4"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${progress.done===3?"bg-brand text-brand-foreground":"bg-secondary text-muted-foreground"}`}>{progress.done===3?<Check className="h-4 w-4" />:<Circle className="h-3.5 w-3.5" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{unit.index}. {unit.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{progress.done} of 3 steps</p></div><span className="text-xs text-muted-foreground">{progress.percent}%</span></div><div className="mt-3"><ProgressBar value={progress.percent} /></div></div>})}</div></section>
  </div>
}
function BigStat({value,label}:{value:string|number;label:string}){return <div className="rounded-3xl border border-border bg-card p-5"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>}
function lastThirtyDays(active:string[]){const out=[];const now=new Date();for(let i=29;i>=0;i--){const date=new Date(now);date.setDate(now.getDate()-i);const key=localDateKey(date);out.push({key,active:active.includes(key)})}return out}

function localDateKey(date:Date){const year=date.getFullYear();const month=String(date.getMonth()+1).padStart(2,"0");const day=String(date.getDate()).padStart(2,"0");return `${year}-${month}-${day}`}
