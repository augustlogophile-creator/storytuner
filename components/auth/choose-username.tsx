"use client"

import { useState, type FormEvent } from "react"
import { Check, Loader2, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useApp } from "@/lib/app-state"
import { validateUsername } from "@/lib/profile/public-name"
import { createClient } from "@/lib/supabase/client"

export function ChooseUsername({ email, destination }: { email: string; destination: string }) {
  const router = useRouter()
  const { completeOnboarding } = useApp()
  const [username, setUsername] = useState("")
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const isOfficialTellwiseAccount = email.trim().toLowerCase() === "tellwiseapp@gmail.com"
  const allowOfficialHandle = isOfficialTellwiseAccount && username.trim().toLowerCase() === "tellwise"

  const localError = username ? validateUsername(username, { allowReserved: allowOfficialHandle }) : ""
  const canContinue = Boolean(username && !localError && ageConfirmed && !loading)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const normalizedUsername = username.trim().toLowerCase()
    const validation = validateUsername(username, {
      allowReserved: isOfficialTellwiseAccount && normalizedUsername === "tellwise",
    })
    if (validation) return setError(validation)
    if (!ageConfirmed) return setError("Confirm that you are at least 13 to continue.")

    setLoading(true)
    try {
      const response = await fetch("/api/account/setup", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username, confirmedAge13Plus: true }),
      })
      const payload = await response.json() as { completed?: boolean; displayName?: string; error?: string }
      if (!response.ok || !payload.completed) throw new Error(payload.error || "Tellwise couldn't save that username.")

      completeOnboarding(payload.displayName)
      router.replace(destination)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tellwise couldn't save that username.")
      setLoading(false)
    }
  }

  async function signOut() {
    if (loading) return
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    document.documentElement.classList.remove("dark")
    document.documentElement.classList.add("light")
    router.replace("/sign-up?mode=sign-in")
    router.refresh()
  }

  return (
    <main className="entry-shell">
      <section className="auth-canvas">
        <div className="mx-auto w-full max-w-md px-1 py-2">
          <div className="pt-3 text-center">
            <p className="auth-eyebrow">Your Tellwise identity</p>
            <h1 className="auth-title mt-3">Choose your username.</h1>
            <p className="auth-subtitle mx-auto mt-3 max-w-sm">
              This is how other people will see you on Tellwise.
            </p>
          </div>

          <form onSubmit={submit} className="mt-14 space-y-9">
            <label className="block">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">Username</span>
              <div className="mt-5 flex items-center gap-2 border-b border-border/80 px-1 pb-3 transition-colors focus-within:border-foreground/45">
                <span className="select-none text-base text-muted-foreground">@</span>
                <input
                  value={username}
                  onChange={(event) => {
                    setError("")
                    setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))
                  }}
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="text"
                  maxLength={20}
                  aria-describedby="username-rules"
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[1.02rem] text-foreground outline-none ring-0 focus:outline-none focus:ring-0"
                  placeholder="your_username"
                />
                {username && !localError && <Check className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
              </div>
              <span id="username-rules" className="mt-3 block text-[0.72rem] leading-5 text-muted-foreground">
                3–20 characters. Lowercase letters, numbers, and underscores only.
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4.5 transition hover:border-foreground/15">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(event) => setAgeConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
              />
              <span className="text-sm leading-relaxed">I confirm that I am at least 13 years old.</span>
            </label>

            {(error || localError) && (
              <p role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive">
                {error || localError}
              </p>
            )}

            <button
              type="submit"
              disabled={!canContinue}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_rgba(38,34,29,0.12)] transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => void signOut()}
            disabled={loading}
            className="mx-auto mt-8 flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </section>
    </main>
  )
}
