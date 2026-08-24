"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { Bell, Check, ChevronDown, ChevronRight, Cloud, CloudOff, LoaderCircle, LogOut, LockKeyhole, Trash2 } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useApp } from "@/lib/app-state"
import { useNotificationUnread } from "@/components/notifications/use-notification-unread"
import { validateDisplayName } from "@/lib/profile/public-name"
import { createClient } from "@/lib/supabase/client"
import { clearMedia } from "@/lib/media-store"
import { useRouter } from "next/navigation"
import { CinematicThemeSwitcher } from "@/components/ui/cinematic-theme-switcher"

type DialogKind = "save-name" | "logout" | "delete-recordings" | "delete-all" | "delete-account" | null

export function SettingsClient({ username }: { username: string }) {
  const router = useRouter()
  const { state, syncStatus, updateSettings, updateProfileName, deleteAllRecordings, resetAll } = useApp()
  const notificationsUnread = useNotificationUnread({ userId: state.accountOwnerId, streak: state.streak, activityDates: state.activityDates })
  const [displayName, setDisplayName] = useState(state.profile.name.slice(0, 15))
  const [accountEmail, setAccountEmail] = useState("")
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")

  const cleanDisplayName = displayName.trim().slice(0, 15)
  const nameChanged = cleanDisplayName.length > 0 && cleanDisplayName !== state.profile.name
  const displayNameError = notice.startsWith("Choose a different display name.") || notice.startsWith("Display names can") || notice.startsWith("Display names must")

  useEffect(() => setDisplayName(state.profile.name.slice(0, 15)), [state.profile.name])

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
      title: "Log out of Tellwise?",
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
      title: "Delete all Tellwise data?",
      body: <>This erases your Tellwise content, progress, XP, Parch purchases, settings, recordings, Planner history, and Community activity across devices. Your login, billing connection, free-usage limits, and safety records remain. <strong className="font-semibold text-foreground">This cannot be reversed.</strong></>,
      confirm: "Delete all data",
      tone: "danger" as const,
    }
    if (dialog === "delete-account") return {
      title: "Permanently delete your account?",
      body: <>This permanently deletes your Tellwise login, profile, progress, recordings, Community activity, Planner history, usage history, and linked billing customer. Any active Tellwise subscription is canceled immediately. <strong className="font-semibold text-foreground">This cannot be undone.</strong></>,
      confirm: "Delete account permanently",
      tone: "danger" as const,
    }
    return null
  }, [cleanDisplayName, dialog])

  const saveDisplayName = useCallback(async () => {
    if (!nameChanged) return setDialog(null)
    const validationError = validateDisplayName(cleanDisplayName)
    if (validationError) {
      setDialog(null)
      setNotice(validationError)
      return
    }
    setBusy(true)
    setNotice("")
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ displayName: cleanDisplayName }),
    })
    const payload = await response.json().catch(() => ({})) as { saved?: boolean; displayName?: string; error?: string }
    if (!response.ok || !payload.saved) {
      setBusy(false)
      setDialog(null)
      return setNotice(payload.error || "Tellwise could not update your account profile. Try again.")
    }
    updateProfileName(payload.displayName || cleanDisplayName)
    setBusy(false)
    setDialog(null)
    setNotice("Display name updated.")
  }, [cleanDisplayName, nameChanged, updateProfileName])

  const logOut = useCallback(async () => {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    document.documentElement.classList.remove("dark")
    document.documentElement.classList.add("light")
    router.replace("/sign-up?mode=sign-in")
    router.refresh()
  }, [router])

  async function confirmAction() {
    if (dialog === "save-name") return void saveDisplayName()
    if (dialog === "logout") return void logOut()
    setBusy(true)
    setNotice("")
    try {
      if (dialog === "delete-recordings") {
        const response = await fetch("/api/account/data", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ scope: "recordings" }),
        })
        const payload = await response.json() as { deleted?: boolean; error?: string }
        if (!response.ok || !payload.deleted) throw new Error(payload.error || "Tellwise could not delete the recordings.")
        await deleteAllRecordings({ skipCloud: true })
        setNotice("All recordings and recording-derived Community posts were deleted across devices.")
      }
      if (dialog === "delete-all") {
        const response = await fetch("/api/account/data", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ scope: "app_data" }),
        })
        const payload = await response.json() as { deleted?: boolean; error?: string; failedStep?: string }
        if (!response.ok || !payload.deleted) throw new Error(payload.error || (payload.failedStep ? `Tellwise could not delete your app data during ${payload.failedStep}.` : "Tellwise could not delete your app data."))
        await resetAll({ skipCloud: true, skipRemoteState: true })
        setNotice("Your Tellwise content and progress were deleted across devices. Your login, billing, usage limits, and safety records remain.")
      }
      if (dialog === "delete-account") {
        const response = await fetch("/api/account/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ confirmation: "DELETE" }),
        })
        const payload = await response.json() as { deleted?: boolean; error?: string }
        if (!response.ok || !payload.deleted) throw new Error(payload.error || "Tellwise could not delete the account.")

        await clearMedia().catch(() => undefined)
        try {
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith("storytuner")) localStorage.removeItem(key)
          }
          sessionStorage.clear()
        } catch {}
        const supabase = createClient()
        await supabase.auth.signOut().catch(() => undefined)
        setDialog(null)
        router.replace("/?accountDeleted=1")
        router.refresh()
        return
      }
      setDialog(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Tellwise could not finish deleting your data. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/profile" label="Profile" />
      <header>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Settings and privacy</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Clear controls, no hidden defaults.</h1>
      </header>

      <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        {syncStatus === "syncing" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : syncStatus === "offline" || syncStatus === "error" ? <CloudOff className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
        <span>{syncStatus === "syncing" ? "Syncing progress…" : syncStatus === "saved" ? "Progress saved across devices" : syncStatus === "offline" ? "Offline. Changes will sync later." : syncStatus === "error" ? "Progress sync needs attention" : "Progress is saved on this device"}</span>
      </div>

      {notice && <p role="status" className={displayNameError ? "rounded-2xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm leading-relaxed text-destructive" : "rounded-2xl border border-brand/20 bg-brand-soft/55 px-4 py-3 text-sm leading-relaxed text-foreground"}>{notice}</p>}

      <Section title="Profile">
        <Row title="Username" detail="Your public Tellwise identity. This is what other members see.">
          <span className="rounded-full bg-secondary px-3 py-2 text-xs font-semibold text-foreground">@{username}</span>
        </Row>
        <Row title="Display name" detail="Used for personal greetings inside Tellwise. Your @username is your public identity.">
          <div className="flex items-center gap-2">
            <input
              value={displayName}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setDisplayName(event.target.value.slice(0, 15))}
              maxLength={15}
              aria-label="Display name"
              aria-describedby="display-name-limit"
              className="w-32 rounded-2xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 sm:w-40"
            />
            <span id="display-name-limit" className="sr-only">Maximum 15 characters.</span>
            <button
              type="button"
              disabled={!nameChanged || busy}
              onClick={() => setDialog("save-name")}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition ${nameChanged && !busy ? "bg-brand text-brand-foreground active:scale-[0.97]" : "cursor-not-allowed bg-[#c8c4bd] text-white"}`}
              aria-label="Confirm display name change"
            >
              <Check className="h-5 w-5" strokeWidth={2.7} />
            </button>
          </div>
        </Row>
      </Section>

      <Section title="Appearance">
        <Row title="Color theme" detail="Paper or dark reading mode.">
          <CinematicThemeSwitcher />
        </Row>
      </Section>

      <Section title="Notifications">
        <Link href="/notifications" prefetch className="group flex items-center justify-between gap-4 py-4 first:pt-1">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Bell className="h-4 w-4" />
              {notificationsUnread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-brand" aria-label="New notifications" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Notification center</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Replies, likes, and streaks.</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Row title="Tone" detail="Reminder style.">
          <SelectControl
            value={state.settings.tone}
            onChange={(value) => updateSettings({ tone: value as "warm" | "minimal" })}
            options={[{ value: "warm", label: "Warm" }, { value: "minimal", label: "Minimal" }]}
            label="Notification tone"
          />
        </Row>
        <Row title="Frequency" detail="Reminder schedule.">
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
        <Row title="Delete all recordings" detail="Remove every saved recording, transcript, grade, revision, and linked shared post.">
          <button type="button" onClick={() => setDialog("delete-recordings")} className="inline-flex items-center gap-1.5 rounded-full border border-destructive/55 bg-destructive/5 px-3.5 py-2.5 text-xs font-semibold text-destructive transition hover:border-destructive/75 hover:bg-destructive/10 active:scale-[0.98]">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </Row>
        <Row title="Delete all app data" detail="Erase your Tellwise content and progress across devices while keeping your login and billing account.">
          <button type="button" onClick={() => setDialog("delete-all")} className="inline-flex items-center gap-1.5 rounded-full border border-destructive/55 bg-destructive/5 px-3.5 py-2.5 text-xs font-semibold text-destructive transition hover:border-destructive/75 hover:bg-destructive/10 active:scale-[0.98]">
            <Trash2 className="h-3.5 w-3.5" /> Delete all
          </button>
        </Row>
        <Row title="Delete account permanently" detail="Delete your login and all Tellwise data. Any active Tellwise subscription is canceled first.">
          <button type="button" onClick={() => setDialog("delete-account")} className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-destructive/90 active:scale-[0.98]">
            <Trash2 className="h-3.5 w-3.5" /> Delete account
          </button>
        </Row>
      </Section>



      <Link href="/membership" className="flex items-center gap-3 rounded-3xl border border-border bg-card p-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{state.premium ? "Tellwise Membership is active" : "Free plan"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Review the $5.99/month and $60/year Membership plans.</p>
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
