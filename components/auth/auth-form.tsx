"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { safeInternalPath } from "@/lib/auth/redirects"
import { createClient } from "@/lib/supabase/client"

type Mode = "sign-in" | "sign-up"

export function AuthForm({ initialMode = "sign-up" }: { initialMode?: Mode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryMode: Mode = searchParams.get("mode") === "sign-in" ? "sign-in" : initialMode
  const [mode, setMode] = useState<Mode>(queryMode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const isSignUp = mode === "sign-up"

  useEffect(() => {
    setMode(searchParams.get("mode") === "sign-in" ? "sign-in" : initialMode)
    const queryError = searchParams.get("error")
    if (queryError) setError(queryError)
  }, [initialMode, searchParams])

  const next = useMemo(
    () => safeInternalPath(searchParams.get("next"), isSignUp ? "/onboarding" : "/home"),
    [isSignUp, searchParams],
  )

  function chooseMode(nextMode: Mode) {
    if (loading) return
    setMode(nextMode)
    setError("")
    const params = new URLSearchParams(searchParams.toString())
    if (nextMode === "sign-in") params.set("mode", "sign-in")
    else params.delete("mode")
    params.delete("error")
    const query = params.toString()
    router.replace(`/sign-up${query ? `?${query}` : ""}`, { scroll: false })
  }

  async function continueWithGoogle() {
    setError("")
    setLoading(true)
    const supabase = createClient()
    const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback },
    })
    if (authError) {
      setError(authError.message || "Google authentication could not start. Check the Supabase Google provider settings.")
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="text-center">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.17em] text-muted-foreground">StoryTuner account</p>
        <h1 className="mt-3 text-[2rem] font-semibold leading-[1.06] tracking-[-0.05em] text-balance">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-muted-foreground text-pretty">
          {isSignUp
            ? "Save your progress and continue securely with Google."
            : "Return to your lessons, recordings, and Weaver coaching."}
        </p>
      </div>

      <div className="mt-6 flex justify-center">
        <div className="account-mode-switch" role="tablist" aria-label="Choose whether to sign up or log in">
          <button type="button" role="tab" aria-selected={isSignUp} onClick={() => chooseMode("sign-up")} className={isSignUp ? "is-active" : ""}>
            Sign up
          </button>
          <button type="button" role="tab" aria-selected={!isSignUp} onClick={() => chooseMode("sign-in")} className={!isSignUp ? "is-active" : ""}>
            Log in
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={continueWithGoogle}
        disabled={loading}
        className="mt-7 flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-5 py-3.5 text-sm font-semibold shadow-[0_8px_22px_rgba(38,34,29,0.06)] transition hover:border-brand/35 hover:bg-secondary/45 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white text-xs font-bold text-[#4285f4]">G</span>
        )}
        Continue with Google
      </button>

      {error && (
        <p role="alert" className="mt-5 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive">
          {error}
        </p>
      )}

      <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">One secure sign-in method. No password to remember.</p>
    </div>
  )
}
