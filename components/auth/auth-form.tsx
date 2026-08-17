"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { safeInternalPath, siteUrl } from "@/lib/auth/redirects"
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

  useEffect(() => {
    const modeQuery = isSignUp ? "" : "&mode=sign-in"
    router.prefetch(`/terms?from=auth${modeQuery}`)
    router.prefetch(`/privacy?from=auth${modeQuery}`)
  }, [isSignUp, router])

  const next = useMemo(
    () => safeInternalPath(searchParams.get("next"), "/home"),
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
    const callback = `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}&intent=${isSignUp ? "sign-up" : "sign-in"}`
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

      <div className="auth-sync-message" aria-label="What your account saves">
        Your progress, recordings, and streaks, all saved and synced.
      </div>

      <button
        type="button"
        onClick={continueWithGoogle}
        disabled={loading}
        className="auth-google-button"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleMark />
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

      <p className="auth-legal-note">
        By continuing, you agree to the{" "}
        <Link prefetch href={isSignUp ? "/terms?from=auth" : "/terms?from=auth&mode=sign-in"}>Terms of Service</Link>
        {" "}and acknowledge the{" "}
        <Link prefetch href={isSignUp ? "/privacy?from=auth" : "/privacy?from=auth&mode=sign-in"}>Privacy Policy</Link>.
      </p>
    </div>
  )
}


function GoogleMark() {
  return (
    <span className="auth-google-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" role="img">
        <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.39a4.61 4.61 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.97-4.33 2.97-7.36Z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.97-.89 6.63-2.41l-3.24-2.51c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.41 13.92A6.03 6.03 0 0 1 6.1 12c0-.67.11-1.31.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.39 3.13 1.07 4.51l3.34-2.59Z" />
        <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z" />
      </svg>
    </span>
  )
}
