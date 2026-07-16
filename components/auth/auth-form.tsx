"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react"
import { safeInternalPath } from "@/lib/auth/redirects"
import { createClient } from "@/lib/supabase/client"

type Mode = "sign-in" | "sign-up"

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeInternalPath(searchParams.get("next"), mode === "sign-up" ? "/onboarding" : "/home")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState<"email" | "google" | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const isSignUp = mode === "sign-up"

  useEffect(() => {
    const queryError = searchParams.get("error")
    if (queryError) setError(queryError)
  }, [searchParams])

  async function continueWithGoogle() {
    setError("")
    setNotice("")
    setLoading("google")
    const supabase = createClient()
    const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback },
    })
    if (authError) {
      setError(authError.message || "Google sign-in could not start. Check the Supabase Google provider settings.")
      setLoading(null)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setNotice("")

    if (!email.trim()) return setError("Enter your email address.")
    if (password.length < 8) return setError("Use a password with at least 8 characters.")
    if (isSignUp && password !== confirmPassword) return setError("The passwords do not match.")

    setLoading("email")
    const supabase = createClient()

    if (isSignUp) {
      const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/onboarding")}`
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: callback },
      })
      if (authError) {
        setError(readableAuthError(authError.message))
        setLoading(null)
        return
      }
      if (data.session) {
        router.replace("/onboarding")
        router.refresh()
        return
      }
      setNotice("Check your email to verify your account, then return to StoryTuner.")
      setLoading(null)
      return
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (authError) {
      setError(readableAuthError(authError.message))
      setLoading(null)
      return
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={continueWithGoogle}
        disabled={loading !== null}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-5 py-3.5 text-sm font-semibold transition hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white text-xs font-bold text-[#4285f4]">G</span>}
        Continue with Google
      </button>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            className="auth-input"
          />
        </Field>
        <Field label="Password">
          <PasswordInput value={password} onChange={setPassword} shown={showPassword} toggle={() => setShowPassword((value) => !value)} autoComplete={isSignUp ? "new-password" : "current-password"} />
        </Field>
        {isSignUp && (
          <Field label="Confirm password">
            <PasswordInput value={confirmPassword} onChange={setConfirmPassword} shown={showPassword} toggle={() => setShowPassword((value) => !value)} autoComplete="new-password" />
          </Field>
        )}

        {!isSignUp && (
          <div className="text-right">
            <Link href="/forgot-password" className="text-xs font-semibold text-accent-foreground hover:underline">Forgot password?</Link>
          </div>
        )}

        {error && <p role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive">{error}</p>}
        {notice && <p role="status" className="rounded-2xl border border-brand/25 bg-brand-soft px-4 py-3 text-sm leading-relaxed text-accent-foreground">{notice}</p>}

        <button
          type="submit"
          disabled={loading !== null}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSignUp ? "Sign up" : "Log in"}
          {loading !== "email" && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "Don’t have an account?"}{" "}
        <Link
          href={`${isSignUp ? "/sign-in" : "/sign-up"}?next=${encodeURIComponent(next)}`}
          className="font-semibold text-accent-foreground hover:underline"
        >
          {isSignUp ? "Log in" : "Sign up"}
        </Link>
      </p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  )
}

function PasswordInput({ value, onChange, shown, toggle, autoComplete }: { value: string; onChange: (value: string) => void; shown: boolean; toggle: () => void; autoComplete: string }) {
  return (
    <div className="relative">
      <input
        type={shown ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        minLength={8}
        required
        className="auth-input pr-12"
      />
      <button type="button" onClick={toggle} aria-label={shown ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground">
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function readableAuthError(message: string) {
  const lowered = message.toLowerCase()
  if (lowered.includes("invalid login credentials")) return "That email and password combination was not recognized."
  if (lowered.includes("email not confirmed")) return "Verify your email before logging in."
  if (lowered.includes("user already registered")) return "An account already exists for this email. Try logging in instead."
  if (lowered.includes("rate limit")) return "Too many attempts. Wait a moment and try again."
  return message
}
