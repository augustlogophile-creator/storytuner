"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, CheckCircle2, CircleAlert, Database, Loader2, RefreshCw, ShieldCheck, Sparkles, Wrench } from "lucide-react"
import { BackLink } from "@/components/page-header"

type Payload = {
  generatedAt: string
  configuration: { openAI: boolean; supabaseAdmin: boolean; stripe: boolean }
  metrics: Record<string, number>
  recentRecordingFailures: Array<{ id: string; user: string; status: string; error: string; updatedAt: string }>
}

const metricLabels: Record<string, string> = {
  failedRecordings7d: "Failed recordings, 7d",
  staleRecordings: "Stale recording uploads",
  staleCommunityAudio: "Stale Community audio",
  openReports: "Open moderation reports",
  moderationActions24h: "Moderation actions, 24h",
  coachMessages24h: "Coach requests, 24h",
  arenaReviews24h: "Arena AI requests, 24h",
  storyPlans24h: "Story plans, 24h",
  communityPosts24h: "Community posts, 24h",
  communityReplies24h: "Community replies, 24h",
  activeMembers: "Active members",
  restrictedAccounts: "Restricted accounts",
}

export function SystemOperationsClient() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/system", { cache: "no-store", headers: { Accept: "application/json" } })
      const payload = await response.json() as Payload & { error?: string }
      if (!response.ok) throw new Error(payload.error || "System status could not be loaded.")
      setData(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "System status could not be loaded.")
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
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Maintenance could not finish.")
      const total = Object.values(payload.result ?? {}).reduce((sum, value) => sum + Number(value || 0), 0)
      setNotice(total > 0 ? `Maintenance completed. ${total} stale or expired item${total === 1 ? "" : "s"} cleaned up.` : "Maintenance completed. Nothing needed cleanup.")
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Maintenance could not finish.")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/profile" label="Profile" />
      <header>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Owner tools</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div><h1 className="text-2xl font-semibold tracking-tight">System health</h1><p className="mt-1 text-sm text-muted-foreground">One place for backend health, usage, failures, and cleanup.</p></div>
          <button type="button" onClick={() => void load()} disabled={loading} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {notice && <div className="rounded-2xl border border-brand/25 bg-brand-soft/50 px-4 py-3 text-sm">{notice}</div>}

      {loading && !data ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : data && <>
        <section className="grid grid-cols-3 gap-2">
          <ConfigPill label="OpenAI" ok={data.configuration.openAI} icon={Sparkles} />
          <ConfigPill label="Supabase" ok={data.configuration.supabaseAdmin} icon={Database} />
          <ConfigPill label="Stripe" ok={data.configuration.stripe} icon={ShieldCheck} />
        </section>

        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Backend activity</h2><p className="mt-1 text-xs text-muted-foreground">Live counts from the existing StoryTuner database.</p></div><Activity className="h-5 w-5 text-muted-foreground" /></div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Object.entries(data.metrics).map(([key, value]) => <div key={key} className="rounded-2xl bg-secondary/55 p-3"><p className="text-xl font-semibold tabular-nums">{value.toLocaleString()}</p><p className="mt-1 text-[0.68rem] leading-4 text-muted-foreground">{metricLabels[key] ?? key}</p></div>)}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Recent recording failures</h2><p className="mt-1 text-xs text-muted-foreground">Saved server errors, newest first.</p></div><CircleAlert className="h-5 w-5 text-muted-foreground" /></div>
          <div className="mt-4 space-y-2">
            {data.recentRecordingFailures.length === 0 ? <div className="flex items-center gap-2 rounded-2xl bg-secondary/45 p-4 text-sm"><CheckCircle2 className="h-4 w-4" /> No recent failed uploads.</div> : data.recentRecordingFailures.map((item) => <div key={item.id} className="rounded-2xl bg-secondary/45 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold">{item.user}</p><p className="text-[0.65rem] text-muted-foreground">{new Date(item.updatedAt).toLocaleString()}</p></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.error}</p></div>)}
          </div>
        </section>

        <button type="button" onClick={() => void runMaintenance()} disabled={running} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />} Run maintenance now
        </button>
        <p className="text-center text-[0.65rem] leading-5 text-muted-foreground">Automatic maintenance runs once each day. API and OpenAI failures are also emitted as structured <span className="font-mono">storytuner-backend</span> events in Vercel Logs.</p>
      </>}
    </div>
  )
}

function ConfigPill({ label, ok, icon: Icon }: { label: string; ok: boolean; icon: typeof Activity }) {
  return <div className={`rounded-2xl border p-3 text-center ${ok ? "border-brand/25 bg-brand-soft/40" : "border-destructive/25 bg-destructive/5"}`}><Icon className="mx-auto h-4 w-4" /><p className="mt-2 text-[0.65rem] font-semibold">{label}</p><p className="mt-0.5 text-[0.58rem] text-muted-foreground">{ok ? "Connected" : "Missing"}</p></div>
}
