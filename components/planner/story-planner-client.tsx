"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  Check,
  Clipboard,
  Clock3,
  FileText,
  History,
  Lightbulb,
  ListChecks,
  Loader2,
  Map,
  Mic2,
  RefreshCw,
  ShieldQuestion,
  Sparkles,
  Target,
} from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import type { StoryPlanRecord } from "@/lib/planner/types"

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

export function StoryPlannerClient() {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [plan, setPlan] = useState<StoryPlanRecord | null>(null)
  const [history, setHistory] = useState<StoryPlanRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState("")
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const ready = useMemo(() => (
    form.audienceContext.trim().length >= 3
    && form.goal.trim().length >= 3
    && form.roughPlan.trim().length >= 10
  ), [form])

  useEffect(() => {
    void loadHistory()
  }, [])

  async function loadHistory() {
    setLoadingHistory(true)
    setHistoryError("")
    try {
      const response = await fetch("/api/planner", { cache: "no-store", headers: { Accept: "application/json" } })
      const payload = await response.json() as { plans?: StoryPlanRecord[]; error?: string }
      if (!response.ok) throw new Error(payload.error || "Saved plans could not be loaded.")
      setHistory(payload.plans ?? [])
    } catch (caught) {
      setHistoryError(caught instanceof Error ? caught.message : "Saved plans could not be loaded.")
    } finally {
      setLoadingHistory(false)
    }
  }

  async function buildPlan() {
    if (!ready || building) return
    setBuilding(true)
    setError("")
    setCopied(false)
    try {
      const response = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json() as { plan?: StoryPlanRecord; code?: string; error?: string }
      if (!response.ok || !payload.plan) {
        throw new Error(payload.error || "Weaver could not build the plan.")
      }
      setPlan(payload.plan)
      setHistory((current) => [payload.plan!, ...current.filter((item) => item.id !== payload.plan!.id)].slice(0, 8))
      window.setTimeout(() => document.getElementById("planner-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Weaver could not build the plan.")
    } finally {
      setBuilding(false)
    }
  }

  function openSaved(item: StoryPlanRecord) {
    setPlan(item)
    setForm({
      audienceContext: item.audienceContext,
      goal: item.goal,
      roughPlan: item.roughPlan,
      mustInclude: item.mustInclude,
      nervousAbout: item.nervousAbout,
    })
    window.setTimeout(() => document.getElementById("planner-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 25)
  }

  async function copyPlan() {
    if (!plan) return
    const text = formatPlan(plan)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  function prepareForArena() {
    if (!plan) return
    try {
      window.sessionStorage.setItem("storytuner:planner-plan", JSON.stringify({
        id: plan.id,
        title: plan.output.title,
        plan: plan.output.revisedPlan,
        throughline: plan.output.throughline,
      }))
    } catch {
      // The Arena link still works when session storage is unavailable.
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setError("")
  }

  return (
    <div className="flex min-w-0 flex-col gap-7">
      <header className="rounded-[2rem] bg-primary p-6 text-primary-foreground">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
            <Map className="h-5 w-5" />
          </span>
          <div>
            <Eyebrow className="text-primary-foreground/60">AI Story Planner</Eyebrow>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">Know where your story is going before you tell it.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-primary-foreground/70">
              Give Weaver the situation, your goal, the facts, and what feels difficult. You will get a clear structure, a stronger plan, and practical delivery guidance without losing your voice.
            </p>
          </div>
        </div>
      </header>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <Eyebrow>Build your plan</Eyebrow>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Start with what you already know</h2>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground">About 3 minutes</span>
        </div>

        <div className="flex flex-col gap-4">
          <PlannerField
            number={1}
            icon={Target}
            title="Where will you tell this story?"
            help="Name the audience and situation, such as an interview, class, difficult conversation, speech, or casual conversation."
            value={form.audienceContext}
            onChange={(value) => update("audienceContext", value)}
            placeholder="I am answering an interview question about a challenge I handled..."
            maxLength={1000}
            rows={3}
            required
          />
          <PlannerField
            number={2}
            icon={Lightbulb}
            title="What do you want the listener to understand or feel?"
            help="This becomes the story's throughline. It is not a formal lesson, just the point beneath the events."
            value={form.goal}
            onChange={(value) => update("goal", value)}
            placeholder="I want them to see that I can stay calm and solve problems when something goes wrong..."
            maxLength={1500}
            rows={3}
            required
          />
          <PlannerField
            number={3}
            icon={ListChecks}
            title="What basically happens?"
            help="List the events in rough order. Fragments are fine. Weaver will help shape them."
            value={form.roughPlan}
            onChange={(value) => update("roughPlan", value)}
            placeholder="First..., then..., the turning point was..., after that..., it ended when..."
            maxLength={5000}
            rows={6}
            required
          />
          <PlannerField
            number={4}
            icon={FileText}
            title="Which facts or details must stay?"
            help="Add names, sensory details, exact moments, context, or boundaries that Weaver must preserve."
            value={form.mustInclude}
            onChange={(value) => update("mustInclude", value)}
            placeholder="The keyboard was sticky, it was finals week, and I do not want the story to make my brother look careless..."
            maxLength={3000}
            rows={4}
          />
          <PlannerField
            number={5}
            icon={ShieldQuestion}
            title="What are you nervous or uncertain about?"
            help="Mention anything that makes the telling difficult, confusing, too long, too personal, or hard to deliver."
            value={form.nervousAbout}
            onChange={(value) => update("nervousAbout", value)}
            placeholder="I am worried the beginning is boring and that I will forget what comes next..."
            maxLength={2000}
            rows={4}
          />
        </div>

        {error && (
          <div className="mt-4 rounded-2xl bg-destructive/8 px-4 py-3" role="alert">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        <button
          type="button"
          onClick={buildPlan}
          disabled={!ready || building}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {building ? "Weaver is shaping your plan..." : "Build my story plan"}
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Plans are private and saved to your account. Membership includes up to 10 plans per day.</p>
      </section>

      {plan && (
        <section id="planner-result" className="scroll-mt-20 rounded-[2rem] border border-brand/35 bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Eyebrow>Weaver's plan</Eyebrow>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance">{plan.output.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{plan.output.throughline}</p>
            </div>
            <button type="button" onClick={copyPlan} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold">
              {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Clipboard className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy plan"}
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <PlanBlock eyebrow="Opening direction" text={plan.output.opening} />
            <PlanBlock eyebrow="Ending direction" text={plan.output.ending} />
          </div>

          <div className="mt-5">
            <Eyebrow>Story beats</Eyebrow>
            <ol className="mt-3 flex flex-col gap-3">
              {plan.output.beats.map((beat, index) => (
                <li key={`${beat.label}-${index}`} className="flex gap-3 rounded-2xl bg-secondary/55 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">{index + 1}</span>
                  <div>
                    <p className="text-sm font-semibold">{beat.label}</p>
                    <p className="mt-1 text-xs font-semibold text-accent-foreground">{beat.purpose}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{beat.suggestion}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <ListBlock title="Keep these" items={plan.output.keep} />
            <ListBlock title="Clarify before telling" items={plan.output.clarify} />
          </div>

          <div className="mt-5 rounded-3xl bg-primary p-5 text-primary-foreground">
            <Eyebrow className="text-primary-foreground/60">Rehearsal outline</Eyebrow>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-primary-foreground/85">{plan.output.revisedPlan}</p>
          </div>

          <div className="mt-5 rounded-3xl border border-border p-5">
            <Eyebrow>Delivery guidance</Eyebrow>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              {plan.output.deliveryTips.map((tip) => <li key={tip} className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-brand" />{tip}</li>)}
            </ul>
            <p className="mt-4 rounded-2xl bg-brand-soft/55 px-4 py-3 text-sm leading-6 text-foreground">{plan.output.reassurance}</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link href="/arena?mode=free&planned=1" onClick={prepareForArena} className="flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3.5 text-sm font-semibold text-brand-foreground">
              <Mic2 className="h-4 w-4" /> Practice this plan <ArrowRight className="h-4 w-4" />
            </Link>
            <button type="button" onClick={() => { setPlan(null); window.scrollTo({ top: 0, behavior: "smooth" }) }} className="flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3.5 text-sm font-semibold">
              <RefreshCw className="h-4 w-4" /> Start another plan
            </button>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Eyebrow>Saved privately</Eyebrow>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">Recent plans</h2>
          </div>
          <History className="h-5 w-5 text-muted-foreground" />
        </div>
        {loadingHistory ? (
          <div className="mt-3 flex items-center rounded-3xl border border-border px-5 py-7 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading saved plans...</div>
        ) : historyError ? (
          <div className="mt-3 rounded-3xl border border-destructive/25 p-5"><p className="text-sm text-destructive">{historyError}</p><button type="button" onClick={() => void loadHistory()} className="mt-3 text-sm font-semibold">Try again</button></div>
        ) : history.length === 0 ? (
          <div className="mt-3 rounded-3xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">Your finished plans will appear here.</div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-card">
            {history.map((item, index) => (
              <button key={item.id} type="button" onClick={() => openSaved(item)} className={`flex w-full items-center gap-4 p-4 text-left hover:bg-secondary/60 ${index === history.length - 1 ? "" : "border-b border-border"}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-accent-foreground"><Clock3 className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.output.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {item.audienceContext}</span></span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function PlannerField({ number, icon: Icon, title, help, value, onChange, placeholder, maxLength, rows = 3, required = false }: FieldProps) {
  return (
    <label className="rounded-3xl border border-border bg-card p-5">
      <span className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-accent-foreground"><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold"><span className="mr-2 font-mono text-xs text-muted-foreground">{number}</span>{title}{required ? <span className="ml-1 text-brand">*</span> : null}</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{help}</span>
        </span>
      </span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} rows={rows} placeholder={placeholder} className="mt-4 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-brand" />
      <span className="mt-1 block text-right font-mono text-[0.6rem] text-muted-foreground">{value.length}/{maxLength}</span>
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
    `Throughline: ${plan.output.throughline}`,
    "",
    `Opening: ${plan.output.opening}`,
    "",
    "Story beats:",
    ...plan.output.beats.map((beat, index) => `${index + 1}. ${beat.label}: ${beat.suggestion}`),
    "",
    `Ending: ${plan.output.ending}`,
    "",
    "Rehearsal outline:",
    plan.output.revisedPlan,
    "",
    "Delivery tips:",
    ...plan.output.deliveryTips.map((tip) => `- ${tip}`),
  ]
  return lines.join("\n")
}
