"use client"

import Link from "next/link"
import { useEffect, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react"
import { ChevronRight, KeyRound, LogOut, LockKeyhole } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { useApp } from "@/lib/app-state"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export function SettingsClient() {
  const router = useRouter()
  const { state, updateSettings, updateProfileName, repairStreak, deleteAllRecordings, resetAll } = useApp()
  const [displayName, setDisplayName] = useState(state.profile.name)
  const [accountEmail, setAccountEmail] = useState("")

  useEffect(() => setDisplayName(state.profile.name), [state.profile.name])

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data }) => setAccountEmail(data.user?.email ?? ""))
  }, [])

  async function saveDisplayName() {
    const clean = displayName.trim() || "Storyteller"
    updateProfileName(clean)
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      const { error } = await supabase.from("profiles").update({ display_name: clean }).eq("id", data.user.id)
      if (error) window.alert("Your name was saved on this device, but StoryTuner could not update your account profile.")
    }
  }

  async function logOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/profile" label="Profile" />
      <header>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Settings and privacy</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Clear controls, no hidden defaults.</h1>
      </header>


      <Section title="Account">
        <Row title="Account email" detail={accountEmail || "Your private login email is never shown in Community."}>
          <Link href="/forgot-password" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold">
            <KeyRound className="h-3.5 w-3.5" />
            Change password
          </Link>
        </Row>
        <Row title="Log out" detail="Sign out securely on this device.">
          <button type="button" onClick={() => void logOut()} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold">
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </button>
        </Row>
      </Section>

      <Section title="Profile">
        <Row title="Display name" detail="Used on your profile and on Community posts you choose to share.">
          <input
            value={displayName}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setDisplayName(event.target.value)}
            onBlur={() => void saveDisplayName()}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") event.currentTarget.blur() }}
            maxLength={40}
            aria-label="Display name"
            className="w-36 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </Row>
      </Section>

      <Section title="Notifications">
        <Row title="Tone" detail="Choose how practice reminders are phrased.">
          <select
            value={state.settings.tone}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => updateSettings({ tone: event.target.value as "warm" | "minimal" })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="warm">Warm</option>
            <option value="minimal">Minimal</option>
          </select>
        </Row>
        <Row title="Frequency" detail="Notification preference for a connected production build.">
          <select
            value={state.settings.frequency}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => updateSettings({ frequency: event.target.value as "daily" | "weekdays" | "off" })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays</option>
            <option value="off">Off</option>
          </select>
        </Row>
      </Section>

      <Section title="Streak">
        <Row title="Free streak repair" detail="Restore a missed streak without spending XP.">
          <button
            type="button"
            onClick={() => window.alert(repairStreak() ? "Your streak was repaired." : "There is no missed streak to repair.")}
            className="rounded-full border border-border px-3 py-2 text-xs font-semibold"
          >
            Repair
          </button>
        </Row>
      </Section>

      <Section title="Privacy">
        <div className="flex gap-3 rounded-2xl bg-brand-soft/45 p-4">
          <LockKeyhole className="h-5 w-5 shrink-0 text-accent-foreground" />
          <p className="text-sm leading-relaxed">Recordings are private by default. Membership unlocks Community, and sharing remains a separate action for each story.</p>
        </div>
        <Row title="Use recordings to improve AI" detail="Off by default. This setting records your preference only. A production backend must enforce it.">
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={state.settings.aiOptIn}
              onChange={(event: ChangeEvent<HTMLInputElement>) => updateSettings({ aiOptIn: event.target.checked })}
              className="peer sr-only"
            />
            <span className="h-7 w-12 rounded-full bg-secondary transition peer-checked:bg-brand after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
          </label>
        </Row>
        <Row title="Delete all recordings" detail="Permanently removes media, transcripts, and your shared posts.">
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Delete every recording permanently?")) void deleteAllRecordings()
            }}
            className="rounded-full border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive"
          >
            Delete
          </button>
        </Row>
        <Row title="Delete all app data" detail="Erases progress, XP, streaks, settings, recordings, and Community activity.">
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Delete all StoryTuner data on this device? This cannot be undone.")) void resetAll()
            }}
            className="rounded-full border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive"
          >
            Delete all
          </button>
        </Row>
      </Section>

      <Link href="/membership" className="flex items-center gap-3 rounded-3xl border border-border bg-card p-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{state.premium ? "StoryTuner Membership is active" : "Free plan"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Review the $11.99/year founding offer and demo status.</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-3 divide-y divide-border">{children}</div>
    </section>
  )
}

function Row({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-1 last:pb-1">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
