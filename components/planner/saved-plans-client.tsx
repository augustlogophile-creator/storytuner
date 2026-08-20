"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clipboard, Download, Loader2, Map, Mic2 } from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import type { StoryPlanRecord } from "@/lib/planner/types"
import { downloadStoryPlanPdf } from "@/lib/planner/plan-pdf"
import { secondPersonDirection } from "@/lib/planner/voice"

export function SavedPlansClient() {
  const [plans, setPlans] = useState<StoryPlanRecord[]>([])
  const [selected, setSelected] = useState<StoryPlanRecord | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => { void loadPlans() }, [])

  async function loadPlans() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/planner", { cache: "no-store", headers: { Accept: "application/json" } })
      const payload = await response.json() as { plans?: StoryPlanRecord[]; error?: string }
      if (!response.ok) throw new Error(payload.error || "Saved plans could not be loaded.")
      setPlans(payload.plans ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Saved plans could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  function prepareForStudio(plan: StoryPlanRecord) {
    try {
      window.sessionStorage.setItem("storytuner:planner-plan", JSON.stringify({
        id: plan.id,
        title: plan.output.title,
        throughline: secondPersonDirection(plan.output.throughline),
        opening: secondPersonDirection(plan.output.opening),
        ending: secondPersonDirection(plan.output.ending),
        beats: plan.output.beats.map((beat) => ({ ...beat, purpose: secondPersonDirection(beat.purpose), suggestion: secondPersonDirection(beat.suggestion) })),
        tips: plan.output.deliveryTips.slice(0, 2).map(secondPersonDirection),
      }))
    } catch {}
  }

  async function copyPlan(plan: StoryPlanRecord) {
    const lines = [
      plan.output.title, "", `Throughline: ${secondPersonDirection(plan.output.throughline)}`, "",
      `Opening: ${secondPersonDirection(plan.output.opening)}`, "", "Story beats:",
      ...plan.output.beats.map((beat, index) => `${index + 1}. ${beat.label}: ${secondPersonDirection(beat.suggestion)}`),
      "", `Landing: ${secondPersonDirection(plan.output.ending)}`,
    ]
    await navigator.clipboard.writeText(lines.join("\n"))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  if (selected) {
    return (
      <div className="flex min-w-0 flex-col gap-5">
        <button type="button" onClick={() => { setSelected(null); setExpanded(false) }} className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> All saved plans
        </button>

        <section className="overflow-hidden rounded-[2rem] border border-brand/30 bg-card shadow-sm">
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Eyebrow>Saved plan</Eyebrow>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-pretty">{selected.output.title}</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{secondPersonDirection(selected.output.throughline)}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => void copyPlan(selected)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-semibold">
                {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Clipboard className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" onClick={() => downloadStoryPlanPdf(selected)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-semibold">
                <Download className="h-3.5 w-3.5" /> Export PDF
              </button>
            </div>

            <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-4 flex w-full items-center justify-between rounded-2xl bg-secondary/55 px-4 py-3.5 text-left text-sm font-semibold">
              <span>{expanded ? "Hide plan" : "View full plan"}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>

            {expanded && (
              <div className="mt-4 space-y-3">
                <PlanSection label="Opening" text={secondPersonDirection(selected.output.opening)} />
                <div className="rounded-3xl border border-border bg-background p-4">
                  <Eyebrow>Story beats</Eyebrow>
                  <ol className="mt-3 space-y-3">
                    {selected.output.beats.map((beat, index) => (
                      <li key={`${beat.label}-${index}`} className="flex gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">{index + 1}</span>
                        <div><p className="text-sm font-semibold">{beat.label}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{secondPersonDirection(beat.suggestion)}</p></div>
                      </li>
                    ))}
                  </ol>
                </div>
                <PlanSection label="Landing" text={secondPersonDirection(selected.output.ending)} />
              </div>
            )}

            <Link href="/studio?mode=free&planned=1" onClick={() => prepareForStudio(selected)} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-[1.25rem] bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground shadow-[0_8px_20px_rgba(57,104,158,0.16)]">
              <Mic2 className="h-4 w-4" /> Practice this plan
            </Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/planner" prefetch className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Planner</Link>
        <Link href="/studio" prefetch className="text-xs font-semibold text-muted-foreground">Studio</Link>
      </div>

      <header className="rounded-[2rem] bg-primary p-6 text-primary-foreground">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-brand-foreground"><Map className="h-5 w-5" /></span>
        <Eyebrow className="mt-5 text-primary-foreground/60">Saved privately</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Your story plans</h1>
        <p className="mt-2 text-sm leading-6 text-primary-foreground/70">Pick a plan to review it or take it straight into Studio.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-border bg-card px-5 py-10 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading plans...</div>
      ) : error ? (
        <div className="rounded-3xl border border-destructive/25 bg-card p-5"><p className="text-sm text-destructive">{error}</p><button type="button" onClick={() => void loadPlans()} className="mt-3 text-sm font-semibold">Try again</button></div>
      ) : plans.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card px-5 py-10 text-center"><p className="text-sm font-semibold">No saved plans yet</p><p className="mt-1 text-xs text-muted-foreground">Build a plan and it will appear here automatically.</p></div>
      ) : (
        <div className="grid gap-3">
          {plans.map((plan) => (
            <button key={plan.id} type="button" onClick={() => setSelected(plan)} className="group flex w-full items-center gap-4 rounded-3xl border border-border bg-card p-4 text-left transition hover:border-brand/45 hover:bg-brand-soft/25">
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{plan.output.title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{new Date(plan.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {plan.audienceContext}</span></span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PlanSection({ label, text }: { label: string; text: string }) {
  return <div className="rounded-3xl bg-brand-soft/45 p-4"><Eyebrow>{label}</Eyebrow><p className="mt-2 text-sm leading-6">{text}</p></div>
}
