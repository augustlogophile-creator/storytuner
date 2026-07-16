"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [shown, setShown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data }) => {
      const valid = Boolean(data.user)
      setSessionReady(valid)
      if (!valid) setError("This password-reset link is invalid or has expired. Request a new one.")
      setChecking(false)
    })
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sessionReady) return setError("This password-reset link is invalid or has expired. Request a new one.")
    setError("")
    if (password.length < 8) return setError("Use a password with at least 8 characters.")
    if (password !== confirm) return setError("The passwords do not match.")
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) return setError(updateError.message)
    router.replace("/home")
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Password label="New password" value={password} setValue={setPassword} shown={shown} toggle={() => setShown((value) => !value)} />
      <Password label="Confirm password" value={confirm} setValue={setConfirm} shown={shown} toggle={() => setShown((value) => !value)} />
      {error && <p role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive">{error}</p>}
      <button type="submit" disabled={checking || loading || !sessionReady} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {checking || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Save new password <ArrowRight className="h-4 w-4" /></>}
      </button>
    </form>
  )
}

function Password({ label, value, setValue, shown, toggle }: { label: string; value: string; setValue: (value: string) => void; shown: boolean; toggle: () => void }) {
  return (
    <label className="block">
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <div className="relative mt-2">
        <input type={shown ? "text" : "password"} value={value} onChange={(event) => setValue(event.target.value)} minLength={8} required autoComplete="new-password" className="auth-input pr-12" />
        <button type="button" onClick={toggle} aria-label={shown ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground">
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  )
}
