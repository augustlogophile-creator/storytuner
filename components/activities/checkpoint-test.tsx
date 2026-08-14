"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { ArrowRight, Check, ChevronLeft, ClipboardCheck, Loader2, RotateCcw, Sparkles, X } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { ProgressBar } from "@/components/progress-bar"
import { Celebration } from "@/components/ui/celebration"
import { CountUp } from "@/components/ui/count-up"
import { checkpointKey, type Checkpoint } from "@/lib/checkpoints"
import { curriculum } from "@/lib/curriculum"
import { isCheckpointComplete, isCheckpointUnlocked, useApp } from "@/lib/app-state"
import { cn } from "@/lib/utils"

type CheckpointFeedback = {
  pass: boolean
  score: number
  working: string
  gaps: string
  nextStep: string
}

type Phase = "questions" | "writing" | "complete"

export function CheckpointTest({ checkpoint }: { checkpoint: Checkpoint }) {
  const { state, ready, saveResponse, completeCheckpoint } = useApp()
  const key = checkpointKey(checkpoint.id)
  const alreadyComplete = isCheckpointComplete(state, checkpoint.id)
  const [phase, setPhase] = useState<Phase>(alreadyComplete ? "complete" : "questions")
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [mcScore, setMcScore] = useState(0)
  const [response, setResponse] = useState(state.responses[key] ?? "")
  const [feedback, setFeedback] = useState<CheckpointFeedback | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [earnedThisVisit, setEarnedThisVisit] = useState(false)
  const unlocked = isCheckpointUnlocked(state, checkpoint) || alreadyComplete

  useEffect(() => {
    const timeout = window.setTimeout(() => saveResponse(key, response), 350)
    return () => window.clearTimeout(timeout)
  }, [key, response, saveResponse])

  const wordCount = useMemo(() => response.trim() ? response.trim().split(/\s+/).length : 0, [response])
  const question = checkpoint.questions[questionIndex]
  const answered = selected !== null
  const correct = selected === question?.correct

  if (!ready) return null

  if (!unlocked) {
    return (
      <div className="flex flex-col gap-5">
        <BackLink href="/activities" label="Curriculum" />
        <section className="rounded-3xl border border-border bg-card px-6 py-10 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">This unit test is not ready yet.</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Finish Unit {checkpoint.afterUnit} first, then come back to test what you remember.</p>
          <Link href="/activities" className="mt-5 flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground">Back to the course<ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>
    )
  }

  if (phase === "complete") {
    const savedScore = state.quizScores[checkpoint.id]
    const nextUnit = curriculum.find((unit) => unit.index === checkpoint.afterUnit + 1)
    const nextHref = nextUnit ? `/activities/${nextUnit.id}` : "/arena"
    const nextLabel = nextUnit ? `Continue to Unit ${nextUnit.index}` : "Practice in the Arena"

    return (
      <div className="relative flex flex-col items-center gap-5 rounded-3xl border border-border bg-card px-6 py-10 text-center">
        <Celebration active={earnedThisVisit} label={earnedThisVisit ? `+${checkpoint.xp} XP` : undefined} />
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-brand-foreground"><Check className="h-8 w-8" strokeWidth={2.6} /></span>
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">{checkpoint.subtitle}</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">{checkpoint.title} complete.</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">You tested the ideas before moving on, instead of just recognizing them while reading.</p>
        </div>
        {typeof savedScore === "number" && (
          <div className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-foreground"><CountUp value={savedScore} suffix="%" /> overall</div>
        )}
        <div className="flex w-full flex-col gap-2 pt-2">
          <Link href={nextHref} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground">{nextLabel}<ArrowRight className="h-4 w-4" /></Link>
          <button type="button" onClick={() => { setPhase("questions"); setQuestionIndex(0); setSelected(null); setMcScore(0); setFeedback(null); setError(""); window.scrollTo({ top: 0 }) }} className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold"><RotateCcw className="h-4 w-4" />Retake the test</button>
          <Link href="/activities" className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-muted-foreground"><ChevronLeft className="h-4 w-4" />Back to curriculum</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BackLink href="/activities" label="Curriculum" />
      <header>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Unit test · {checkpoint.subtitle}</p>
          <span className="font-mono text-[0.62rem] text-muted-foreground">+{checkpoint.xp} XP</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">{checkpoint.title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{checkpoint.description}</p>
      </header>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{phase === "questions" ? `Part 1 · Question ${questionIndex + 1} of ${checkpoint.questions.length}` : "Part 2 · Apply it"}</span>
          <span>{phase === "questions" ? "Knowledge" : "AI checked"}</span>
        </div>
        <ProgressBar value={phase === "questions"
          ? ((questionIndex + (answered ? 1 : 0)) / (checkpoint.questions.length + 1)) * 100
          : feedback ? 100 : (checkpoint.questions.length / (checkpoint.questions.length + 1)) * 100} />
      </div>

      {phase === "questions" && question && (
        <>
          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold leading-snug text-balance">{question.question}</h2>
            <div className="mt-5 flex flex-col gap-2.5">
              {question.options.map((option, optionIndex) => {
                const isChosen = selected === optionIndex
                const isCorrect = optionIndex === question.correct
                return (
                  <button key={option} type="button" disabled={answered} onClick={() => setSelected(optionIndex)} className={cn("rounded-2xl border p-4 text-left text-sm leading-relaxed transition-colors active:scale-[0.99]", !answered && "border-border bg-background hover:border-brand", answered && isCorrect && "border-brand bg-brand-soft/60", answered && isChosen && !isCorrect && "border-destructive/40 bg-destructive/5", answered && !isChosen && !isCorrect && "border-border bg-background opacity-60")}>
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{String.fromCharCode(65 + optionIndex)}</span>{option}
                  </button>
                )
              })}
            </div>
          </section>

          {answered && (
            <section className={cn("rounded-3xl border p-5", correct ? "border-brand/40 bg-brand-soft/40" : "border-streak/30 bg-streak-soft/50")}>
              <div className="flex items-center gap-2"><span className={cn("flex h-7 w-7 items-center justify-center rounded-full", correct ? "bg-brand text-brand-foreground" : "bg-destructive text-destructive-foreground")}>{correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" strokeWidth={2.8} />}</span><h3 className="text-sm font-semibold">{correct ? "Exactly." : "Not quite."}</h3></div>
              <p className="mt-3 text-sm leading-relaxed text-foreground/90">{question.explanation}</p>
            </section>
          )}

          <button type="button" disabled={!answered} onClick={() => {
            const nextScore = mcScore + (correct ? 1 : 0)
            if (questionIndex === checkpoint.questions.length - 1) {
              setMcScore(nextScore)
              setPhase("writing")
            } else {
              setMcScore(nextScore)
              setQuestionIndex((value) => value + 1)
              setSelected(null)
            }
            window.scrollTo({ top: 0 })
          }} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
            {questionIndex === checkpoint.questions.length - 1 ? "Continue to written challenge" : "Next question"}<ArrowRight className="h-4 w-4" />
          </button>
        </>
      )}

      {phase === "writing" && (
        <>
          <section className="rounded-3xl border border-brand/25 bg-brand-soft/25 p-5">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">{checkpoint.writing.label}</p>
            <p className="mt-3 text-sm leading-7 text-foreground">{checkpoint.writing.prompt}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {checkpoint.writing.criteria.map((criterion) => <span key={criterion} className="rounded-full border border-border bg-card px-3 py-1.5 text-[0.66rem] text-muted-foreground">{criterion}</span>)}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <textarea value={response} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { setResponse(event.target.value); setFeedback(null) }} rows={checkpoint.writing.kind === "story" ? 12 : 9} placeholder={checkpoint.writing.kind === "story" ? "Write your story here…" : "Work through the challenge here…"} className="w-full resize-none rounded-2xl border border-border bg-background p-4 text-[0.95rem] leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand" />
            <div className="mt-2 flex items-center justify-between px-1 text-xs text-muted-foreground"><span>{wordCount} words</span><span>Minimum {checkpoint.writing.minWords}</span></div>
          </section>

          {error && <p className="rounded-2xl bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

          {feedback && (
            <section className="flex flex-col gap-4 rounded-3xl border border-brand/35 bg-brand-soft/30 p-5">
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand" /><h2 className="text-sm font-semibold">Parch's test read</h2></div><span className="text-lg font-semibold text-foreground">{feedback.score}%</span></div>
              <div><p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">What you understand</p><p className="mt-1 text-sm leading-relaxed text-foreground">{feedback.working}</p></div>
              <div><p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">What to review</p><p className="mt-1 text-sm leading-relaxed text-foreground">{feedback.gaps}</p></div>
              <div><p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">Next step</p><p className="mt-1 text-sm leading-relaxed text-foreground">{feedback.nextStep}</p></div>
            </section>
          )}

          {!feedback ? (
            <button type="button" disabled={wordCount < checkpoint.writing.minWords || loading} onClick={async () => {
              setLoading(true)
              setError("")
              try {
                const res = await fetch("/api/feedback", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    mode: "checkpoint",
                    checkpointId: checkpoint.id,
                    checkpointTitle: checkpoint.title,
                    afterUnit: checkpoint.afterUnit,
                    writingKind: checkpoint.writing.kind,
                    prompt: checkpoint.writing.prompt,
                    criteria: checkpoint.writing.criteria,
                    answer: response,
                  }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || "Parch could not grade this test right now.")
                setFeedback(data as CheckpointFeedback)
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Parch could not grade this test right now.")
              } finally {
                setLoading(false)
              }
            }} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Checking your work…</> : <><Sparkles className="h-4 w-4" />Grade written challenge</>}
            </button>
          ) : (
            <button type="button" onClick={() => {
              const mcPercent = Math.round((mcScore / checkpoint.questions.length) * 100)
              const finalScore = Math.round(mcPercent * 0.4 + feedback.score * 0.6)
              if (!alreadyComplete) setEarnedThisVisit(true)
              completeCheckpoint(checkpoint.id, response, finalScore, checkpoint.xp)
              setPhase("complete")
              window.scrollTo({ top: 0 })
            }} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground">
              Complete unit test <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </div>
  )
}
