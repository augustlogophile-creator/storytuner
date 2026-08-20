"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  Mic2,
} from "lucide-react"
import { Eyebrow } from "@/components/eyebrow"
import type { StoryPlanRecord } from "@/lib/planner/types"
import { downloadStoryPlanPdf } from "@/lib/planner/plan-pdf"
import { secondPersonDirection } from "@/lib/planner/voice"

export function SavedPlansClient() {
  const [plans, setPlans] = useState<StoryPlanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    void loadPlans()
  }, [])

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

  async function copyPlan(plan: StoryPlanRecord) {
    await navigator.clipboard.writeText(formatPlan(plan))
    setCopiedId(plan.id)
    window.setTimeout(() => setCopiedId((current) => current === plan.id ? null : current), 1600)
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

  return (
    <div className="planner-library-page">
      <header className="planner-library-topbar">
        <Link href="/planner" className="planner-library-back"><ArrowLeft /> Planner</Link>
        <span>Tellwise</span>
      </header>

      <div className="planner-library-heading">
        <Eyebrow>Saved privately</Eyebrow>
        <h1>Your story plans</h1>
        <p>Every plan in one place. Open it, copy it, export it, or take it straight back into Studio.</p>
      </div>

      {loading ? (
        <div className="planner-library-stack" aria-busy="true">
          <div className="planner-library-card planner-library-skeleton" />
          <div className="planner-library-card planner-library-skeleton" />
        </div>
      ) : error ? (
        <div className="planner-library-empty">
          <p>{error}</p>
          <button type="button" onClick={() => void loadPlans()}>Try again</button>
        </div>
      ) : plans.length === 0 ? (
        <div className="planner-library-empty">
          <p>Your first saved plan will appear here after Parch builds it.</p>
          <Link href="/planner">Build a plan</Link>
        </div>
      ) : (
        <div className="planner-library-stack">
          {plans.map((plan) => {
            const expanded = expandedId === plan.id
            return (
              <article key={plan.id} className={expanded ? "planner-library-card is-expanded" : "planner-library-card"}>
                <div className="planner-library-meta">
                  <span>{new Date(plan.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span>{plan.audienceContext}</span>
                </div>
                <h2>{plan.output.title}</h2>
                <p className="planner-library-throughline">{secondPersonDirection(plan.output.throughline)}</p>

                <div className="planner-library-actions">
                  <button type="button" onClick={() => void copyPlan(plan)}>
                    {copiedId === plan.id ? <Check /> : <Clipboard />}
                    {copiedId === plan.id ? "Copied" : "Copy"}
                  </button>
                  <button type="button" onClick={() => downloadStoryPlanPdf(plan)}><Download /> PDF</button>
                  <button type="button" className="is-expand" onClick={() => setExpandedId((current) => current === plan.id ? null : plan.id)}>
                    {expanded ? "Hide plan" : "View full plan"}<ChevronDown className={expanded ? "rotate-180" : ""} />
                  </button>
                </div>

                {expanded && (
                  <div className="planner-library-expanded">
                    <PlanSection title="Opening" text={secondPersonDirection(plan.output.opening)} />
                    <div className="planner-library-beats">
                      <Eyebrow>Story beats</Eyebrow>
                      <ol>
                        {plan.output.beats.map((beat, index) => (
                          <li key={`${plan.id}-${beat.label}-${index}`}>
                            <span>{index + 1}</span>
                            <div>
                              <strong>{beat.label}</strong>
                              <p>{secondPersonDirection(beat.suggestion)}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <PlanSection title="Landing" text={secondPersonDirection(plan.output.ending)} />
                    <div className="planner-library-reminders">
                      <Eyebrow>Remember</Eyebrow>
                      <ul>
                        {plan.output.deliveryTips.slice(0, 2).map((tip) => <li key={tip}>{secondPersonDirection(tip)}</li>)}
                      </ul>
                    </div>
                  </div>
                )}

                <Link href="/studio?mode=free&planned=1" onClick={() => prepareForStudio(plan)} className="planner-library-practice">
                  <Mic2 /> Practice this plan
                </Link>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PlanSection({ title, text }: { title: string; text: string }) {
  return (
    <div className="planner-library-plan-section">
      <Eyebrow>{title}</Eyebrow>
      <p>{text}</p>
    </div>
  )
}

function formatPlan(plan: StoryPlanRecord) {
  return [
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
  ].join("\n")
}
