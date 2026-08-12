"use client"

import { useMemo, useState, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Check, Loader2 } from "lucide-react"
import { Weaver } from "@/components/weaver"
import { useApp } from "@/lib/app-state"
import { safeInternalPath } from "@/lib/auth/redirects"
import {
  usernameSuggestionsFromEmail,
  validateDisplayName,
  validateUsername,
} from "@/lib/profile/public-name"
import { createClient } from "@/lib/supabase/client"

type InitialProfile = {
  username: string
  display_name: string
  confirmed_age_13_plus: boolean
} | null

export function AccountSetup({
  initialName,
  initialEmail,
  initialProfile,
}: {
  initialName: string
  initialEmail: string
  initialProfile: InitialProfile
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { completeOnboarding } = useApp()
  const recoveryMode = searchParams.get("mode") === "login-recovery"
  const suggestions = useMemo(() => usernameSuggestionsFromEmail(initialEmail), [initialEmail])
  const [username, setUsername] = useState(initialProfile?.username ?? suggestions[0] ?? "story_weaves")
  const [displayName, setDisplayName] = useState(initialProfile?.display_name ?? initialName)
  const [ageConfirmed, setAgeConfirmed] = useState(Boolean(initialProfile?.confirmed_age_13_plus))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    let cleanUsername = (recoveryMode && initialProfile?.username ? initialProfile.username : username).trim().toLowerCase()
    let cleanDisplayName = (recoveryMode && initialProfile?.display_name ? initialProfile.display_name : displayName).trim()

    const usernameError = validateUsername(cleanUsername)
    const displayNameError = validateDisplayName(cleanDisplayName)
    if (recoveryMode) {
      if (usernameError) cleanUsername = "story_weaves"
      if (displayNameError) cleanDisplayName = "Storyteller"
    } else {
      if (usernameError) return setError(usernameError)
      if (displayNameError) return setError(displayNameError)
    }
    if (!ageConfirmed) return setError("You must confirm that you are at least 13 to use StoryTuner.")

    setLoading(true)
    const supabase = createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      setLoading(false)
      return setError("Your session expired. Log in again to finish setting up your profile.")
    }

    let finalUsername = cleanUsername
    let { error: profileError } = await supabase.from("profiles").upsert({
      id: userData.user.id,
      username: finalUsername,
      display_name: cleanDisplayName,
      confirmed_age_13_plus: true,
      onboarding_completed: true,
    }, { onConflict: "id" })

    if (profileError?.code === "23505" && recoveryMode && !initialProfile) {
      const fallbackUsernames = [
        ...suggestions.slice(1),
        `story_${userData.user.id.replace(/-/g, "").slice(0, 10)}`,
      ]
      for (const candidate of fallbackUsernames) {
        const normalized = candidate.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24)
        if (validateUsername(normalized)) continue
        const result = await supabase.from("profiles").upsert({
          id: userData.user.id,
          username: normalized,
          display_name: cleanDisplayName,
          confirmed_age_13_plus: true,
          onboarding_completed: true,
        }, { onConflict: "id" })
        profileError = result.error
        if (!profileError) {
          finalUsername = normalized
          break
        }
        if (profileError.code !== "23505") break
      }
    }

    if (profileError) {
      setLoading(false)
      if (profileError.code === "23505") return setError(recoveryMode ? "StoryTuner could not restore your public username automatically. Try logging in again." : "That username is already taken. Try another one.")
      if (profileError.code === "23514" || profileError.message.toLowerCase().includes("public name")) {
        return setError("Choose a different public name. Vulgar, sexual, hateful, or harassing terms are not allowed.")
      }
      return setError("StoryTuner could not save your profile. Check that the newest Supabase profile migration has been applied, then try again.")
    }

    setUsername(finalUsername)
    completeOnboarding(cleanDisplayName)
    const destination = safeInternalPath(searchParams.get("next"), "/home")
    router.replace(destination === "/onboarding" ? "/home" : destination)
    router.refresh()
  }

  return (
    <main className="entry-shell">
      <section className="auth-canvas">
        <div className="mx-auto w-full max-w-md">
          <div className="flex justify-center"><Weaver colorId="classic" size={90} /></div>
          <span className="mx-auto mt-5 flex h-11 w-11 items-center justify-center rounded-full border border-brand/15 bg-brand-soft text-accent-foreground shadow-[0_10px_28px_-12px_color-mix(in_oklch,var(--brand)_55%,transparent)]"><Check className="h-5 w-5" /></span>
          <p className="mt-6 text-center font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">{recoveryMode ? "Account confirmation" : "Profile setup"}</p>
          <h1 className="text-editorial mx-auto mt-4 max-w-sm text-center text-[2.65rem] text-balance sm:text-[3rem]">{recoveryMode ? "Welcome back." : "Choose how you appear in StoryTuner."}</h1>
          <p className="mx-auto mt-4 max-w-sm text-center text-[0.95rem] leading-7 text-muted-foreground">{recoveryMode ? "Your existing StoryTuner identity will stay exactly the same. Confirm the age requirement once to continue." : "Your public name is separate from the email you use to log in."}</p>

          <form onSubmit={finish} className="mt-8 space-y-5">
            {!recoveryMode && <label className="block">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">Public username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24))}
                placeholder={suggestions[0] ?? "story_weaves"}
                autoComplete="username"
                className="auth-input mt-2"
              />
            </label>}
            {!recoveryMode && suggestions.length > 1 && (
              <div className="-mt-2 flex flex-wrap gap-2" aria-label="Suggested usernames">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setUsername(suggestion)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${username === suggestion ? "border-brand bg-brand-soft text-accent-foreground" : "border-border bg-background text-muted-foreground hover:border-brand/40"}`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {!recoveryMode && <label className="block">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">Display name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value.slice(0, 40))}
                placeholder="Your first name or nickname"
                autoComplete="name"
                className="auth-input mt-2"
              />
            </label>}
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4 transition hover:border-brand/35">
              <input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
              <span className="text-sm leading-relaxed">I confirm that I am at least 13 years old.</span>
            </label>

            {error && <p role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="press flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_rgb(48_45_42_/_0.12)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enter StoryTuner <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
