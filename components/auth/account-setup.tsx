"use client"

import { useState, type FormEvent } from "react"
import { Check, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useApp } from "@/lib/app-state"
import { safeInternalPath } from "@/lib/auth/redirects"

/**
 * Legacy account recovery only. New accounts use /choose-username.
 * Existing users who already own a username never have to choose it again.
 */
export function AccountSetup() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { completeOnboarding } = useApp()
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (!ageConfirmed) return setError("Confirm that you are at least 13 to continue.")

    setLoading(true)
    try {
      const response = await fetch("/api/account/setup", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ confirmedAge13Plus: true }),
      })
      const payload = await response.json() as { completed?: boolean; displayName?: string; error?: string }
      if (!response.ok || !payload.completed) throw new Error(payload.error || "StoryTuner couldn't finish your account setup.")

      completeOnboarding(payload.displayName)
      const destination = safeInternalPath(searchParams.get("next"), "/home")
      router.replace(destination === "/onboarding" ? "/home" : destination)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "StoryTuner couldn't finish your account setup.")
      setLoading(false)
    }
  }

  return (
    <main className="entry-shell">
      <section className="auth-canvas">
        <div className="mx-auto w-full max-w-md">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm">
            <Check className="h-4 w-4" />
          </span>
          <p className="mt-6 text-center font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Account confirmation</p>
          <h1 className="mx-auto mt-3 max-w-sm text-center text-[2rem] font-semibold leading-[1.08] tracking-[-0.045em] text-balance">Welcome back.</h1>
          <p className="mx-auto mt-4 max-w-sm text-center text-[0.95rem] leading-7 text-muted-foreground">
            Your existing username stays exactly the same. Confirm the age requirement once to continue.
          </p>

          <form onSubmit={finish} className="mt-8 space-y-5">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4 transition hover:border-foreground/15">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(event) => setAgeConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
              />
              <span className="text-sm leading-relaxed">I confirm that I am at least 13 years old.</span>
            </label>

            {error && <p role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={loading || !ageConfirmed}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_rgba(38,34,29,0.12)] transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
