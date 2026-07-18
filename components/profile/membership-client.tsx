"use client"

import { useEffect, useState } from "react"
import { Check, Clock3, Loader2 } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { FOUNDING_PRICE, FUTURE_PRICE, useApp } from "@/lib/app-state"

const rows = [
  { feature: "Storytelling lessons", detail: "Each lesson includes Learn, Practice, and Check.", free: "5 full lessons", member: "All 15 lessons" },
  { feature: "Spoken story reviews", detail: "A complete recording, transcript, grade, and revision.", free: "2 total", member: "Unlimited" },
  { feature: "Ask Weaver", detail: "Coaching on ideas, structure, language, delivery, scores, and long-term growth.", free: "5 total messages", member: "Unlimited" },
  { feature: "Community", detail: "Share stories, respond, and learn from other members.", free: "Locked", member: "Full access" },
]

type MembershipStatus = {
  active: boolean
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

export function MembershipClient() {
  const { state, setPremium } = useApp()
  const [status, setStatus] = useState<MembershipStatus | null>(null)
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/membership", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<MembershipStatus> : null)
      .then((result) => {
        if (!result) return
        setStatus(result)
        setPremium(result.active)
      })
      .catch(() => setMessage("Membership status could not be refreshed right now."))
  }, [setPremium])

  async function openCheckout() {
    setBusy("checkout")
    setMessage("")
    try {
      const response = await fetch("/api/stripe/checkout", { method: "POST" })
      const result = await response.json() as { url?: string; error?: string; code?: string }
      if (result.code === "ALREADY_ACTIVE") {
        await openPortal()
        return
      }
      if (!response.ok || !result.url) throw new Error(result.error || "Checkout could not be opened.")
      window.location.assign(result.url)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout could not be opened.")
      setBusy(null)
    }
  }

  async function openPortal() {
    setBusy("portal")
    setMessage("")
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" })
      const result = await response.json() as { url?: string; error?: string }
      if (!response.ok || !result.url) throw new Error(result.error || "Billing settings could not be opened.")
      window.location.assign(result.url)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Billing settings could not be opened.")
      setBusy(null)
    }
  }

  const active = status?.active ?? state.premium
  const renewalDate = status?.currentPeriodEnd
    ? new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(status.currentPeriodEnd))
    : null

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BackLink href="/profile" label="Profile" />
      <header>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Founding membership</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">A lower price for the people who join first.</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">The first StoryTuner members can unlock the full app for {FOUNDING_PRICE} a year and keep that founding price.</p>
      </header>

      <section className="overflow-hidden rounded-3xl border border-brand/30 bg-brand-soft/35 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-accent-foreground">Founding offer</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{FOUNDING_PRICE}<span className="ml-1 text-sm font-medium text-muted-foreground">/ year</span></p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Later public price: {FUTURE_PRICE} per year. Founding members keep the lower price.</p>
          </div>
          <Clock3 className="h-5 w-5 shrink-0 text-accent-foreground" />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2 border-b border-border px-4 py-3 text-[0.65rem] text-muted-foreground"><span>Feature</span><span className="text-center">Free</span><span className="text-center">Member</span></div>
        {rows.map((row) => (
          <div key={row.feature} className="grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-2 border-b border-border px-4 py-4 last:border-b-0">
            <div className="min-w-0 pr-1"><p className="text-sm font-medium text-foreground">{row.feature}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{row.detail}</p></div>
            <p className="text-center text-xs leading-snug text-muted-foreground"><strong className="font-semibold text-foreground">{row.free}</strong></p>
            <p className="text-center text-xs leading-snug text-muted-foreground"><strong className="font-semibold text-accent-foreground">{row.member}</strong></p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl bg-primary p-5 text-primary-foreground">
        <h2 className="text-lg font-semibold">StoryTuner Membership</h2>
        <div className="mt-4 space-y-2.5">
          {["The complete 15-lesson course", "Unlimited spoken story reviews", "Unlimited Weaver craft coaching", "Full Community access"].map((item) => <p key={item} className="flex items-center gap-2 text-sm text-primary-foreground/80"><Check className="h-4 w-4 shrink-0 text-brand" />{item}</p>)}
        </div>

        {active ? (
          <>
            <p className="mt-5 rounded-2xl bg-white/10 p-4 text-sm">
              Membership is active{status?.cancelAtPeriodEnd ? renewalDate ? ` until ${renewalDate}.` : "." : renewalDate ? ` and renews on ${renewalDate}.` : "."}
            </p>
            <button type="button" onClick={openPortal} disabled={busy !== null} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-background px-5 py-3 text-sm font-semibold text-foreground disabled:opacity-60">
              {busy === "portal" && <Loader2 className="h-4 w-4 animate-spin" />} Manage billing
            </button>
          </>
        ) : (
          <button type="button" onClick={openCheckout} disabled={busy !== null} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground disabled:opacity-60">
            {busy === "checkout" && <Loader2 className="h-4 w-4 animate-spin" />} Join for {FOUNDING_PRICE}/year
          </button>
        )}
        {message && <p className="mt-3 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-100">{message}</p>}
        <p className="mt-3 text-center text-xs text-primary-foreground/55">Secure checkout and billing are handled by Stripe.</p>
      </section>
    </div>
  )
}
