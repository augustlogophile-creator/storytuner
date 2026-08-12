"use client"

import { useEffect, useState } from "react"
import { Check, Clock3, Loader2 } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { FOUNDING_PRICE, FUTURE_PRICE, useApp } from "@/lib/app-state"

const rows = [
  { feature: "Storytelling lessons", detail: "Each lesson includes Learn, Check, and Practice.", free: "5 full lessons", member: "All 15 lessons" },
  { feature: "Spoken story reviews", detail: "A complete recording, transcript, grade, and revision.", free: "2 total", member: "Unlimited" },
  { feature: "Ask Weaver", detail: "Coaching on ideas, structure, language, delivery, scores, and long-term growth.", free: "5 total messages", member: "Unlimited" },
  { feature: "Community", detail: "Share stories, respond, and learn from other members.", free: "Locked", member: "Full access" },
  { feature: "AI Story Planner", detail: "Shape your purpose, facts, structure, and delivery before you tell a story.", free: "Locked", member: "10 plans daily" },
]

export type MembershipStatus = {
  active: boolean
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

export function MembershipClient({ initialStatus }: { initialStatus: MembershipStatus }) {
  const { setPremium } = useApp()
  const [status, setStatus] = useState<MembershipStatus>(initialStatus)
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    setPremium(initialStatus.active)
    fetch("/api/membership", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<MembershipStatus> : null)
      .then((result) => {
        if (!result) return
        setStatus(result)
        setPremium(result.active)
      })
      .catch(() => {
        // Keep the server-rendered membership status instead of flashing the free plan.
      })
  }, [initialStatus.active, setPremium])

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

  const active = status.active
  const renewalDate = status.currentPeriodEnd
    ? new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(status.currentPeriodEnd))
    : null

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <BackLink href="/profile" label="Profile" />
      <header className="app-page-enter">
        <p className="text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Founding membership</p>
        <h1 className="text-title mt-2.5 text-[1.78rem] leading-[1.03] text-balance">Full StoryTuner. Founding price.</h1>
        <p className="mt-2 max-w-[24rem] text-[0.82rem] leading-6 text-muted-foreground text-pretty">Unlock the complete StoryTuner experience for {FOUNDING_PRICE} a year. Founding members keep that price as long as the membership stays active.</p>
      </header>

      <section className="overflow-hidden rounded-[1.35rem] border border-brand/15 bg-brand-soft/65 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.56rem] font-semibold uppercase tracking-[0.11em] text-accent-foreground">Founding offer</p>
            <p className="text-display mt-1.5 text-[1.72rem] text-foreground">{FOUNDING_PRICE}<span className="ml-1 text-sm font-medium text-muted-foreground">/ year</span></p>
            <p className="mt-2 max-w-[24rem] text-[0.82rem] leading-6 text-muted-foreground">Planned public price: {FUTURE_PRICE} per year. Founding members keep the lower annual rate.</p>
          </div>
          <Clock3 className="h-5 w-5 shrink-0 text-accent-foreground" />
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.3rem] border border-border bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2 border-b border-border px-4 py-3 text-[0.65rem] text-muted-foreground"><span>Feature</span><span className="text-center">Free</span><span className="text-center">Member</span></div>
        {rows.map((row) => (
          <div key={row.feature} className="grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-2 border-b border-border px-3.5 py-3 last:border-b-0">
            <div className="min-w-0 pr-1"><p className="text-[0.8rem] font-medium text-foreground">{row.feature}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{row.detail}</p></div>
            <p className="text-center text-xs leading-snug text-muted-foreground"><strong className="font-semibold text-foreground">{row.free}</strong></p>
            <p className="text-center text-xs leading-snug text-muted-foreground"><strong className="font-semibold text-accent-foreground">{row.member}</strong></p>
          </div>
        ))}
      </section>

      <section className="relative overflow-hidden rounded-[1.35rem] bg-primary p-4 text-primary-foreground shadow-[0_24px_60px_-30px_color-mix(in_oklch,var(--primary)_85%,transparent)]">
        <div className="hatch-texture pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />
        <div className="relative">
        <h2 className="text-title text-[1.15rem]">StoryTuner Membership</h2>
        <div className="mt-4 space-y-2.5">
          {["The complete 15-lesson course", "Unlimited spoken story reviews", "Unlimited Weaver craft coaching", "Full Community access", "AI Story Planner"].map((item) => <p key={item} className="flex items-center gap-2 text-[0.8rem] text-primary-foreground/75"><Check className="h-4 w-4 shrink-0 text-brand" />{item}</p>)}
        </div>

        {active ? (
          <>
            <p className="mt-5 rounded-xl bg-white/[0.07] p-3.5 text-[0.78rem]">
              Membership is active{status.cancelAtPeriodEnd ? renewalDate ? ` until ${renewalDate}.` : "." : renewalDate ? ` and renews on ${renewalDate}.` : "."}
            </p>
            <button type="button" onClick={openPortal} disabled={busy !== null} className="press mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-background px-4 py-2.5 text-[0.76rem] font-medium text-foreground disabled:opacity-60">
              {busy === "portal" && <Loader2 className="h-4 w-4 animate-spin" />} Manage billing
            </button>
          </>
        ) : (
          <button type="button" onClick={openCheckout} disabled={busy !== null} className="press mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-[0.76rem] font-medium text-brand-foreground shadow-[0_10px_24px_-10px_color-mix(in_oklch,var(--brand)_75%,transparent)] hover:brightness-105 disabled:opacity-60">
            {busy === "checkout" && <Loader2 className="h-4 w-4 animate-spin" />} Join for {FOUNDING_PRICE}/year
          </button>
        )}
        {message && <p className="mt-3 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-100">{message}</p>}
        <p className="mt-3 text-center text-xs text-primary-foreground/55">Secure checkout and billing are handled by Stripe.</p>
        </div>
      </section>
    </div>
  )
}
