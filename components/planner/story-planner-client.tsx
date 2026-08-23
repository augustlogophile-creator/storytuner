"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  FileText,
  MapPin,
  ListChecks,
  Map,
  Mic2,
  RefreshCw,
  ShieldQuestion,
  Sparkles,
  Target,
} from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import type { StoryPlanRecord } from "@/lib/planner/types"
import { downloadStoryPlanPdf } from "@/lib/planner/plan-pdf"
import { secondPersonDirection } from "@/lib/planner/voice"

const emptyForm = {
  audienceContext: "",
  goal: "",
  roughPlan: "",
  mustInclude: "",
  nervousAbout: "",
}

type FormState = typeof emptyForm

type FieldProps = {
  number: number
  icon: typeof Target
  title: string
  help: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  maxLength: number
  rows?: number
  required?: boolean
}

export function StoryPlannerClient({ fromStudio = false }: { fromStudio?: boolean }) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [plan, setPlan] = useState<StoryPlanRecord | null>(null)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [planExpanded, setPlanExpanded] = useState(false)
  const [planOrigin, setPlanOrigin] = useState<"new" | "saved" | null>(null)


  const ready = useMemo(() => (
    form.audienceContext.trim().length >= 3
    && form.goal.trim().length >= 3
    && form.roughPlan.trim().length >= 10
    && form.mustInclude.trim().length >= 1
    && form.nervousAbout.trim().length >= 1
  ), [form])

  const answeredCount = useMemo(() => [
    form.audienceContext.trim().length >= 3,
    form.goal.trim().length >= 3,
    form.roughPlan.trim().length >= 10,
    form.mustInclude.trim().length >= 1,
    form.nervousAbout.trim().length >= 1,
  ].filter(Boolean).length, [form])


  async function buildPlan() {
    if (!ready || building) return
    setBuilding(true)
    setPlan(null)
    setPlanOrigin(null)
    setPlanExpanded(false)
    setError("")
    setCopied(false)
    window.setTimeout(() => document.getElementById("planner-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 25)
    try {
      const response = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json() as { plan?: StoryPlanRecord; code?: string; error?: string }
      if (!response.ok || !payload.plan) {
        throw new Error(payload.error || "Parch could not build the plan.")
      }
      setPlan(payload.plan)
      setPlanOrigin("new")
      setPlanExpanded(false)
      window.setTimeout(() => document.getElementById("planner-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Parch could not build the plan.")
    } finally {
      setBuilding(false)
    }
  }


  async function copyPlan() {
    if (!plan) return
    const text = formatPlan(plan)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  function preparePlanForStudio(planToUse: StoryPlanRecord) {
    try {
      window.sessionStorage.setItem("storytuner:planner-plan", JSON.stringify({
        id: planToUse.id,
        title: planToUse.output.title,
        throughline: secondPersonDirection(planToUse.output.throughline),
        opening: secondPersonDirection(planToUse.output.opening),
        ending: secondPersonDirection(planToUse.output.ending),
        beats: planToUse.output.beats.map((beat) => ({ ...beat, purpose: secondPersonDirection(beat.purpose), suggestion: secondPersonDirection(beat.suggestion) })),
        tips: planToUse.output.deliveryTips.slice(0, 2).map(secondPersonDirection),
      }))
    } catch {
      // The Studio link still works when session storage is unavailable.
    }
  }

  function prepareForStudio() {
    if (plan) preparePlanForStudio(plan)
  }


  function exportPdf() {
    if (!plan) return
    downloadStoryPlanPdf(plan)
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setError("")
  }

  return (
    <div className="planner-page flex min-w-0 flex-col gap-6">
      {fromStudio ? (
        <Link href="/studio" prefetch className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Studio
        </Link>
      ) : <span />}
      <header className="planner-simple-hero">
        <span className="planner-simple-mark"><Map className="h-5 w-5" /></span>
        <div className="min-w-0">
          <Eyebrow>Story Planner</Eyebrow>
          <h1>Plan your story.</h1>
          <p>Answer five short prompts. Parch will turn the pieces into a clear story arc.</p>
        </div>
      </header>

      <Link href="/planner/saved" className="planner-simple-saved">
        <FileText aria-hidden="true" />
        <span>Your saved plans</span>
        <ChevronDown className="-rotate-90" aria-hidden="true" />
      </Link>

      {!building && !plan && (
        <section className="planner-simple-form">
          <div className="planner-simple-heading">
            <div>
              <Eyebrow>Your story</Eyebrow>
              <h2>Give Parch the rough version.</h2>
            </div>
            <span>{answeredCount}/5</span>
          </div>

          <div className="planner-simple-fields">
            <PlannerField
              number={1}
              icon={MapPin}
              title="Where will you tell this story?"
              help="Audience or situation"
              value={form.audienceContext}
              onChange={(value) => update("audienceContext", value)}
              placeholder="Interview, class, speech, conversation..."
              maxLength={1000}
              rows={2}
              required
            />
            <PlannerField
              number={2}
              icon={Target}
              title="What should the listener take away?"
              help="The point beneath the events"
              value={form.goal}
              onChange={(value) => update("goal", value)}
              placeholder="I want them to understand that..."
              maxLength={1500}
              rows={2}
              required
            />
            <PlannerField
              number={3}
              icon={ListChecks}
              title="What happens?"
              help="Fragments or bullets are fine"
              value={form.roughPlan}
              onChange={(value) => update("roughPlan", value)}
              placeholder="First... then... finally..."
              maxLength={5000}
              rows={4}
              required
            />
            <PlannerField
              number={4}
              icon={FileText}
              title="Anything Parch must keep?"
              help="Facts, names, or details"
              value={form.mustInclude}
              onChange={(value) => update("mustInclude", value)}
              placeholder="Write “None” if there is nothing essential."
              maxLength={3000}
              rows={2}
              required
            />
            <PlannerField
              number={5}
              icon={ShieldQuestion}
              title="What feels difficult?"
              help="Length, privacy, delivery, clarity..."
              value={form.nervousAbout}
              onChange={(value) => update("nervousAbout", value)}
              placeholder="Write “None” if you feel ready."
              maxLength={2000}
              rows={2}
              required
            />
          </div>

          {error && (
            <div className="mt-4 rounded-2xl bg-destructive/8 px-4 py-3" role="alert">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <button type="button" onClick={buildPlan} disabled={!ready} className="planner-build-button planner-simple-build">
            <Sparkles className="h-4 w-4" />
            Build my story plan
          </button>
          <p className="planner-build-hint">{ready ? "Ready to build." : `Answer ${5 - answeredCount} more ${5 - answeredCount === 1 ? "prompt" : "prompts"}.`}</p>
        </section>
      )}

      {building && <PlanReadySkeleton />}

      {plan && (
        <section id="planner-result" className="planner-result-card">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Eyebrow>{planOrigin === "saved" ? "Saved plan" : "Plan ready"}</Eyebrow>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={copyPlan} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold transition-colors hover:bg-secondary/60">
                  {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Clipboard className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button type="button" onClick={exportPdf} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold transition-colors hover:bg-secondary/60">
                  <Download className="h-3.5 w-3.5" /> Export PDF
                </button>
              </div>
            </div>

            <div className="mt-4 w-full text-left">
              <h2 className="max-w-none text-2xl font-semibold tracking-tight text-pretty sm:text-[1.7rem] sm:leading-tight">{plan.output.title}</h2>
              <p className="mt-2 w-full max-w-none text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">{secondPersonDirection(plan.output.throughline)}</p>
            </div>

            <button type="button" onClick={() => setPlanExpanded((value) => !value)} className="mt-5 flex w-full items-center justify-between rounded-2xl bg-secondary/55 px-4 py-3.5 text-left text-sm font-semibold hover:bg-secondary">
              <span>{planExpanded ? "Hide full plan" : "View full plan"}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${planExpanded ? "rotate-180" : ""}`} />
            </button>

            {planExpanded && (
              <div className="planner-expand-in mt-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <PlanBlock eyebrow="Opening" text={secondPersonDirection(plan.output.opening)} />
                  <PlanBlock eyebrow="Landing" text={secondPersonDirection(plan.output.ending)} />
                </div>

                <div className="mt-5">
                  <Eyebrow>Story beats</Eyebrow>
                  <ol className="mt-3 flex flex-col gap-3">
                    {plan.output.beats.map((beat, index) => (
                      <li key={`${beat.label}-${index}`} className="flex gap-3 rounded-2xl border border-border bg-background p-4">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">{index + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{beat.label}</p>
                          <p className="mt-1 text-xs font-semibold text-accent-foreground">{secondPersonDirection(beat.purpose)}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{secondPersonDirection(beat.suggestion)}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ListBlock title="Keep these" items={plan.output.keep.map(secondPersonDirection)} />
                  <ListBlock title="Clarify before telling" items={plan.output.clarify.map(secondPersonDirection)} />
                </div>

                <div className="mt-5 rounded-3xl border border-border bg-background p-5">
                  <Eyebrow>Two things to remember</Eyebrow>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                    {plan.output.deliveryTips.slice(0, 2).map(secondPersonDirection).map((tip) => <li key={tip} className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-brand" />{tip}</li>)}
                  </ul>
                  <p className="mt-4 rounded-2xl bg-brand-soft/55 px-4 py-3 text-sm leading-6 text-foreground">{secondPersonDirection(plan.output.reassurance)}</p>
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link href="/studio?mode=free&planned=1" onClick={prepareForStudio} className="flex min-h-14 items-center justify-center gap-2 rounded-[1.25rem] border border-brand/20 bg-brand px-3.5 py-3 text-[0.8rem] font-semibold text-brand-foreground shadow-[0_8px_20px_rgba(57,104,158,0.16)] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]">
                <Mic2 className="h-4 w-4 shrink-0" /> <span className="text-center leading-tight">Practice this plan</span>
              </Link>
              <button type="button" onClick={() => { setPlan(null); setPlanOrigin(null); setPlanExpanded(false); setForm(emptyForm); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }) }} className="flex min-h-14 items-center justify-center gap-2 rounded-[1.25rem] border border-border bg-card px-3.5 py-3 text-[0.8rem] font-semibold text-foreground shadow-[0_6px_18px_rgba(39,35,31,0.06)] transition-all hover:border-foreground/25 hover:bg-secondary/45 active:scale-[0.98]">
                <RefreshCw className="h-4 w-4 shrink-0" /> <span className="text-center leading-tight">Start another plan</span>
              </button>
            </div>
          </div>
        </section>
      )}

    </div>
  )
}


function PlanReadySkeleton() {
  return (
    <section id="planner-result" className="scroll-mt-20 overflow-hidden rounded-[2rem] border border-brand/25 bg-card shadow-sm" aria-label="Parch is building your story plan" aria-busy="true">
      <div className="p-5 sm:p-6">
        <div className="animate-pulse">
          <div className="flex items-center justify-between gap-3">
            <div className="h-3 w-24 rounded-full bg-secondary/80" />
            <div className="flex gap-2">
              <div className="h-9 w-[4.75rem] rounded-full bg-secondary/70" />
              <div className="h-9 w-[6.5rem] rounded-full bg-secondary/70" />
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            <div className="h-7 w-[68%] rounded-lg bg-secondary/85" />
            <div className="h-4 w-full rounded-full bg-secondary/65" />
            <div className="h-4 w-[82%] rounded-full bg-secondary/65" />
          </div>

          <div className="mt-6 flex h-12 w-full items-center justify-between rounded-2xl bg-secondary/55 px-4">
            <div className="h-4 w-28 rounded-full bg-secondary" />
            <div className="h-4 w-4 rounded-full bg-secondary" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="h-12 rounded-full bg-brand-soft/70" />
            <div className="h-12 rounded-full bg-secondary/65" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-border/70 px-5 py-3 text-xs font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
        Parch is shaping your plan
      </div>
    </section>
  )
}

function PlannerField({ number, icon: Icon, title, help, value, onChange, placeholder, maxLength, rows = 3, required = false }: FieldProps) {
  return (
    <label className="planner-field-card">
      <span className="planner-field-heading">
        <span className="planner-field-number">{number}</span>
        <span className="planner-field-heading-copy">
          <span className="planner-field-title">{title}{required ? <span className="ml-1 text-brand">*</span> : null}</span>
          <span className="planner-field-help">{help}</span>
        </span>
        <Icon className="planner-field-icon" aria-hidden="true" />
      </span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} rows={rows} placeholder={placeholder} className="planner-field-input" />
      <span className="planner-field-count">{value.length}/{maxLength}</span>
    </label>
  )
}

function PlanBlock({ eyebrow, text }: { eyebrow: string; text: string }) {
  return <div className="rounded-3xl bg-brand-soft/45 p-5"><Eyebrow>{eyebrow}</Eyebrow><p className="mt-2 text-sm leading-7 text-foreground">{text}</p></div>
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-3xl border border-border p-5"><p className="text-sm font-semibold">{title}</p><ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">{items.map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-brand" />{item}</li>)}</ul></div>
}

function formatPlan(plan: StoryPlanRecord) {
  const lines = [
    plan.output.title,
    "",
    `Throughline: ${secondPersonDirection(plan.output.throughline)}`,
    "",
    `Opening: ${secondPersonDirection(plan.output.opening)}`,
    "",
    "Story beats:",
    ...plan.output.beats.map((beat, index) => `${index + 1}. ${beat.label}: ${secondPersonDirection(beat.suggestion)}`),
    "",
    `Landing: ${secondPersonDirection(plan.output.ending)}`,
    "",
    "Two things to remember:",
    ...plan.output.deliveryTips.slice(0, 2).map((tip, index) => `${index + 1}. ${secondPersonDirection(tip)}`),
  ]
  return lines.join("\n")
}
