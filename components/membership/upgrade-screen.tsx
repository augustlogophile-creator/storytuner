"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Check, Loader2, Lock } from "lucide-react"
import { PricingInteraction, type MembershipPlanChoice } from "@/components/ui/pricing-interaction"

export type UpgradeReason = "general" | "lessons" | "studio" | "community" | "planner"

const reasonCopy: Record<UpgradeReason, { eyebrow: string; title: string; description: string }> = {
  general: {
    eyebrow: "Tellwise Membership",
    title: "Continue to sharpen your storytelling.",
    description: "Unlock the full course and every practice tool.",
  },
  lessons: {
    eyebrow: "Course access",
    title: "Keep going with the full course.",
    description: "Membership opens the rest of the course.",
  },
  studio: {
    eyebrow: "Studio access",
    title: "Keep practicing with full Studio access.",
    description: "Membership unlocks unlimited graded Studio takes.",
  },
  community: {
    eyebrow: "Community access",
    title: "Join the Tellwise Community.",
    description: "Membership unlocks the private Community.",
  },
  planner: {
    eyebrow: "Story Planner",
    title: "Plan the story before you tell it.",
    description: "Your first plan is free. Membership unlocks unlimited plans.",
  },
}

const comparison = [
  { feature: "Lessons", free: "5", paid: "All 15" },
  { feature: "Graded Studio stories", free: "2", paid: "Unlimited" },
  { feature: "Parch coaching messages", free: "5", paid: "Unlimited" },
  { feature: "Story plans", free: "1", paid: "Unlimited" },
  { feature: "Community", free: "Locked", paid: "Full access" },
]

export function UpgradeScreen({
  reason = "general",
  backHref,
}: {
  reason?: UpgradeReason
  backHref?: string
}) {
  const copy = reasonCopy[reason]
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlanChoice>("monthly")
  const [renewalConsent, setRenewalConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const selectedLabel = useMemo(() => selectedPlan === "annual" ? "$60/year" : "$5.99/month", [selectedPlan])

  async function checkout() {
    if (busy) return
    if (!renewalConsent) {
      setMessage("Confirm the renewal terms before continuing.")
      return
    }

    setBusy(true)
    setMessage("")
    try {
      // The plan choice is sent now, but the existing Stripe route intentionally
      // does not accept it yet. That makes this frontend fail closed until the
      // two new Stripe Price IDs are wired in the backend, so a user can never
      // see $60/year or $5.99/month here and accidentally be charged the old plan.
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ renewalConsent: true, plan: selectedPlan }),
      })
      const result = await response.json() as { url?: string; error?: string; code?: string }
      if (!response.ok || !result.url) {
        if (response.status === 400) {
          throw new Error("The new Tellwise membership plans are not connected to checkout yet.")
        }
        throw new Error(result.error || "Checkout could not be opened.")
      }
      window.location.assign(result.url)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout could not be opened.")
      setBusy(false)
    }
  }

  return (
    <div className="membership-upgrade-screen">
      {backHref && <Link href={backHref} className="membership-upgrade-back">← Back</Link>}

      <header className="membership-upgrade-header">
        <span className="membership-upgrade-mark"><Lock /></span>
        <p className="membership-upgrade-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </header>

      <section className="membership-comparison" aria-label="Free and paid plan comparison">
        <div className="membership-comparison-head" aria-hidden="true">
          <span />
          <strong className="membership-comparison-plan is-free">Free</strong>
          <strong className="membership-comparison-plan is-paid">Paid</strong>
        </div>
        {comparison.map((item) => (
          <div key={item.feature} className="membership-comparison-row">
            <span className="membership-comparison-feature">{item.feature}</span>
            <span className="membership-plan-value membership-plan-value-free">{item.free}</span>
            <span className="membership-plan-value membership-plan-value-member">{item.paid}</span>
          </div>
        ))}
      </section>

      <PricingInteraction value={selectedPlan} onChange={setSelectedPlan} />

      <label className="membership-renewal-consent">
        <input
          type="checkbox"
          checked={renewalConsent}
          onChange={(event) => setRenewalConsent(event.target.checked)}
        />
        <span aria-hidden="true"><Check /></span>
        <p>I understand that Membership renews automatically until I cancel it.</p>
      </label>

      <button type="button" className="membership-upgrade-cta" disabled={busy || !renewalConsent} onClick={() => void checkout()}>
        {busy && <Loader2 className="animate-spin" />}
        {busy ? "Opening checkout…" : `Continue with ${selectedLabel}`}
      </button>

      {message && <p className="membership-upgrade-message" role="status">{message}</p>}
      <p className="membership-upgrade-fineprint">Cancel renewal anytime from Profile → Membership. Secure checkout is handled by Stripe.</p>
    </div>
  )
}
