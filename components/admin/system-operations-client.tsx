"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, CircleAlert, Loader2, RefreshCw, Wrench, X } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { ConfirmDialog } from "@/components/confirm-dialog"

 type Payload = {
  generatedAt: string
  configuration: { openAI: boolean; supabaseAdmin: boolean; stripe: boolean; maintenanceCron?: boolean }
  metrics: Record<string, number>
  recentRecordingFailures: Array<{ id: string; user: string; status: string; error: string; updatedAt: string }>
}

export function SystemOperationsClient() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [confirmMaintenance, setConfirmMaintenance] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/system", { cache: "no-store", headers: { Accept: "application/json" } })
      const payload = await response.json() as Payload & { error?: string }
      if (!response.ok) throw new Error(payload.error || "App status could not be loaded.")
      setData(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "App status could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function runMaintenance() {
    if (running) return
    setRunning(true)
    setNotice("")
    setError("")
    try {
      const response = await fetch("/api/admin/system", { method: "POST", headers: { Accept: "application/json" } })
      const payload = await response.json() as { ok?: boolean; result?: Record<string, number>; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Cleanup could not finish.")
      const total = Object.values(payload.result ?? {}).reduce((sum, value) => sum + Number(value || 0), 0)
      setNotice(total > 0 ? `${total} old or expired item${total === 1 ? " was" : "s were"} cleaned up.` : "Everything was already clean. Nothing needed to be removed.")
      setConfirmMaintenance(false)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cleanup could not finish.")
      setConfirmMaintenance(false)
    } finally {
      setRunning(false)
    }
  }

  const status = useMemo(() => {
    if (!data) return null
    const services = [
      data.configuration.openAI,
      data.configuration.supabaseAdmin,
      data.configuration.stripe,
      data.configuration.maintenanceCron !== false,
    ]
    return services.every(Boolean)
  }, [data])

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-6">
      <BackLink href="/admin" label="Owner tools" />

      <header>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Tellwise</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">App status</h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">A simple view of what is working, what needs attention, and recent activity.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card" aria-label="Refresh app status">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm leading-6 text-destructive">{error}</div>}
      {notice && <div className="rounded-2xl border border-brand/20 bg-brand-soft/35 px-4 py-3 text-sm leading-6">{notice}</div>}

      {loading && !data ? (
        <div className="flex min-h-48 items-center justify-center rounded-3xl border border-border bg-card">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <section className="rounded-[1.5rem] border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${status ? "bg-brand-soft text-brand" : "bg-destructive/10 text-destructive"}`}>
                {status ? <Check className="h-5 w-5" strokeWidth={2.2} /> : <CircleAlert className="h-5 w-5" strokeWidth={2} />}
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">{status ? "Everything Tellwise needs is connected" : "A required connection needs attention"}</h2>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Last checked {new Date(data.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-border bg-card p-4">
            <SectionHeading title="Connections" detail="The parts of Tellwise that need to be connected." />
            <div className="mt-3 divide-y divide-border">
              <ServiceRow label="AI features" detail="Parch, grading, and feedback" ok={data.configuration.openAI} />
              <ServiceRow label="Saved data & accounts" detail="Accounts, progress, reports, and saved information" ok={data.configuration.supabaseAdmin} />
              <ServiceRow label="Payments" detail="Membership billing and subscription checks" ok={data.configuration.stripe} />
              <ServiceRow label="Daily cleanup" detail="Automatic removal of expired or abandoned data" ok={data.configuration.maintenanceCron !== false} />
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-border bg-card p-4">
            <SectionHeading title="Needs attention" detail="Items worth checking now. Zero is good." />
            <div className="mt-3 divide-y divide-border">
              <AttentionRow label="Failed recordings this week" value={metric(data, "failedRecordings7d")} />
              <AttentionRow label="Recordings stuck processing" value={metric(data, "staleRecordings")} />
              <AttentionRow label="Community audio waiting for cleanup" value={metric(data, "staleCommunityAudio")} />
              <AttentionRow label="Community reports waiting" value={metric(data, "openReports")} neutral />
              <AttentionRow label="Accounts currently restricted" value={metric(data, "restrictedAccounts")} neutral />
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-border bg-card p-4">
            <SectionHeading title="Today" detail="A quick snapshot of activity in Tellwise." />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <SimpleMetric value={metric(data, "coachMessages24h")} label="Parch chats" />
              <SimpleMetric value={metric(data, "arenaReviews24h")} label="Studio reviews" />
              <SimpleMetric value={metric(data, "storyPlans24h")} label="Story plans" />
              <SimpleMetric value={metric(data, "communityPosts24h") + metric(data, "communityReplies24h")} label="Community activity" />
              <SimpleMetric value={metric(data, "moderationActions24h")} label="Moderation decisions" />
              <SimpleMetric value={metric(data, "activeMembers")} label="Active memberships" />
            </div>
          </section>

          {data.recentRecordingFailures.length > 0 && (
            <details className="rounded-[1.5rem] border border-border bg-card p-4">
              <summary className="cursor-pointer list-none text-sm font-semibold">Recent recording problems <span className="font-normal text-muted-foreground">· {data.recentRecordingFailures.length}</span></summary>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Only open this when you are investigating failed uploads.</p>
              <div className="mt-3 space-y-2">
                {data.recentRecordingFailures.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-secondary/45 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold">Recording from member {item.user}</p>
                      <p className="shrink-0 text-[0.62rem] text-muted-foreground">{new Date(item.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{friendlyFailure(item.error)}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          <section className="rounded-[1.5rem] border border-border bg-card p-4">
            <SectionHeading title="Cleanup" detail="Normally this runs automatically. Use it manually only if old or failed items seem stuck." />
            <button type="button" onClick={() => setConfirmMaintenance(true)} disabled={running} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold disabled:opacity-60">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />} Clean up old data
            </button>
          </section>
        </>
      ) : null}

      <ConfirmDialog
        open={confirmMaintenance}
        title="Run cleanup now?"
        confirmLabel="Run cleanup"
        tone="brand"
        busy={running}
        onCancel={() => { if (!running) setConfirmMaintenance(false) }}
        onConfirm={() => void runMaintenance()}
      >
        Tellwise will remove expired or abandoned data that is already safe to clean up. It will not delete active member content.
      </ConfirmDialog>
    </div>
  )
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return <div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p></div>
}

function ServiceRow({ label, detail, ok }: { label: string; detail: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ok ? "bg-brand-soft text-brand" : "bg-destructive/10 text-destructive"}`}>
        {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{label}</p><p className="mt-0.5 text-[0.68rem] leading-4 text-muted-foreground">{detail}</p></div>
      <span className={`shrink-0 text-[0.65rem] font-semibold ${ok ? "text-muted-foreground" : "text-destructive"}`}>{ok ? "Ready" : "Check setup"}</span>
    </div>
  )
}

function AttentionRow({ label, value, neutral = false }: { label: string; value: number; neutral?: boolean }) {
  const needsAttention = !neutral && value > 0
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="text-xs leading-5 text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${needsAttention ? "text-destructive" : "text-foreground"}`}>{value.toLocaleString()}</span>
    </div>
  )
}

function SimpleMetric({ value, label }: { value: number; label: string }) {
  return <div className="rounded-2xl bg-secondary/45 px-3 py-3"><p className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</p><p className="mt-0.5 text-[0.68rem] leading-4 text-muted-foreground">{label}</p></div>
}

function metric(data: Payload, key: string) {
  return Math.max(0, Number(data.metrics[key] ?? 0))
}

function friendlyFailure(message: string) {
  const normalized = message.trim()
  if (!normalized) return "The recording failed without a saved explanation."
  if (/timeout/i.test(normalized)) return "The recording took too long to process."
  if (/size|too large|payload/i.test(normalized)) return "The recording file was too large to process normally."
  if (/transcrib/i.test(normalized)) return "Tellwise could not finish turning the recording into text."
  if (/upload/i.test(normalized)) return "The recording did not finish uploading correctly."
  return normalized.length > 180 ? `${normalized.slice(0, 177)}…` : normalized
}
