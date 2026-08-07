"use client"

import Link from "next/link"
import {
  BarChart3,
  ChevronRight,
  LockKeyhole,
  Mail,
  Map,
  MessageCircle,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { Weaver } from "@/components/weaver"
import { useApp } from "@/lib/app-state"

export function ProfileClient({ moderatorRole }: { moderatorRole: "moderator" | "admin" | null }) {
  const { state } = useApp()

  return (
    <div className="flex flex-col gap-5">
      <section className="app-surface overflow-hidden rounded-[2rem] border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="shrink-0 rounded-[1.35rem] bg-secondary/70 p-2">
            <Weaver size={62} />
          </div>
          <div className="min-w-0 flex-1">
            <Eyebrow>Your profile</Eyebrow>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">{state.profile.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{state.xpBalance.toLocaleString()} XP available</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 divide-x divide-border rounded-2xl bg-secondary/55 px-2 py-3">
          <Stat value={state.streak} label="Streak" />
          <Stat value={state.xpLifetime} label="Total XP" />
          <Stat value={state.recordings.length} label="Stories" />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <Eyebrow>StoryTuner</Eyebrow>
          <span className="text-[0.68rem] font-medium text-muted-foreground">Your tools</span>
        </div>
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <Menu href="/progress" icon={BarChart3} title="Progress" detail="Lessons, streaks, and growth" />
          <Menu href="/coach" icon={MessageCircle} title="Ask Weaver" detail="Get help shaping your next story" />
          <Menu href="/planner" icon={Map} title="Story Planner" detail="Plan before you tell it" />
          <Menu
            href="/membership"
            icon={Star}
            title="Membership"
            detail={state.premium ? "Active" : "View plan and benefits"}
            badge={state.premium ? "Active" : undefined}
            last
          />
        </div>
      </section>

      <section>
        <Eyebrow className="mb-2">Account</Eyebrow>
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <Menu href="/shop" icon={Sparkles} title="Weaver shop" detail={`${state.xpBalance.toLocaleString()} XP to spend`} />
          <Menu href="/settings" icon={Settings} title="Settings & privacy" detail="Account, recordings, and data" last={!moderatorRole} />
          {moderatorRole && (
            <Menu href="/admin/community" icon={ShieldCheck} title="Community moderation" detail="Reports and account actions" last />
          )}
        </div>
      </section>

      <section className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
          <Mail className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Need help?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Questions, issues, or feedback.</p>
        </div>
        <a
          href="mailto:storytunerapp@gmail.com?subject=StoryTuner%20Support"
          className="rounded-full bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-brand-soft"
        >
          Contact
        </a>
      </section>

      <div className="flex items-start gap-3 px-1 pb-1 text-muted-foreground">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-xs leading-relaxed">Recordings stay private unless you explicitly choose to share them.</p>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-2 text-center">
      <p className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[0.62rem] font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

function Menu({
  href,
  icon: Icon,
  title,
  detail,
  badge,
  last,
}: {
  href: string
  icon: typeof Settings
  title: string
  detail: string
  badge?: string
  last?: boolean
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 px-4 py-3.5 transition-all duration-200 hover:bg-secondary/55 active:bg-secondary/80 ${last ? "" : "border-b border-border"}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft/75 text-accent-foreground transition-transform duration-200 group-hover:scale-[1.04]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="block text-sm font-semibold">{title}</span>
          {badge && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[0.58rem] font-semibold text-accent-foreground">{badge}</span>}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  )
}
