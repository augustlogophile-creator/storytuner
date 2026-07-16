"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setLoading(false)
    setMessage(error ? error.message : "If an account exists for that email, a reset link is on its way.")
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">Email</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="auth-input mt-2" />
      </label>
      {message && <p role="status" className="rounded-2xl border border-border bg-secondary/45 px-4 py-3 text-sm leading-relaxed">{message}</p>}
      <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send reset link <ArrowRight className="h-4 w-4" /></>}
      </button>
      <p className="text-center text-sm text-muted-foreground"><Link href="/sign-in" className="font-semibold text-accent-foreground hover:underline">Back to login</Link></p>
    </form>
  )
}
