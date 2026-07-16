"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { Check, ChevronDown, ChevronRight, LogOut, LockKeyhole, Trash2 } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useApp } from "@/lib/app-state"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type DialogKind = "save-name" | "logout" | "delete-recordings" | "delete-all" | null

export function SettingsClient() {
  const router = useRouter()
  const { state, updateSettings, updateProfileName, deleteAllRecordings, resetAll } = useApp()
  const [displayName, setDisplayName] = useState(state.profile.name)
  const [accountEmail, setAccountEmail] = useState("")
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")

  const cleanDisplayName = displayName.trim().slice(0, 40)
  const nameChanged = cleanDisplayName.length > 0 && cleanDisplayName !== state.profile.name

  useEffect(() => setDisplayName(state.profile.name), [state.profile.name])

  useEffect(() => {
    const supabase = createClient()
    void Promise.all([
      supabase.auth.getUser(),
      supabase.from("profiles").select("ai_personalization_enabled").maybeSingle(),
    ]).then(([userResult, profileResult]) => {
      setAccountEmail(userResult.data.user?.email ?? "")
      const enabled = profileResult.data?.ai_personalization_enabled
      if (typeof enabled === "boolean") updateSettings({ aiOptIn: enabled })
    })
  }, [updateSettings])

  const dialogContent = useMemo(() => {
    if (dialog === "save-name") return {
      title: "Update your display name?",
      body: <>Your profile and future Community posts will show <strong className="font-semibold text-foreground">{cleanDisplayName}</strong>.</>,
      confirm: "Confirm name",
      tone: "brand" as const,
    }
    if (dialog === "logout") return {
      title: "Log out of StoryTuner?",
      body: <>You will need to sign in again to access your account on this device.</>,
      confirm: "Log out",
      tone: "danger" as const,
    }
    if (dialog === "delete-recordings") return {
      title: "Delete every recording?",
      body: <>This removes your saved media, transcripts, grades, revisions, and any Community posts created from those recordings. <strong className="font-semibold text-foreground">This cannot be reversed.</strong></>,
      confirm: "Delete recordings",
      tone: "danger" as const,
    }
    if (dialog === "delete-all") return {
      title: "Delete all StoryTuner data on this device?",
      body: <>This erases local progress, XP, Weaver purchases, settings, recordings, and Community activity. Your login account will remain. <strong className="font-semibold text-foreground">This cannot be reversed.</strong></>,
      confirm: "Delete all data",
      tone: "danger" as const,
    }
    return null
  }, [cleanDisplayName, dialog])

  const saveDisplayName = useCallback(async () => {
    if (!nameChanged) return setDialog(null)
    setBusy(true)
    setNotice("")
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      setBusy(false)
      setDialog(null)
      return setNotice("Your session expired. Log in again before changing your name.")
    }
    const { error } = await supabase.from("profiles").update({ display_name: cleanDisplayName }).eq("id", data.user.id)
    if (error) {
      setBusy(false)
      setDialog(null)
      return setNotice("StoryTuner could not update your account profile. Try again.")
    }
    updateProfileName(cleanDisplayName)
    setBusy(false)
    setDialog(null)
    setNotice("Display name updated.")
  }, [cleanDisplayName, nameChanged, updateProfileName])

  const logOut = useCallback(async () => {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/")
    router.refresh()
  }, [router])

  const updatePersonalization = useCallback(async (enabled: boolean) => {
    const previous = state.settings.aiOptIn
    updateSettings({ aiOptIn: enabled })
    setNotice("")
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      updateSettings({ aiOptIn: previous })
      return setNotice("Your session expired. Log in again to change this preference.")
    }
    const { error } = await supabase
      .from("profiles")
      .update({ ai_personalization_enabled: enabled })
      .eq("id", data.user.id)
    if (error) {
      updateSettings({ aiOptIn: previous })
      return setNotice("Run the new Supabase personalization migration, then try this setting again.")
    }
    setNotice(enabled ? "Weaver can now use patterns from your past recordings when you ask for general coaching." : "Past recordings will no longer be used to personalize future coaching.")
  }, [state.settings.aiOptIn, updateSettings])

  async function confirmAction() {
    if (dialog === "save-name") return void saveDisplayName()
    if (dialog === "logout") return void logOut()
    setBusy(true)
    if (dialog === "delete-recordings") {
      await deleteAllRecordings()
      setNotice("All recordings were deleted from this device.")
    }
    if (dialog === "delete-all") {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        await supabase.from("profiles").update({ ai_personalization_enabled: false }).eq("id", data.user.id)
      }
      await resetAll()
      setDisplayName("Storyteller")
      setNotice("Local StoryTuner data was deleted.")
    }
    setBusy(false)
    setDialog(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/profile" label="Profile" />
      <header>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Settings and privacy</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Clear controls, no hidden defaults.</h1>
      </header>

      {notice && <p role="status" className="rounded-2xl border border-brand/20 bg-brand-soft/55 px-4 py-3 text-sm leading-relaxed text-foreground">{notice}</p>}

      <Section title="Profile">
        <Row title="Display name" detail="Used on your profile and on Community posts you choose to share.">
          <div className="flex items-center gap-2">
            <input
              value={displayName}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setDisplayName(event.target.value.slice(0, 40))}
              maxLength={40}
              aria-label="Display name"
              className="w-32 rounded-2xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 sm:w-40"
            />
            <button
              type="button"
              disabled={!nameChanged}
              onClick={() => setDialog("save-name")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-brand-foreground transition active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground"
              aria-label="Confirm display name change"
            >
              <Check className="h-5 w-5" strokeWidth={2.7} />
            </button>
          </div>
        </Row>
      </Section>

      <Section title="Notifications">
        <Row title="Tone" detail="Choose how future practice reminders are phrased.">
          <SelectControl
            value={state.settings.tone}
            onChange={(value) => updateSettings({ tone: value as "warm" | "minimal" })}
            options={[{ value: "warm", label: "Warm" }, { value: "minimal", label: "Minimal" }]}
            label="Notification tone"
          />
        </Row>
        <Row title="Frequency" detail="Save your preference for a connected notification service.">
          <SelectControl
            value={state.settings.frequency}
            onChange={(value) => updateSettings({ frequency: value as "daily" | "weekdays" | "off" })}
            options={[{ value: "daily", label: "Daily" }, { value: "weekdays", label: "Weekdays" }, { value: "off", label: "Off" }]}
            label="Notification frequency"
          />
        </Row>
      </Section>

      <Section title="Privacy and data">
        <div className="flex gap-3 rounded-2xl bg-brand-soft/45 p-4">
          <LockKeyhole className="h-5 w-5 shrink-0 text-accent-foreground" />
          <p className="text-sm leading-relaxed">Recordings are private by default. A story only appears in Community when you deliberately share it.</p>
        </div>
        <Row
          title="Personalize Weaver with past recordings"
          detail="When enabled, Weaver can privately use patterns from your transcripts, scores, strengths, and revisions to give more useful long-term coaching. Raw video is not sent as context."
        >
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={state.settings.aiOptIn}
              onChange={(event: ChangeEvent<HTMLInputElement>) => void updatePersonalization(event.target.checked)}
              className="peer sr-only"
            />
            <span className="h-7 w-12 rounded-full bg-secondary transition peer-checked:bg-brand after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
          </label>
        </Row>
        <Row title="Delete all recordings" detail="Remove every saved recording, transcript, grade, revision, and linked shared post.">
          <button type="button" onClick={() => setDialog("delete-recordings")} className="inline-flex items-center gap-1.5 rounded-full border border-destructive/55 bg-destructive/5 px-3.5 py-2.5 text-xs font-semibold text-destructive transition hover:border-destructive/75 hover:bg-destructive/10 active:scale-[0.98]">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </Row>
        <Row title="Delete all app data" detail="Erase all StoryTuner data stored on this device while keeping your login account.">
          <button type="button" onClick={() => setDialog("delete-all")} className="inline-flex items-center gap-1.5 rounded-full border border-destructive/55 bg-destructive/5 px-3.5 py-2.5 text-xs font-semibold text-destructive transition hover:border-destructive/75 hover:bg-destructive/10 active:scale-[0.98]">
            <Trash2 className="h-3.5 w-3.5" /> Delete all
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

      <Section title="Account">
        <Row title="Account email" detail="Used for secure login and never shown in Community.">
          <span className="max-w-40 truncate text-xs font-medium text-muted-foreground">{accountEmail || "Loading…"}</span>
        </Row>
        <Row title="Log out" detail="Sign out securely on this device.">
          <button type="button" onClick={() => setDialog("logout")} className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-destructive/90">
            <LogOut className="h-3.5 w-3.5" /> Log out
          </button>
        </Row>
      </Section>

      {dialogContent && (
        <ConfirmDialog
          open
          title={dialogContent.title}
          confirmLabel={dialogContent.confirm}
          tone={dialogContent.tone}
          busy={busy}
          onCancel={() => { if (!busy) setDialog(null) }}
          onConfirm={() => void confirmAction()}
        >
          {dialogContent.body}
        </ConfirmDialog>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="relative overflow-visible rounded-3xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-3 divide-y divide-border">{children}</div>
    </section>
  )
}

function Row({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <div className="relative flex items-center justify-between gap-4 py-4 first:pt-1 last:pb-1">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SelectControl({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; label: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    function closeFromOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", closeFromOutside)
    window.addEventListener("keydown", closeFromKeyboard)
    return () => {
      document.removeEventListener("mousedown", closeFromOutside)
      window.removeEventListener("keydown", closeFromKeyboard)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${open ? "z-50" : "z-0"}`}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-w-32 items-center justify-between gap-3 rounded-full border border-border bg-background py-2.5 pl-4 pr-3 text-sm font-medium outline-none transition hover:border-brand/45 focus:border-brand focus:ring-2 focus:ring-brand/15"
      >
        <span>{selected.label}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-40 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-[0_18px_44px_rgba(37,32,27,0.16)]"
        >
          {options.map((option) => {
            const active = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${active ? "bg-brand-soft font-semibold text-accent-foreground" : "text-foreground hover:bg-secondary"}`}
              >
                <span>{option.label}</span>
                {active && <Check className="h-4 w-4" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
