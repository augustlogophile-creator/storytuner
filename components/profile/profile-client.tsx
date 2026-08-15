"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import {
  Activity,
  BarChart3,
  ChevronRight,
  Mail,
  Flag,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBag,
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
    <div className="profile-page flex min-h-full flex-col gap-3 pb-4">
      <header className="px-1">
        <h1 className="text-[1.58rem] font-semibold tracking-[-0.035em]">Profile</h1>
        <p className="mt-0.5 max-w-sm text-[0.74rem] leading-[1.2rem] text-muted-foreground">Your progress, account, and StoryTuner settings in one place.</p>
      </header>

      <section className="story-card overflow-hidden rounded-[1.45rem]">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
            <ScrollText className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.94rem] font-semibold tracking-[-0.015em]">{name}</p>
            <div className="mt-0.5 flex min-w-0 items-center gap-2">
              <p className="truncate text-[0.72rem] text-muted-foreground">@{username}</p>
              {goal && (
                <span className="max-w-[9.5rem] truncate rounded-full bg-secondary px-2 py-0.5 text-[0.52rem] font-semibold text-muted-foreground">
                  {goalLabels[goal as Exclude<StoryGoal, "">]}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[0.57rem] uppercase tracking-[0.12em] text-muted-foreground">Streak</p>
            <CountUp value={state.streak} suffix="d" className="mt-0.5 block text-[0.86rem] font-semibold tabular-nums" />
          </div>
        </div>

        <div className="grid grid-cols-3 border-t border-border bg-secondary/30 py-1.5">
          <Stat value={state.streak} label="Days" />
          <Stat value={state.xpBalance} label="XP available" />
          <Stat value={state.recordings.length} label="Stories" />
        </div>
      </section>

      <section>
        <SectionLabel>StoryTuner</SectionLabel>
        <div className="story-card overflow-hidden rounded-[1.35rem] px-4">
          <ProfileRow href="/settings" icon={Settings} title="Settings" detail="Privacy, data, and account controls" />
          <Divider />
          <ProfileRow href="/shop" icon={ShoppingBag} title="Shop" detail={`${state.xpBalance.toLocaleString()} XP available`} />
          <Divider />
          <ProfileRow
            href="/membership"
            icon={Star}
            title="Membership"
            detail={state.premium ? "Your membership is active" : "View plans and limits"}
            value={state.premium ? "Active" : undefined}
          />
          <Divider />
          <ProfileRow href="/progress" icon={BarChart3} title="Progress" detail="Lessons, XP, and activity" />
        </div>
      </section>

      <section>
        <SectionLabel>Legal</SectionLabel>
        <div className="story-card overflow-hidden rounded-[1.35rem] px-4">
          <ProfileRow href="/legal?from=profile" icon={ShieldCheck} title="Legal and accessibility" detail="Privacy, terms, accessibility, Community rules, and account deletion" />
        </div>
      </section>

      <section className="story-card mt-2 rounded-[1.4rem] p-3.5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
            <Mail className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[0.94rem] font-semibold tracking-[-0.02em]">Reach out to StoryTuner</h2>
            <p className="mt-0.5 text-[0.69rem] leading-[1.4] text-muted-foreground">Questions, feedback, or something that feels off? Send us a note.</p>
          </div>
        </div>
        <a
          href="mailto:storytunerapp@gmail.com?subject=StoryTuner%20Support"
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[0.79rem] font-semibold text-primary-foreground"
        >
          Contact StoryTuner
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
        </a>
      </section>

      {moderatorRole && (
        <section>
          <SectionLabel>Admin</SectionLabel>
          <div className="story-card overflow-hidden rounded-[1.3rem] px-4">
            <ProfileRow href="/admin/community" icon={ShieldCheck} title="Community moderation" detail="Reports and account actions" />
            <Divider />
            <ProfileRow href="/admin/ai-reports" icon={Flag} title="AI response reports" detail="Review replies members flagged" />
            <Divider />
            <ProfileRow href="/admin/system" icon={Activity} title="System health" detail="Usage, failures, and maintenance" />
          </div>
        </section>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1 px-1 font-mono text-[0.61rem] uppercase tracking-[0.15em] text-muted-foreground">{children}</p>
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <CountUp value={value} className="text-[0.85rem] font-semibold tabular-nums" />
      <p className="mt-0.5 font-mono text-[0.52rem] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
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
    <Link prefetch href={href} className="group flex items-center gap-3 py-[0.61rem]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.82rem] font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-[0.66rem] text-muted-foreground">{detail}</span>
      </span>
      {value && <span className="shrink-0 text-[0.69rem] font-semibold text-foreground">{value}</span>}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
    </Link>
  )
}

function Divider() {
  return <div className="ml-11 h-px bg-border" />
}
