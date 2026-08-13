"use client"

import Link from "next/link"
import { Activity, BarChart3, ChevronRight, Mail, Settings, ShieldCheck, Sparkles, Star } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import { Weaver } from "@/components/weaver"
import { useApp } from "@/lib/app-state"

export function ProfileClient({ moderatorRole, displayName, username }: { moderatorRole: "moderator" | "admin" | null; displayName: string; username: string }) {
  const { state } = useApp()
  const name = displayName.trim() || state.profile.name || "Storyteller"

  return (
    <div className="flex flex-col gap-5">
      <header className="text-center">
        <h1 className="text-[1.35rem] font-semibold tracking-[-0.025em]">Profile</h1>
      </header>

      <section className="overflow-hidden rounded-[1.55rem] border border-border bg-card">
        <div className="flex items-center gap-3.5 px-4 py-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft/60">
            <Weaver size={44} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.95rem] font-semibold tracking-[-0.015em]">{name}</p>
            <p className="mt-0.5 truncate text-[0.7rem] text-muted-foreground">@{username}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">Streak</p>
            <p className="mt-0.5 text-[0.8rem] font-semibold tabular-nums">{state.streak}d</p>
          </div>
        </div>
        <div className="grid grid-cols-3 border-t border-border bg-secondary/25 py-2.5">
          <Stat value={state.streak} label="Days" />
          <Stat value={state.xpLifetime} label="Total XP" />
          <Stat value={state.recordings.length} label="Stories" />
        </div>
      </section>

      <section>
        <Eyebrow className="mb-2.5 px-1">Your StoryTuner</Eyebrow>
        <div className="overflow-hidden rounded-[1.45rem] border border-border bg-card px-4">
          <ProfileRow href="/progress" icon={BarChart3} title="Progress" detail="Lessons and growth" />
          <Divider />
          <ProfileRow
            href="/membership"
            icon={Star}
            title="Membership"
            detail={state.premium ? "Active" : "View your plan"}
            value={state.premium ? "Active" : undefined}
          />
          <Divider />
          <ProfileRow href="/shop" icon={Sparkles} title="Weaver shop" detail={`${state.xpBalance.toLocaleString()} XP available`} />
          <Divider />
          <ProfileRow href="/settings" icon={Settings} title="Settings" detail="Privacy, data, and account controls" />
        </div>
      </section>

      {moderatorRole && (
        <section>
          <Eyebrow className="mb-2.5 px-1">Admin</Eyebrow>
          <div className="overflow-hidden rounded-[1.45rem] border border-border bg-card px-4">
            <ProfileRow href="/admin/community" icon={ShieldCheck} title="Community moderation" detail="Reports and account actions" />
            <Divider />
            <ProfileRow href="/admin/system" icon={Activity} title="System health" detail="Usage, failures, and maintenance" />
          </div>
        </section>
      )}

      <section>
        <Eyebrow className="mb-2.5 px-1">Support</Eyebrow>
        <div className="overflow-hidden rounded-[1.45rem] border border-border bg-card px-4">
          <a href="mailto:storytunerapp@gmail.com?subject=StoryTuner%20Support" className="group flex items-center gap-3 py-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft/65 text-brand">
              <Mail className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.82rem] font-semibold">Contact StoryTuner</span>
              <span className="mt-0.5 block truncate text-[0.67rem] text-muted-foreground">Questions, issues, or feedback</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
          </a>
        </div>
      </section>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-[0.82rem] font-semibold tabular-nums">{value.toLocaleString()}</p>
      <p className="mt-0.5 font-mono text-[0.5rem] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
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
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft/65 text-brand">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.82rem] font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-[0.67rem] text-muted-foreground">{detail}</span>
      </span>
      {value && <span className="shrink-0 text-[0.67rem] font-medium text-brand">{value}</span>}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
    </Link>
  )
}

function Divider() {
  return <div className="ml-11 h-px bg-border" />
}
