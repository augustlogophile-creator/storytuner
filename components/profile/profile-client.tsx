"use client"

import Link from "next/link"
import { BarChart3, ChevronRight, LockKeyhole, Mail, MessageCircle, Settings, Sparkles, Star } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { Weaver } from "@/components/weaver"
import { levelForXp, useApp } from "@/lib/app-state"

export function ProfileClient() {
  const { state } = useApp()
  const level = levelForXp(state.xpLifetime)
  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <Weaver size={74} />
          <div className="min-w-0">
            <Eyebrow>StoryTuner profile</Eyebrow>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{state.profile.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Level {level.level} · {level.title}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat value={state.streak} label="Day streak" />
          <Stat value={state.xpLifetime} label="Total XP" />
          <Stat value={state.recordings.length} label="Stories" />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <Eyebrow>Support</Eyebrow>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">Questions, issues, or concerns?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Reach out anytime. We will help with technical problems, feedback, account questions, or anything else involving StoryTuner.
        </p>
        <a
          href="mailto:storytunerapp@gmail.com?subject=StoryTuner%20Support"
          className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          <Mail className="h-4 w-4" />
          Contact StoryTuner
        </a>
      </section>

      <section>
        <Eyebrow className="mb-3">Account</Eyebrow>
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <Menu href="/progress" icon={BarChart3} title="Progress" detail="Activity, streaks, and unit completion" />
          <Menu href="/coach" icon={MessageCircle} title="Ask Weaver" detail="AI coaching for your stories and scores" />
          <Menu href="/settings" icon={Settings} title="Settings and privacy" detail="Notifications, recordings, and data controls" />
          <Menu href="/membership" icon={Star} title={state.premium ? "StoryTuner Membership" : "Membership"} detail={state.premium ? "Membership is active on this device" : "Founding waitlist offer · $11.99/year"} />
          <Menu href="/shop" icon={Sparkles} title="Weaver shop" detail={`${state.xpBalance} XP available to spend`} last />
        </div>
      </section>

      <div className="flex gap-3 rounded-3xl bg-brand-soft/45 p-5">
        <LockKeyhole className="h-5 w-5 shrink-0 text-accent-foreground" />
        <p className="text-sm leading-relaxed text-foreground/85">Your recordings remain private. Membership unlocks Community, and sharing is always a separate choice for each story.</p>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) { return <div className="rounded-2xl bg-secondary p-3 text-center"><p className="text-lg font-semibold">{value.toLocaleString()}</p><p className="mt-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-muted-foreground">{label}</p></div> }
function Menu({ href, icon: Icon, title, detail, last }: { href: string; icon: typeof Settings; title: string; detail: string; last?: boolean }) { return <Link href={href} className={`flex items-center gap-3 p-4 transition-colors hover:bg-secondary/60 ${last ? "" : "border-b border-border"}`}><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-soft text-accent-foreground"><Icon className="h-4.5 w-4.5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link> }
