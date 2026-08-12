"use client"

import type { CSSProperties } from "react"
import Link from "next/link"
import { Activity, ArrowUpRight, BarChart3, Mail, Settings, ShieldCheck, Sparkles, Star } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { Weaver } from "@/components/weaver"
import { useApp } from "@/lib/app-state"

export function ProfileClient({ moderatorRole, displayName, username }: { moderatorRole: "moderator" | "admin" | null; displayName: string; username: string }) {
  const { state } = useApp()
  const name = displayName.trim() || state.profile.name || "Storyteller"

  return (
    <div className="flex flex-col gap-6">
      <section className="rise-in overflow-hidden" style={rise(0)}>
        <div className="flex items-center gap-4">
          <div className="shrink-0 rounded-[1.6rem] border border-brand/15 bg-brand-soft p-2.5"><Weaver size={66} /></div>
          <div className="min-w-0 flex-1">
            <Eyebrow>Your profile</Eyebrow>
            <h1 className="text-title mt-2 truncate text-[1.8rem]">{name}</h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">@{username}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 divide-x divide-border rounded-[1.8rem] border border-border bg-card py-4">
          <Stat value={state.streak} label="Day streak" />
          <Stat value={state.xpLifetime} label="Total XP" />
          <Stat value={state.recordings.length} label="Stories" />
        </div>
      </section>

      <section className="rise-in" style={rise(1)}>
        <Eyebrow className="mb-4">Your StoryTuner</Eyebrow>
        <div className="grid grid-cols-2 gap-3">
          <QuickCard href="/progress" icon={BarChart3} title="Progress" detail="Lessons and growth" />
          <QuickCard href="/membership" icon={Star} title="Membership" detail={state.premium ? "Active" : "View your plan"} badge={state.premium ? "Active" : undefined} />
        </div>
      </section>

      <section className="rise-in rounded-[1.9rem] border border-border bg-card px-5" style={rise(2)}>
        <CompactRow href="/settings" icon={Settings} title="Settings" detail="Privacy, data, and account controls" />
        <div className="h-px bg-border" />
        <CompactRow href="/shop" icon={Sparkles} title="Weaver shop" detail={`${state.xpBalance.toLocaleString()} XP available`} />
      </section>

      {moderatorRole && (
        <section className="overflow-hidden rounded-[1.9rem] border border-border bg-card px-5">
          <CompactRow href="/admin/community" icon={ShieldCheck} title="Community moderation" detail="Review reports and account actions" />
          <div className="h-px bg-border" />
          <CompactRow href="/admin/system" icon={Activity} title="System health" detail="Backend usage, failures, and maintenance" />
        </section>
      )}

      <section className="rise-in rounded-[2rem] border border-brand/15 bg-brand-soft p-6" style={rise(3)}>
        <Eyebrow>Support</Eyebrow>
        <h2 className="text-title mt-3 text-[1.55rem]">Got a question or an idea?</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Write to us anytime about StoryTuner, your account, or anything that isn't behaving the way it should.</p>
        <a href="mailto:storytunerapp@gmail.com?subject=StoryTuner%20Support" className="press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
          <Mail className="h-4 w-4" /> Contact StoryTuner
        </a>
      </section>
    </div>
  )
}

function rise(index: number) {
  return { "--rise-delay": `${index * 70}ms` } as CSSProperties
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="px-2 text-center"><p className="text-display text-[1.75rem] tabular-nums">{value.toLocaleString()}</p><p className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">{label}</p></div>
}

function QuickCard({ href, icon: Icon, title, detail, badge }: { href: string; icon: typeof Settings; title: string; detail: string; badge?: string }) {
  return (
    <Link href={href} className="group min-w-0 rounded-[1.9rem] border border-border bg-card p-5 transition-all duration-200 hover:border-brand/45 hover:shadow-sm active:scale-[0.985]">
      <div className="flex items-start justify-between gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-soft/75 text-accent-foreground"><Icon className="h-[1.1rem] w-[1.1rem]" /></span><ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
      <div className="mt-5 flex items-center gap-2"><p className="text-title truncate text-[1.2rem]">{title}</p>{badge && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[0.55rem] font-semibold text-accent-foreground">{badge}</span>}</div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </Link>
  )
}

function CompactRow({ href, icon: Icon, title, detail }: { href: string; icon: typeof Settings; title: string; detail: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft/70 text-accent-foreground"><Icon className="h-[1.1rem] w-[1.1rem]" /></span>
      <span className="min-w-0 flex-1"><span className="text-title block text-[1.15rem]">{title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span></span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  )
}
