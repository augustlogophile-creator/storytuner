"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ClipboardCheck, Loader2, RotateCcw, Sparkles, X } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { ProgressBar } from "@/components/progress-bar"
import { Celebration } from "@/components/ui/celebration"
import { CountUp } from "@/components/ui/count-up"
import { CHECKPOINT_PASSING_SCORE, checkpointKey, type Checkpoint } from "@/lib/checkpoints"
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

type Result = {
  mcScore: number
  mcPercent: number
  writingPercent: number
  finalScore: number
  passed: boolean
}

type Phase = "questions" | "writing" | "results" | "complete"

function resultTheme(score: number) {
  if (score >= 80) {
    return {
      emoji: "🏆",
      label: "Strong command",
      panel: "border-[#9fd7b2] bg-[#f1fbf4]",
      chip: "bg-[#dff4e5] text-[#287b44]",
      score: "text-[#287b44]",
      bar: "bg-[#48a86a]",
    }
  }
  if (score >= CHECKPOINT_PASSING_SCORE) {
    return {
      emoji: "👍",
      label: "Pass",
      panel: "border-[#efc982] bg-[#fff8e9]",
      chip: "bg-[#ffedc8] text-[#9b6217]",
      score: "text-[#b16c17]",
      bar: "bg-[#e3a33f]",
    }
  }
  return {
    emoji: "📖",
    label: "Review and retake",
    panel: "border-[#e9adab] bg-[#fff3f2]",
    chip: "bg-[#f9d9d7] text-[#a33c38]",
    score: "text-[#bd4842]",
    bar: "bg-[#d85d57]",
  }
}

const foundationsCompleteTheme = {
  emoji: "✓",
  label: "Passed",
  panel: "border-[#b9a3dc] bg-[#f5f0fb]",
  chip: "bg-[#e9def6] text-[#694f93]",
  score: "text-[#694f93]",
  bar: "bg-[#8b6fb2]",
}

export function CheckpointTest({ checkpoint }: { checkpoint: Checkpoint }) {
  const { state, ready, saveResponse, completeCheckpoint } = useApp()
  const key = checkpointKey(checkpoint.id)
  const alreadyComplete = isCheckpointComplete(state, checkpoint.id)
  const [phase, setPhase] = useState<Phase>(alreadyComplete ? "complete" : "questions")
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Array<number | null>>(() => checkpoint.questions.map(() => null))
  const [response, setResponse] = useState(state.responses[key] ?? "")
  const [feedback, setFeedback] = useState<CheckpointFeedback | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [earnedThisVisit, setEarnedThisVisit] = useState(false)
  const unlocked = isCheckpointUnlocked(state, checkpoint) || alreadyComplete
  const isFoundations = checkpoint.id === "foundations-check"

  useEffect(() => {
    const timeout = window.setTimeout(() => saveResponse(key, response), 350)
    return () => window.clearTimeout(timeout)
  }, [key, response, saveResponse])

  const wordCount = useMemo(() => response.trim() ? response.trim().split(/\s+/).length : 0, [response])
  const question = checkpoint.questions[questionIndex]
  const currentAnswer = answers[questionIndex]
  const answeredCount = answers.filter((answer) => answer !== null).length
  const knowledgeProgress = (answeredCount / checkpoint.questions.length) * 72
  const overallProgress = phase === "questions" ? knowledgeProgress : phase === "writing" ? 86 : 100

  function updateAnswer(optionIndex: number) {
    setAnswers((current) => current.map((answer, index) => index === questionIndex ? optionIndex : answer))
  }

  function resetTest() {
    setPhase("questions")
    setQuestionIndex(0)
    setAnswers(checkpoint.questions.map(() => null))
    setResponse("")
    setFeedback(null)
    setResult(null)
    setError("")
    setEarnedThisVisit(false)
    saveResponse(key, "")
    window.scrollTo({ top: 0, behavior: "auto" })
  }

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
    const theme = isFoundations
      ? foundationsCompleteTheme
      : resultTheme(typeof savedScore === "number" ? savedScore : 100)

    return (
      <div className={cn("relative flex flex-col items-center gap-5 rounded-3xl border px-6 py-10 text-center", theme.panel)}>
        <div className={cn("text-4xl", isFoundations && "flex h-12 w-12 items-center justify-center rounded-full bg-[#e4d8f3] text-2xl font-semibold text-[#694f93]")} aria-hidden="true">{theme.emoji}</div>
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">{checkpoint.subtitle}</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">{checkpoint.title} passed.</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">You cleared the checkpoint. You can retake it any time if you want a harder second pass.</p>
        </div>
        {typeof savedScore === "number" && (
          <div className={cn("rounded-full px-4 py-2 text-sm font-semibold", theme.chip)}><CountUp value={savedScore} suffix="%" /> overall</div>
        )}
        <div className="flex w-full flex-col gap-2 pt-2">
          <Link href={nextHref} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground">{nextLabel}<ArrowRight className="h-4 w-4" /></Link>
          <button type="button" onClick={resetTest} className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold"><RotateCcw className="h-4 w-4" />Retake the test</button>
          <Link href="/activities" className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-muted-foreground"><ChevronLeft className="h-4 w-4" />Back to curriculum</Link>
        </div>
      </div>
    )
  }

  if (phase === "results" && result && feedback) {
    const theme = resultTheme(result.finalScore)
    const resultPanel = isFoundations ? "border-[#b9a3dc] bg-[#f5f0fb]" : theme.panel
    const nextUnit = curriculum.find((unit) => unit.index === checkpoint.afterUnit + 1)
    const nextHref = nextUnit ? `/activities/${nextUnit.id}` : "/arena"
    const nextLabel = nextUnit ? `Continue to Unit ${nextUnit.index}` : "Practice in the Arena"

    return (
      <div className="relative flex min-w-0 flex-col gap-5">
        <Celebration active={result.passed && earnedThisVisit} label={result.passed && earnedThisVisit ? `+${checkpoint.xp} XP` : undefined} />
        <BackLink href="/activities" label="Curriculum" />

        <section className={cn("rounded-[2rem] border p-6 text-center", resultPanel)}>
          <div className="text-5xl" aria-hidden="true">{theme.emoji}</div>
          <div className={cn("mx-auto mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold", theme.chip)}>{theme.label}</div>
          <div className={cn("mt-3 text-5xl font-semibold tracking-[-0.05em]", theme.score)}><CountUp value={result.finalScore} suffix="%" /></div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">{result.passed ? "You passed." : "Retake required."}</h1>
          <p className="mx-auto mt-2 max-w-[30rem] text-sm leading-relaxed text-muted-foreground">
            {result.passed
              ? result.finalScore >= 80
                ? "You showed strong control of the ideas in this block."
                : "You cleared the checkpoint. Review the weaker areas before moving on."
              : `A score of ${CHECKPOINT_PASSING_SCORE}% is required to continue. Review the results below, then take the full test again.`}
          </p>

          <div className="mt-5 overflow-hidden rounded-full bg-black/5">
            <div className={cn("h-2 rounded-full transition-[width] duration-700", theme.bar)} style={{ width: `${result.finalScore}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[0.66rem] text-muted-foreground"><span>0</span><span>{CHECKPOINT_PASSING_SCORE}% to pass</span><span>100</span></div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-border bg-card p-4 text-center">
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">Knowledge</p>
            <p className="mt-2 text-2xl font-semibold">{result.mcPercent}%</p>
            <p className="mt-1 text-xs text-muted-foreground">{result.mcScore} of {checkpoint.questions.length} correct</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-4 text-center">
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">Application</p>
            <p className="mt-2 text-2xl font-semibold">{result.writingPercent}%</p>
            <p className="mt-1 text-xs text-muted-foreground">AI-graded challenge</p>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Knowledge review</h2><span className="text-xs text-muted-foreground">Answers revealed</span></div>
          <div className="mt-4 flex flex-col divide-y divide-border">
            {checkpoint.questions.map((item, index) => {
              const chosen = answers[index]
              const correct = chosen === item.correct
              return (
                <div key={item.question} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", correct ? "bg-[#e0f4e6] text-[#2d7f48]" : "bg-[#f9dedc] text-[#b44540]")}>{correct ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-relaxed">{index + 1}. {item.question}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.explanation}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand" /><h2 className="text-sm font-semibold">Parch's assessment</h2></div>
          <div className="mt-4 grid gap-4">
            <div><p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">What you understand</p><p className="mt-1 text-sm leading-relaxed text-foreground">{feedback.working}</p></div>
            <div><p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">What to review</p><p className="mt-1 text-sm leading-relaxed text-foreground">{feedback.gaps}</p></div>
            <div><p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">Next step</p><p className="mt-1 text-sm leading-relaxed text-foreground">{feedback.nextStep}</p></div>
          </div>
        </section>

        <div className="flex flex-col gap-2">
          {result.passed ? (
            <Link href={nextHref} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground">{nextLabel}<ArrowRight className="h-4 w-4" /></Link>
          ) : (
            <button type="button" onClick={resetTest} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground"><RotateCcw className="h-4 w-4" />Review and retake</button>
          )}
          <Link href="/activities" className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-muted-foreground"><ChevronLeft className="h-4 w-4" />Back to curriculum</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BackLink href="/activities" label="Curriculum" />

      <header className={cn("rounded-[1.8rem] border p-5", isFoundations ? "border-[#c9b8e5] bg-[#f8f4fc]" : "border-[#ead39d] bg-[#fffaf0]")}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className={cn("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[0.6rem] font-mono font-semibold uppercase tracking-[0.16em]", isFoundations ? "bg-[#eee6f8] text-[#6f5599]" : "bg-[#fff0c7] text-[#956119]")}><ClipboardCheck className="h-3.5 w-3.5" />Unit test</div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance">{checkpoint.title}</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{checkpoint.description}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">{checkpoint.subtitle}</p>
            <p className={cn("mt-1 text-xs font-medium", isFoundations ? "text-[#6f5599]" : "text-[#956119]")}>~{checkpoint.estimatedMinutes} min</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className={cn("rounded-full border bg-white/70 px-3 py-1.5", isFoundations ? "border-[#c9b8e5]" : "border-[#ead39d]")}>{checkpoint.questions.length} knowledge questions</span>
          <span className={cn("rounded-full border bg-white/70 px-3 py-1.5", isFoundations ? "border-[#c9b8e5]" : "border-[#ead39d]")}>1 AI-graded challenge</span>
          <span className={cn("rounded-full border bg-white/70 px-3 py-1.5", isFoundations ? "border-[#c9b8e5]" : "border-[#ead39d]")}>{CHECKPOINT_PASSING_SCORE}% to pass</span>
        </div>
      </header>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{phase === "questions" ? `Knowledge · ${questionIndex + 1} of ${checkpoint.questions.length}` : "Application challenge"}</span>
          <span>{Math.round(overallProgress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className={cn("h-full rounded-full transition-[width] duration-300", isFoundations ? "bg-[#8b6fb2]" : "bg-[#d8a548]")} style={{ width: `${overallProgress}%` }} /></div>
      </div>

      {phase === "questions" && question && (
        <>
          <section className="rounded-3xl border border-border bg-card p-5">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">Question {questionIndex + 1}</p>
            <h2 className="mt-2 text-lg font-semibold leading-snug text-balance">{question.question}</h2>
            <div className="mt-5 flex flex-col gap-2.5">
              {question.options.map((option, optionIndex) => {
                const isChosen = currentAnswer === optionIndex
                return (
                  <button key={option} type="button" onClick={() => updateAnswer(optionIndex)} className={cn(
                    "rounded-2xl border p-4 text-left text-sm leading-relaxed transition-all active:scale-[0.99]",
                    isChosen
                      ? isFoundations
                        ? "border-[#9e82c7] bg-[#f2ecfa] shadow-[0_0_0_1px_rgba(139,111,178,.08)]"
                        : "border-brand bg-brand-soft/55 shadow-[0_0_0_1px_rgba(48,132,220,.08)]"
                      : isFoundations
                        ? "border-border bg-background hover:border-[#b9a3dc]"
                        : "border-border bg-background hover:border-brand/50",
                  )}>
                    <span className={cn(
                      "mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[0.7rem]",
                      isChosen
                        ? isFoundations
                          ? "bg-[#8b6fb2] text-white"
                          : "bg-brand text-brand-foreground"
                        : "bg-secondary text-muted-foreground",
                    )}>{String.fromCharCode(65 + optionIndex)}</span>{option}
                  </button>
                )
              })}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Your answer will not be graded until the full test is submitted.</p>
          </section>

          <div className="flex gap-2">
            {questionIndex > 0 && <button type="button" onClick={() => setQuestionIndex((value) => value - 1)} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3.5 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Previous</button>}
            <button type="button" disabled={currentAnswer === null} onClick={() => {
              if (questionIndex === checkpoint.questions.length - 1) setPhase("writing")
              else setQuestionIndex((value) => value + 1)
            }} className="flex flex-[1.35] items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
              {questionIndex === checkpoint.questions.length - 1 ? "Continue to challenge" : "Next question"}<ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {phase === "writing" && (
        <>
          <section className={cn("rounded-3xl border p-5", isFoundations ? "border-[#c9b8e5] bg-[#f8f4fc]" : "border-[#ead39d] bg-[#fffaf0]")}>
            <div className="flex items-center justify-between gap-3"><p className={cn("font-mono text-[0.6rem] uppercase tracking-[0.16em]", isFoundations ? "text-[#6f5599]" : "text-[#956119]")}>{checkpoint.writing.label}</p><span className="text-xs text-muted-foreground">Worth 50%</span></div>
            <p className="mt-3 text-sm leading-7 text-foreground">{checkpoint.writing.prompt}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {checkpoint.writing.criteria.map((criterion) => <span key={criterion} className={cn("rounded-full border bg-white/75 px-3 py-1.5 text-[0.66rem] text-muted-foreground", isFoundations ? "border-[#c9b8e5]" : "border-[#ead39d]")}>{criterion}</span>)}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <textarea value={response} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { setResponse(event.target.value); setFeedback(null); setResult(null) }} rows={checkpoint.writing.kind === "story" ? 13 : 10} placeholder={checkpoint.writing.kind === "story" ? "Write your story here…" : "Work through the challenge here…"} className="w-full resize-none rounded-2xl border border-border bg-background p-4 text-[0.95rem] leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand" />
            <div className="mt-2 flex items-center justify-between px-1 text-xs text-muted-foreground"><span>{wordCount} words</span><span>Minimum {checkpoint.writing.minWords}</span></div>
          </section>

          {error && <p className="rounded-2xl bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <button type="button" disabled={loading} onClick={() => { setPhase("questions"); setQuestionIndex(checkpoint.questions.length - 1); window.scrollTo({ top: 0, behavior: "auto" }) }} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3.5 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Back</button>
            <button type="button" disabled={wordCount < checkpoint.writing.minWords || loading || answers.some((answer) => answer === null)} onClick={async () => {
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
                const checkpointFeedback = data as CheckpointFeedback
                const mcScore = checkpoint.questions.reduce((total, item, index) => total + (answers[index] === item.correct ? 1 : 0), 0)
                const mcPercent = Math.round((mcScore / checkpoint.questions.length) * 100)
                const finalScore = Math.round(mcPercent * 0.5 + checkpointFeedback.score * 0.5)
                const passed = finalScore >= CHECKPOINT_PASSING_SCORE
                setFeedback(checkpointFeedback)
                setResult({ mcScore, mcPercent, writingPercent: checkpointFeedback.score, finalScore, passed })
                if (passed) {
                  if (!alreadyComplete) setEarnedThisVisit(true)
                  completeCheckpoint(checkpoint.id, response, finalScore, checkpoint.xp)
                }
                setPhase("results")
                window.scrollTo({ top: 0, behavior: "auto" })
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Parch could not grade this test right now.")
              } finally {
                setLoading(false)
              }
            }} className="flex flex-[1.5] items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Grading full test…</> : <><Sparkles className="h-4 w-4" />Submit full test</>}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
