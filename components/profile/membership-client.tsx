"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { UpgradeScreen, type UpgradeReason } from "@/components/membership/upgrade-screen"
import { useApp } from "@/lib/app-state"

export type MembershipStatus = {
  active: boolean
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

export function MembershipClient({
  initialStatus,
  checkoutSuccess = false,
  reason = "general",
}: {
  initialStatus: MembershipStatus
  checkoutSuccess?: boolean
  reason?: UpgradeReason
}) {
  const { setPremium } = useApp()
  const [status, setStatus] = useState<MembershipStatus>(initialStatus)
  const [busy, setBusy] = useState<"portal" | "cancel" | null>(null)
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
        // Keep the server-rendered status when a refresh is unavailable.
      })
  }, [initialStatus.active, setPremium])

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
      setMessage("Renewal canceled. Your Membership stays active through the end of the paid period.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Renewal could not be canceled.")
    } finally {
      setBusy(null)
    }
  }

  if (!status.active) {
    return <UpgradeScreen reason={reason} backHref={reason === "studio" ? "/studio" : reason === "lessons" ? "/activities" : reason === "planner" ? "/studio" : reason === "community" ? "/home" : "/profile"} />
  }

  const renewalDate = status.currentPeriodEnd
    ? new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(status.currentPeriodEnd))
    : null

  return (
    <div className="membership-active-page flex min-w-0 flex-col gap-6">
      <BackLink href="/profile" label="Profile" />
      <header>
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">Membership</p>
        <h1 className="mt-2 text-[1.55rem] font-semibold tracking-tight">Your Tellwise Membership</h1>
        <p className="mt-1 text-[0.8rem] leading-relaxed text-muted-foreground">Full Tellwise access.</p>
      </header>

      {checkoutSuccess && (
        <section role="status" className="rounded-3xl border border-brand/30 bg-brand-soft/45 p-5">
          <p className="text-sm font-semibold">Membership confirmed</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Access is active.</p>
        </section>
      )}

      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-brand"><Check className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.12em]">Active</span></div>
        <p className="mt-3 text-[0.92rem] font-semibold">
          {status.cancelAtPeriodEnd
            ? renewalDate ? `Access continues through ${renewalDate}.` : "Access remains active through the current paid period."
            : renewalDate ? `Next renewal: ${renewalDate}` : "Membership is active."}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Manage billing or renewal below.</p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => void openPortal()} disabled={busy !== null} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy === "portal" && <Loader2 className="h-4 w-4 animate-spin" />} Manage billing
          </button>
          {!status.cancelAtPeriodEnd && (
            <button type="button" onClick={() => setCancelOpen(true)} disabled={busy !== null} className="flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold disabled:opacity-60">
              Cancel renewal
            </button>
          )}
        </div>
        {message && <p className="mt-3 text-xs leading-relaxed text-muted-foreground" role="status">{message}</p>}
      </section>

      <p className="text-center text-xs text-muted-foreground">Need help? <a className="underline underline-offset-2" href="mailto:tellwiseapp@gmail.com">tellwiseapp@gmail.com</a> · <Link href="/terms" className="underline underline-offset-2">Terms</Link></p>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel automatic renewal?"
        confirmLabel="Cancel renewal"
        tone="danger"
        busy={busy === "cancel"}
        onCancel={() => { if (busy !== "cancel") setCancelOpen(false) }}
        onConfirm={() => void cancelRenewal()}
      >
        Your Membership will stay active through the current paid period, but Tellwise will not charge another renewal.
      </ConfirmDialog>
    </div>
  )
}
