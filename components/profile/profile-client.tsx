"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import {
  Activity,
  BarChart3,
  ChevronRight,
  Mail,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react"
import { CountUp } from "@/components/ui/count-up"
import { goalLabels, type StoryGoal } from "@/lib/onboarding-preferences"
import { useApp } from "@/lib/app-state"

export function ProfileClient({ moderatorRole, displayName, username }: { moderatorRole: "moderator" | "admin" | null; displayName: string; username: string }) {
  const { state } = useApp()
  const name = displayName.trim() || state.profile.name || "Storyteller"
  const goal = state.onboardingPreferences.goal

  return (
    <div className="flex flex-col gap-5 pb-4">
      <header className="text-center">
        <h1 className="text-[1.22rem] font-semibold tracking-[-0.025em]">Profile</h1>
      </header>

      <section className="story-card overflow-hidden rounded-[1.55rem]">
        <div className="flex items-center gap-3.5 px-4 py-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
            <ScrollText className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.95rem] font-semibold tracking-[-0.015em]">{name}</p>
            <p className="mt-0.5 truncate text-[0.69rem] text-muted-foreground">@{username}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[0.54rem] uppercase tracking-[0.12em] text-muted-foreground">Streak</p>
            <CountUp value={state.streak} suffix="d" className="mt-0.5 block text-[0.82rem] font-semibold tabular-nums" />
          </div>
        </div>

        <div className="grid grid-cols-3 border-t border-border bg-secondary/35 py-2.5">
          <Stat value={state.streak} label="Days" />
          <Stat value={state.xpLifetime} label="Total XP" />
          <Stat value={state.recordings.length} label="Stories" />
        </div>
      </section>

      {goal && (
        <section>
          <SectionLabel>Current focus</SectionLabel>
          <div className="story-card rounded-[1.35rem] px-4 py-3.5">
            <p className="text-[0.82rem] font-semibold">{goalLabels[goal as Exclude<StoryGoal, "">]}</p>
            <p className="mt-1 text-[0.68rem] leading-5 text-muted-foreground">This came from your StoryTuner setup and can help make coaching more relevant.</p>
          </div>
        </section>
      )}

      <section>
        <SectionLabel>StoryTuner</SectionLabel>
        <div className="story-card overflow-hidden rounded-[1.45rem] px-4">
          <ProfileRow href="/progress" icon={BarChart3} title="Progress" detail="Lessons, XP, and activity" />
          <Divider />
          <ProfileRow
            href="/membership"
            icon={Star}
            title="Membership"
            detail={state.premium ? "Your membership is active" : "View plans and limits"}
            value={state.premium ? "Active" : undefined}
          />
          <Divider />
          <ProfileRow href="/shop" icon={Sparkles} title="Customize" detail={`${state.xpBalance.toLocaleString()} XP available`} />
          <Divider />
          <ProfileRow href="/settings" icon={Settings} title="Settings" detail="Privacy, data, and account controls" />
        </div>
      </section>

      {moderatorRole && (
        <section>
          <SectionLabel>Admin</SectionLabel>
          <div className="story-card overflow-hidden rounded-[1.45rem] px-4">
            <ProfileRow href="/admin/community" icon={ShieldCheck} title="Community moderation" detail="Reports and account actions" />
            <Divider />
            <ProfileRow href="/admin/system" icon={Activity} title="System health" detail="Usage, failures, and maintenance" />
          </div>
        </section>
      )}

      <section className="story-card rounded-[1.55rem] p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground">
          <Mail className="h-4.5 w-4.5" strokeWidth={1.8} />
        </span>
        <h2 className="mt-4 text-[1rem] font-semibold tracking-[-0.02em]">Reach out to StoryTuner</h2>
        <p className="mt-1.5 max-w-sm text-[0.72rem] leading-5 text-muted-foreground">
          Have a question, found something that feels off, or have an idea that would make StoryTuner better? Send us a note.
        </p>
        <a
          href="mailto:storytunerapp@gmail.com?subject=StoryTuner%20Support"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-[0.78rem] font-semibold text-primary-foreground"
        >
          Contact StoryTuner
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
        </a>
      </section>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 px-1 font-mono text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">{children}</p>
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <CountUp value={value} className="text-[0.82rem] font-semibold tabular-nums" />
      <p className="mt-0.5 font-mono text-[0.49rem] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
    </div>
  )
}

function ProfileRow({
  href,
  icon: Icon,
  title,
  detail,
  value,
}: {
  href: string
  icon: typeof Settings
  title: string
  detail: string
  value?: string
}) {
  return (
    <Link href={href} className="group flex items-center gap-3 py-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.81rem] font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-[0.65rem] text-muted-foreground">{detail}</span>
      </span>
      {value && <span className="shrink-0 text-[0.65rem] font-semibold text-foreground">{value}</span>}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
    </Link>
  )
}

function Divider() {
  return <div className="ml-11 h-px bg-border" />
}
