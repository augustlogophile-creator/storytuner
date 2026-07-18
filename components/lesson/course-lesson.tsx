"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { ArrowRight, Check, ChevronLeft, Loader2, Lock, Sparkles } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { ProgressBar } from "@/components/progress-bar"
import { RichText } from "@/components/rich-text"
import { courseProgress, FREE_UNIT_LIMIT, hasUnitPlanAccess, isUnitUnlocked, useApp } from "@/lib/app-state"
import { curriculum, lessonId, stageLabels, stageOrder, stageXp, type CurriculumUnit, type LessonStage } from "@/lib/curriculum"
import { cn } from "@/lib/utils"

type LessonFeedback = { pass: boolean; working: string; fix: string }

export function CourseLesson({ unit, stage }: { unit: CurriculumUnit; stage: LessonStage }) {
  const { state, ready, completeStage, saveResponse } = useApp()
  const key = lessonId(unit.id, stage)
  const alreadyDone = state.completed.includes(key)
  const [completed, setCompleted] = useState(alreadyDone)
  const [reviewing, setReviewing] = useState(false)
  const [earnedThisVisit, setEarnedThisVisit] = useState(false)
  const [response, setResponse] = useState(state.responses[key] ?? "")
  const course = courseProgress(state)
  const stages = stageOrder
  const stageIndex = stages.indexOf(stage)
  const priorStage = stages[stageIndex - 1]
  const planAccess = hasUnitPlanAccess(state, unit.index)
  const unlocked = isUnitUnlocked(state, unit.index) && (!priorStage || state.completed.includes(lessonId(unit.id, priorStage)))

  useEffect(() => { if (!reviewing) setCompleted(alreadyDone) }, [alreadyDone, reviewing])
  useEffect(() => {
    const timeout = window.setTimeout(() => saveResponse(key, response), 350)
    return () => window.clearTimeout(timeout)
  }, [key, response, saveResponse])

  function finish(responseText?: string, quizScore?: number) {
    if (!alreadyDone) setEarnedThisVisit(true)
    completeStage(unit.id, stage, responseText, quizScore)
    setCompleted(true)
    setReviewing(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (!ready) return <div className="h-72 animate-pulse rounded-3xl bg-secondary" />

  if (!planAccess) {
    return (
      <div className="flex min-w-0 flex-col gap-5">
        <BackLink href="/activities" label="Curriculum" />
        <section className="rounded-3xl border border-brand/30 bg-brand-soft/35 px-6 py-10 text-center">
          <Lock className="mx-auto h-8 w-8 text-accent-foreground" />
          <h1 className="mt-4 text-xl font-semibold">Unlock the rest of the course.</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">The free plan includes five complete lessons. Founding Membership unlocks all fifteen.</p>
          <Link href="/membership" className="mt-5 flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground">See Membership<ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>
    )
  }

  if (!unlocked && !completed) {
    return (
      <div className="flex flex-col gap-5">
        <BackLink href="/activities" label="Curriculum" />
        <section className="rounded-3xl border border-border bg-card px-6 py-10 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">This step is still locked.</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Complete the preceding course step first. Your progress will update automatically.</p>
          <Link href={`/activities/${unit.id}`} className="mt-5 flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground">Return to the unit<ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>
    )
  }

  if (completed && !reviewing) return <Completed unit={unit} stage={stage} coursePercent={course.percent} premium={state.premium} earnedThisVisit={earnedThisVisit} onReview={() => { setReviewing(true); setCompleted(false); window.scrollTo({ top: 0, behavior: "smooth" }) }} />

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BackLink href={`/activities/${unit.id}`} label={unit.title} />
      <header>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
            {stageLabels[stage]} · {alreadyDone ? "Review anytime" : `+${stageXp[stage]} XP`}
          </p>
          <span className="font-mono text-[0.62rem] text-muted-foreground">{course.percent}% course</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">
          {stage === "read" ? unit.title : stage === "drill" ? unit.drill.title : `${unit.title}: Check`}
        </h1>
      </header>
      {stage === "read" && <ReadStage unit={unit} onFinish={() => finish()} />}
      {stage === "drill" && <DrillStage unit={unit} response={response} setResponse={setResponse} onFinish={(value) => finish(value)} />}
      {stage === "quiz" && <QuizStage unit={unit} onFinish={(score) => finish(undefined, score)} />}
    </div>
  )
}

function ReadStage({ unit, onFinish }: { unit: CurriculumUnit; onFinish: () => void }) {
  const groups = useMemo(() => groupReadingSections(unit), [unit])
  const [active, setActive] = useState(0)
  const group = groups[active]
  const last = active === groups.length - 1

  return (
    <>
      <div className="sticky top-2 z-10 rounded-2xl border border-border bg-background/95 p-1.5 shadow-sm backdrop-blur">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
          {groups.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                "rounded-xl px-2 py-2.5 text-xs font-semibold transition-colors",
                active === index ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:bg-secondary",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {group.sections.map((section, index) => (
          <section key={section.heading} className={cn("rounded-3xl border p-5", active === 0 && index === 0 ? "border-brand/40 bg-brand-soft/35" : "border-border bg-card")}>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">{group.label}</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">{section.heading}</h2>
            <div className="mt-4"><RichText markdown={section.body} /></div>
          </section>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={active === 0}
          onClick={() => { setActive((value) => Math.max(0, value - 1)); window.scrollTo({ top: 0, behavior: "smooth" }) }}
          className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3.5 text-sm font-semibold disabled:opacity-35"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        {!last ? (
          <button
            type="button"
            onClick={() => { setActive((value) => Math.min(groups.length - 1, value + 1)); window.scrollTo({ top: 0, behavior: "smooth" }) }}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={onFinish} className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]">
            Complete <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </>
  )
}

function groupReadingSections(unit: CurriculumUnit) {
  const sections = unit.readSections
  if (sections.length <= 2) {
    return sections.map((section, index) => ({ label: index === 0 ? "Concept" : "Breakdown", sections: [section] }))
  }
  const exampleIndex = sections.findIndex((section) => /example|worked|before|after|case study/i.test(section.heading))
  const finalIndex = exampleIndex > 0 ? exampleIndex : sections.length - 1
  const concept = [sections[0]]
  const middle = sections.slice(1, finalIndex)
  const finalSections = sections.slice(finalIndex)
  const finalLabel = exampleIndex > 0 ? "Example" : unit.kind === "capstone" ? "Finish" : "Takeaway"
  return [
    { label: "Concept", sections: concept },
    { label: "Breakdown", sections: middle.length ? middle : [sections[1]] },
    { label: finalLabel, sections: finalSections },
  ]
}

function DrillStage({ unit, response, setResponse, onFinish }: { unit: CurriculumUnit; response: string; setResponse: (value: string) => void; onFinish: (value: string) => void }) {
  const [feedback, setFeedback] = useState<LessonFeedback | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const canSubmit = response.trim().length >= 30

  async function getFeedback() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "lesson", unitTitle: unit.title, technique: unit.skill, prompt: unit.drill.prompt, answer: response }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "The coach could not respond.")
      setFeedback(data as LessonFeedback)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Weaver could not respond right now.")
      setFeedback(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section className="rounded-3xl border border-border bg-card p-5">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">Your exercise</p>
        {unit.drill.prompt && <p className="mt-3 text-sm leading-7 text-foreground text-pretty">{unit.drill.prompt}</p>}
        {unit.drill.steps.length > 0 && (
          <ol className="mt-4 space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground">
            {unit.drill.steps.map((step, index) => <li key={index} className="list-decimal pl-1 marker:font-semibold marker:text-accent-foreground">{step}</li>)}
          </ol>
        )}
      </section>
      <section className="rounded-3xl border border-border bg-card p-5">
        <textarea value={response} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { setResponse(event.target.value); setFeedback(null) }} rows={9} placeholder="Work through the exercise here…" className="w-full resize-none rounded-2xl border border-border bg-background p-4 text-[0.95rem] leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand" />
        <div className="mt-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>{response.trim() ? response.trim().split(/\s+/).length : 0} words</span>
          <span>Your response saves on this device.</span>
        </div>
      </section>
      {error && <p className="rounded-2xl bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
      {feedback && (
        <section className="flex flex-col gap-3 rounded-3xl border border-brand/40 bg-brand-soft/35 p-5">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent-foreground" /><h2 className="text-sm font-semibold">Coach's read</h2></div>
          <div><p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">What is working</p><p className="mt-1 text-sm leading-relaxed text-foreground">{feedback.working}</p></div>
          <div><p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">One useful revision</p><p className="mt-1 text-sm leading-relaxed text-foreground">{feedback.fix}</p></div>
        </section>
      )}
      {!feedback ? (
        <button type="button" disabled={!canSubmit || loading} onClick={getFeedback} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-40">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading your response…</> : <><Sparkles className="h-4 w-4" /> Get focused feedback</>}
        </button>
      ) : (
        <button type="button" onClick={() => onFinish(response)} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]">
          Save and complete <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </>
  )
}

function QuizStage({ unit, onFinish }: { unit: CurriculumUnit; onFinish: (score: number) => void }) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const question = unit.quiz[index]
  const answered = selected !== null
  const correct = selected === question.correct

  function next() {
    const nextScore = score + (correct ? 1 : 0)
    if (index === unit.quiz.length - 1) {
      onFinish(nextScore)
      return
    }
    setScore(nextScore)
    setIndex((value) => value + 1)
    setSelected(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <>
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>Question {index + 1} of {unit.quiz.length}</span><span>{score} correct so far</span></div>
        <ProgressBar value={((index + (answered ? 1 : 0)) / unit.quiz.length) * 100} />
      </div>
      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold leading-snug text-balance">{question.question}</h2>
        <div className="mt-5 flex flex-col gap-2.5">
          {question.options.map((option, optionIndex) => {
            const isChosen = selected === optionIndex
            const isCorrect = optionIndex === question.correct
            return (
              <button key={option} type="button" disabled={answered} onClick={() => setSelected(optionIndex)} className={cn("rounded-2xl border p-4 text-left text-sm leading-relaxed transition-colors", !answered && "border-border bg-background hover:border-brand", answered && isCorrect && "border-brand bg-brand-soft/60", answered && isChosen && !isCorrect && "border-destructive/40 bg-destructive/5", answered && !isChosen && !isCorrect && "border-border bg-background opacity-60")}>
                <span className="mr-2 font-mono text-xs text-muted-foreground">{String.fromCharCode(65 + optionIndex)}</span>{option}
              </button>
            )
          })}
        </div>
      </section>
      {answered && (
        <section className={cn("rounded-3xl border p-5", correct ? "border-brand/40 bg-brand-soft/40" : "border-streak/30 bg-streak-soft/50")}>
          <div className="flex items-center gap-2"><span className={cn("flex h-7 w-7 items-center justify-center rounded-full", correct ? "bg-brand text-brand-foreground" : "bg-streak text-white")}><Check className="h-4 w-4" /></span><h3 className="text-sm font-semibold">{correct ? "Exactly." : "Not quite."}</h3></div>
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">{question.explanation}</p>
        </section>
      )}
      <button type="button" disabled={!answered} onClick={next} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-40">
        {index === unit.quiz.length - 1 ? "Finish check" : "Next question"}<ArrowRight className="h-4 w-4" />
      </button>
    </>
  )
}

function Completed({ unit, stage, coursePercent, premium, earnedThisVisit, onReview }: { unit: CurriculumUnit; stage: LessonStage; coursePercent: number; premium: boolean; earnedThisVisit: boolean; onReview: () => void }) {
  const stageIndex = stageOrder.indexOf(stage)
  const nextStage = stageOrder[stageIndex + 1]
  const unitIndex = curriculum.findIndex((item) => item.id === unit.id)
  const nextUnit = curriculum[unitIndex + 1]
  const nextUnitNeedsMembership = Boolean(nextUnit && !premium && nextUnit.index > FREE_UNIT_LIMIT)
  const primaryHref = nextStage ? `/lesson/${lessonId(unit.id, nextStage)}` : nextUnitNeedsMembership ? "/membership" : nextUnit ? `/activities/${nextUnit.id}` : "/arena"
  const primaryLabel = nextStage ? `Continue to ${stageLabels[nextStage].toLowerCase()}` : nextUnitNeedsMembership ? "Unlock the full course" : nextUnit ? `Open Unit ${nextUnit.index}` : "Record your capstone"
  return (
    <div className="flex flex-col items-center gap-5 rounded-3xl border border-border bg-card px-6 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-brand-foreground"><Check className="h-8 w-8" strokeWidth={2.6} /></span>
      <div><h1 className="text-xl font-semibold tracking-tight">Step complete.</h1><p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">You finished {stageLabels[stage].toLowerCase()} for “{unit.title}.”</p></div>
      <div className="flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-accent-foreground"><Sparkles className="h-4 w-4" />{earnedThisVisit ? `+${stageXp[stage]} XP earned` : "Progress already saved"}</div>
      <p className="text-xs text-muted-foreground">Your full course is {coursePercent}% complete.</p>
      <div className="flex w-full flex-col gap-2 pt-2">
        <Link href={primaryHref} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]">{primaryLabel}<ArrowRight className="h-4 w-4" /></Link>
        <button type="button" onClick={onReview} className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold"><Sparkles className="h-4 w-4" />Review or try again</button>
        <Link href={`/activities/${unit.id}`} className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" />Back to the unit</Link>
      </div>
    </div>
  )
}
