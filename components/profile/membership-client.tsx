"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Check, Clock3, Loader2 } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { FOUNDING_PRICE, FUTURE_PRICE, useApp } from "@/lib/app-state"

const rows = [
  { feature: "Storytelling lessons", detail: "Each lesson includes Learn, Check, and Practice.", free: "5 full lessons", member: "All 15 lessons" },
  { feature: "Spoken story reviews", detail: "A complete recording, transcript, grade, and revision.", free: "2 total", member: "Unlimited" },
  { feature: "Ask Parch", detail: "Coaching on ideas, structure, language, delivery, scores, and long-term growth.", free: "5 total messages", member: "Unlimited" },
  { feature: "Community", detail: "Share stories, respond, and learn from other members.", free: "Locked", member: "Full access" },
  { feature: "AI Story Planner", detail: "Shape your purpose, facts, structure, and delivery before you tell a story.", free: "Locked", member: "10 plans daily" },
]

export type MembershipStatus = {
  active: boolean
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

export function MembershipClient({ initialStatus, checkoutSuccess = false }: { initialStatus: MembershipStatus; checkoutSuccess?: boolean }) {
  const { setPremium } = useApp()
  const [status, setStatus] = useState<MembershipStatus>(initialStatus)
  const [busy, setBusy] = useState<"checkout" | "portal" | "cancel" | null>(null)
  const [renewalConsent, setRenewalConsent] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
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
      if (!renewalConsent) throw new Error("Confirm the automatic-renewal terms before continuing.")
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ renewalConsent: true }),
      })
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

  function downloadSubscriptionConfirmation() {
    const text = [
      "Tellwise Membership subscription acknowledgment",
      "",
      `Price: ${FOUNDING_PRICE} per year, billed annually.`,
      "Renewal: Automatically renews for another annual term until canceled.",
      "Cancellation: Profile > Membership > Cancel renewal, or use Manage billing.",
      "Support: tellwiseapp@gmail.com",
      `Saved: ${new Date().toISOString()}`,
    ].join("\n")
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "Tellwise-subscription-acknowledgment.txt"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async function cancelRenewal() {
    if (busy) return
    setBusy("cancel")
    setMessage("")
    try {
      const response = await fetch("/api/stripe/cancel", { method: "POST", headers: { Accept: "application/json" } })
      const result = await response.json() as { canceled?: boolean; currentPeriodEnd?: string | null; error?: string }
      if (!response.ok || !result.canceled) throw new Error(result.error || "Renewal could not be canceled.")
      setStatus((current) => ({ ...current, cancelAtPeriodEnd: true, currentPeriodEnd: result.currentPeriodEnd ?? current.currentPeriodEnd }))
      setCancelOpen(false)
      setMessage(result.currentPeriodEnd
        ? `Renewal canceled. Membership stays active through ${new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(result.currentPeriodEnd))}.`
        : "Renewal canceled. You will not be charged for another annual term.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Renewal could not be canceled.")
    } finally {
      setBusy(null)
    }
  }

  const active = status.active
  const renewalDate = status.currentPeriodEnd
    ? new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(status.currentPeriodEnd))
    : null
  const renewalDaysAway = status.currentPeriodEnd
    ? Math.ceil((new Date(status.currentPeriodEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null
  const showAnnualRenewalReminder = active
    && !status.cancelAtPeriodEnd
    && renewalDaysAway !== null
    && renewalDaysAway >= 15
    && renewalDaysAway <= 45

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BackLink href="/profile" label="Profile" />
      <header>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Founding membership</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">A lower price for the people who join first.</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">The first Tellwise members can unlock the full app for {FOUNDING_PRICE} a year and keep that founding price.</p>
      </header>

      {checkoutSuccess && (
        <section role="status" className="rounded-3xl border border-brand/35 bg-brand-soft/45 p-5">
          <p className="text-sm font-semibold">Membership purchase confirmed</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Your Tellwise Membership is {FOUNDING_PRICE} per year, billed annually, and automatically renews each year until canceled. Cancel future renewal from Profile → Membership → Cancel renewal.</p>
          <button type="button" onClick={downloadSubscriptionConfirmation} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background px-4 py-2.5 text-xs font-semibold">
            Save subscription acknowledgment
          </button>
        </section>
      )}

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
        <div className="grid grid-cols-[minmax(0,1fr)_4.55rem_4.55rem] sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2 border-b border-border px-4 py-3 text-[0.65rem] text-muted-foreground"><span>Feature</span><span className="text-center">Free</span><span className="text-center">Member</span></div>
        {rows.map((row) => (
          <div key={row.feature} className="grid min-w-0 grid-cols-[minmax(0,1fr)_4.55rem_4.55rem] sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-2 border-b border-border px-4 py-4 last:border-b-0">
            <div className="min-w-0 pr-1"><p className="text-sm font-medium text-foreground">{row.feature}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{row.detail}</p></div>
            <div className="flex justify-center">
              <span className="membership-plan-value membership-plan-value-free">{row.free}</span>
            </div>
            <div className="flex justify-center">
              <span className="membership-plan-value membership-plan-value-member">{row.member}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl bg-primary p-5 text-primary-foreground">
        <h2 className="text-lg font-semibold !text-[#fffdf8]">Tellwise Membership</h2>
        <div className="mt-4 space-y-2.5">
          {["The complete 15-lesson course", "Unlimited spoken story reviews", "Unlimited Parch craft coaching", "Full Community access", "AI Story Planner"].map((item) => <p key={item} className="flex items-center gap-2 text-sm text-primary-foreground/80"><Check className="h-4 w-4 shrink-0 text-brand" />{item}</p>)}
        </div>

        {active ? (
          <>
            <p className="mt-5 rounded-2xl bg-white/10 p-4 text-sm">
              Membership is active{status.cancelAtPeriodEnd ? renewalDate ? ` until ${renewalDate}.` : "." : renewalDate ? ` and renews on ${renewalDate}.` : "."}
            </p>
            {showAnnualRenewalReminder && (
              <div role="status" className="mt-3 rounded-2xl border border-white/25 bg-white/10 p-4 text-sm leading-6">
                <p className="font-semibold">Annual renewal reminder</p>
                <p className="mt-1 text-primary-foreground/85">Your Tellwise Membership is scheduled to renew for {FOUNDING_PRICE} for another year on {renewalDate}. Cancel renewal below if you do not want the next annual charge.</p>
              </div>
            )}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={openPortal} disabled={busy !== null} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-background px-5 py-3 text-sm font-semibold text-foreground disabled:opacity-60">
                {busy === "portal" && <Loader2 className="h-4 w-4 animate-spin" />} Manage billing
              </button>
              {!status.cancelAtPeriodEnd && (
                <button type="button" onClick={() => setCancelOpen(true)} disabled={busy !== null} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/35 px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  Cancel renewal
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/20 bg-white/5 text-primary-foreground/90">
              <div className="p-4 text-sm leading-6">
                <p>{FOUNDING_PRICE} billed annually. Renews automatically.</p>
                <p className="mt-1.5">Cancel anytime to stop future charges by going to Profile → Membership. Email tellwiseapp@gmail.com for help.</p>
              </div>
              <label className="group flex min-h-12 cursor-pointer items-center gap-3 border-t border-white/15 px-4 py-3 text-sm leading-5 text-primary-foreground/90">
                <input
                  type="checkbox"
                  checked={renewalConsent}
                  onChange={(event) => setRenewalConsent(event.target.checked)}
                  className="peer sr-only"
                />
                <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[0.38rem] border border-white/45 bg-white/5 text-transparent transition-colors duration-150 peer-checked:border-[#6f99c8] peer-checked:bg-[#4e79aa] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-white/45 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#302c27]">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span>I understand</span>
              </label>
            </div>
            <button type="button" onClick={openCheckout} disabled={busy !== null || !renewalConsent} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground disabled:opacity-50">
              {busy === "checkout" && <Loader2 className="h-4 w-4 animate-spin" />} Join for {FOUNDING_PRICE}/year
            </button>
          </>
        )}
        {message && <p role="status" className="mt-3 rounded-2xl bg-white/10 px-4 py-3 text-sm text-primary-foreground/90">{message}</p>}
        <p className="mt-3 text-center text-xs leading-5 text-primary-foreground/60">
          Secure checkout is handled by Stripe. <Link href="/terms" className="underline underline-offset-2">Terms</Link> · <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
        </p>
      </section>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel automatic renewal?"
        confirmLabel="Cancel renewal"
        tone="danger"
        busy={busy === "cancel"}
        onCancel={() => { if (busy !== "cancel") setCancelOpen(false) }}
        onConfirm={() => void cancelRenewal()}
      >
        Your membership will stay active through the current paid period, but Tellwise will not charge you for another annual term.
      </ConfirmDialog>
    </div>
  )
}
