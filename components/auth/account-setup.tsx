"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Check, Loader2 } from "lucide-react"
import { Weaver } from "@/components/weaver"
import { useApp } from "@/lib/app-state"
import { safeInternalPath } from "@/lib/auth/redirects"
import { createClient } from "@/lib/supabase/client"

type InitialProfile = {
  username: string
  display_name: string
  confirmed_age_13_plus: boolean
} | null

export function AccountSetup({ initialName, initialProfile }: { initialName: string; initialProfile: InitialProfile }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state, ready, completeOnboarding } = useApp()
  const [username, setUsername] = useState(initialProfile?.username ?? "")
  const [displayName, setDisplayName] = useState(initialProfile?.display_name ?? initialName)
  const [ageConfirmed, setAgeConfirmed] = useState(Boolean(initialProfile?.confirmed_age_13_plus))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!ready || initialProfile?.display_name) return
    if (state.profile.name !== "Storyteller") setDisplayName(state.profile.name)
  }, [initialProfile?.display_name, ready, state.profile.name])

  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const cleanUsername = username.trim().toLowerCase()
    const cleanDisplayName = displayName.trim()

    if (!/^[a-z0-9][a-z0-9_]{2,23}$/.test(cleanUsername)) {
      return setError("Use 3–24 lowercase letters, numbers, or underscores. Start with a letter or number.")
    }
    if (!cleanDisplayName) return setError("Enter a display name.")
    if (!ageConfirmed) return setError("You must confirm that you are at least 13 to use StoryTuner.")

    setLoading(true)
    const supabase = createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      setLoading(false)
      return setError("Your session expired. Log in again to finish setting up your profile.")
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userData.user.id,
      username: cleanUsername,
      display_name: cleanDisplayName,
      confirmed_age_13_plus: true,
      onboarding_completed: true,
    }, { onConflict: "id" })

    if (profileError) {
      setLoading(false)
      if (profileError.code === "23505") return setError("That username is already taken. Try another one.")
      return setError("StoryTuner could not save your profile. Check that the Supabase profile migration has been applied, then try again.")
    }

    completeOnboarding(cleanDisplayName)
    const destination = safeInternalPath(searchParams.get("next"), "/home")
    router.replace(destination === "/onboarding" ? "/home" : destination)
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:flex sm:items-center sm:justify-center">
      <section className="mx-auto w-full max-w-sm rounded-[2rem] border border-border bg-card p-6 shadow-xl">
        <div className="flex justify-center"><Weaver size={82} /></div>
        <span className="mx-auto mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-accent-foreground"><Check className="h-5 w-5" /></span>
        <p className="mt-5 text-center font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Profile setup</p>
        <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight">Choose how you appear in StoryTuner.</h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">Your username is public in Community. It is separate from the email you use to log in.</p>

        <form onSubmit={finish} className="mt-6 space-y-4">
          <label className="block">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">Public username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24))}
              placeholder="august_stories"
              autoComplete="username"
              className="auth-input mt-2"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">Display name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value.slice(0, 40))}
              placeholder="Your first name or nickname"
              autoComplete="name"
              className="auth-input mt-2"
            />
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4">
            <input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
            <span className="text-sm leading-relaxed">I confirm that I am at least 13 years old.</span>
          </label>

          {error && <p role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={!ready || loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enter StoryTuner <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>
      </section>
    </main>
  )
}
