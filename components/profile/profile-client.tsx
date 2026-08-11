"use client"

import Link from "next/link"
import { ArrowUpRight, BarChart3, LockKeyhole, Mail, Settings, ShieldCheck, Sparkles, Star } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { Weaver } from "@/components/weaver"
import { useApp } from "@/lib/app-state"

export function ProfileClient({ moderatorRole, displayName, username }: { moderatorRole: "moderator" | "admin" | null; displayName: string; username: string }) {
  const { state } = useApp()
  const name = displayName.trim() || state.profile.name || "Storyteller"

  return (
    <div className="flex flex-col gap-6">
      <section className="app-surface overflow-hidden rounded-[2rem] border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="shrink-0 rounded-[1.4rem] bg-secondary/70 p-2"><Weaver size={64} /></div>
          <div className="min-w-0 flex-1">
            <Eyebrow>Your profile</Eyebrow>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">{name}</h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">@{username}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat value={state.streak} label="Day streak" />
          <Stat value={state.xpLifetime} label="Total XP" />
          <Stat value={state.recordings.length} label="Stories" />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3"><Eyebrow>Overview</Eyebrow><span className="text-xs text-muted-foreground">Your StoryTuner account</span></div>
        <div className="grid grid-cols-2 gap-3">
          <QuickCard href="/progress" icon={BarChart3} title="Progress" detail="Lessons and growth" />
          <QuickCard href="/membership" icon={Star} title="Membership" detail={state.premium ? "Active" : "View plan"} badge={state.premium ? "Active" : undefined} />
        </div>
      </section>

      <section>
        <Eyebrow className="mb-3">Account</Eyebrow>
        <div className="grid grid-cols-2 gap-3">
          <QuickCard href="/settings" icon={Settings} title="Settings" detail="Privacy and data" />
          <QuickCard href="/shop" icon={Sparkles} title="Weaver shop" detail={`${state.xpBalance.toLocaleString()} XP available`} />
        </div>
      </section>

      {moderatorRole && (
        <Link href="/admin/community" className="group flex items-center gap-4 rounded-3xl border border-border bg-card p-4 transition-all duration-200 hover:border-brand/45 hover:shadow-sm active:scale-[0.99]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-accent-foreground"><ShieldCheck className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><Eyebrow>Owner tools</Eyebrow><span className="mt-1 block text-sm font-semibold">Community moderation</span><span className="mt-0.5 block text-xs text-muted-foreground">Review reports and account actions</span></span>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border px-1 pt-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" /><span>Recordings stay private until you share them.</span></div>
        <a href="mailto:storytunerapp@gmail.com?subject=StoryTuner%20Support" className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground hover:text-brand"><Mail className="h-3.5 w-3.5" /> Help</a>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="rounded-2xl bg-secondary/55 px-2 py-3 text-center"><p className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</p><p className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">{label}</p></div>
}

function QuickCard({ href, icon: Icon, title, detail, badge }: { href: string; icon: typeof Settings; title: string; detail: string; badge?: string }) {
  return (
    <Link href={href} className="group min-w-0 rounded-3xl border border-border bg-card p-4 transition-all duration-200 hover:border-brand/45 hover:shadow-sm active:scale-[0.985]">
      <div className="flex items-start justify-between gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-soft/75 text-accent-foreground"><Icon className="h-4.5 w-4.5" /></span><ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
      <div className="mt-4 flex items-center gap-2"><p className="truncate text-sm font-semibold">{title}</p>{badge && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[0.55rem] font-semibold text-accent-foreground">{badge}</span>}</div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </Link>
  )
}
