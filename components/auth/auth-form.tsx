"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Check, Loader2, ShieldCheck } from "lucide-react"
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
    const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&intent=${isSignUp ? "sign-up" : "sign-in"}`
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
        <p className="auth-eyebrow">StoryTuner account</p>
        <h1 className="auth-title">
          {isSignUp ? "Save your stories." : "Welcome back."}
        </h1>
        <p className="auth-subtitle">
          {isSignUp
            ? "Keep your progress, XP, recordings, and Parch with you across devices."
            : "Pick up exactly where you left off."}
        </p>
      </div>

      <div className="mt-5 flex justify-center">
        <div className="account-mode-switch" role="tablist" aria-label="Choose whether to sign up or log in">
          <button type="button" role="tab" aria-selected={isSignUp} onClick={() => chooseMode("sign-up")} className={isSignUp ? "is-active" : ""}>
            Sign up
          </button>
          <button type="button" role="tab" aria-selected={!isSignUp} onClick={() => chooseMode("sign-in")} className={!isSignUp ? "is-active" : ""}>
            Log in
          </button>
        </div>
      </div>

      {isSignUp && (
        <div className="auth-benefits" aria-label="What your account saves">
          {["Lesson progress and XP", "Recordings and feedback", "Your equipped Parch"].map((item) => (
            <div key={item} className="auth-benefit-row">
              <span className="auth-benefit-check"><Check className="h-3.5 w-3.5" strokeWidth={2.7} /></span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={continueWithGoogle}
        disabled={loading}
        className="auth-google-button"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span className="auth-google-mark" aria-hidden="true">G</span>
        )}
        {isSignUp ? "Continue with Google" : "Log in with Google"}
      </button>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive">
          {error}
        </p>
      )}

      <div className="auth-security-note">
        <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
        <span>Secure Google sign-in. No password to remember.</span>
      </div>
    </div>
  )
}
