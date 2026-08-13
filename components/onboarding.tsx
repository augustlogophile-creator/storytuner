"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import { ArrowLeft, Check } from "lucide-react"
import {
  blockerLabels,
  goalLabels,
  readOnboardingPreferences,
  writeOnboardingPreferences,
  type OnboardingPreferences,
  type StoryBlocker,
  type StoryGoal,
} from "@/lib/onboarding-preferences"

const TOTAL_STEPS = 5

const goalDetails: Array<{ value: Exclude<StoryGoal, "">; title: string; detail?: string }> = [
  { value: "everyday", title: "Everyday stories", detail: "Tell better stories with friends." },
  { value: "speaking", title: "Interviews & speaking", detail: "Answer clearly and confidently." },
  { value: "writing", title: "Writing", detail: "Turn experiences into stronger stories." },
  { value: "confidence", title: "Confidence", detail: "Feel better when people are listening." },
  { value: "everything", title: "Everything" },
]

const blockers: Array<Exclude<StoryBlocker, "">> = ["ramble", "start", "boring", "details", "nervous", "confident"]

export function Onboarding() {
  const [page, setPage] = useState(0)
  const [preferences, setPreferences] = useState<OnboardingPreferences>({ goal: "", blocker: "" })

  useEffect(() => {
    setPreferences(readOnboardingPreferences())
  }, [])

  const progress = ((page + 1) / TOTAL_STEPS) * 100
  const canContinue = page !== 1 || Boolean(preferences.goal)
  const canContinueBlocker = page !== 2 || Boolean(preferences.blocker)

  function save(next: OnboardingPreferences) {
    setPreferences(next)
    writeOnboardingPreferences(next)
  }

  function next() {
    if (!canContinue || !canContinueBlocker) return
    setPage((current) => Math.min(TOTAL_STEPS - 1, current + 1))
  }

  return (
    <main className="min-h-svh bg-background">
      <section className="intro-shell mx-auto flex min-h-svh w-full max-w-md flex-col border-border bg-card sm:border-x">
        <header className="intro-topbar">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center">
            {page > 0 && (
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                aria-label="Go back"
                className="intro-back-button"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
              </button>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between text-[0.68rem] font-medium text-muted-foreground">
              <span>{page + 1} of {TOTAL_STEPS}</span>
            </div>
            <div className="intro-progress-track" aria-label={`Introduction step ${page + 1} of ${TOTAL_STEPS}`}>
              <div className="intro-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </header>

        <div key={page} className="intro-page flex min-h-0 flex-1 flex-col">
          {page === 0 && <WelcomeScreen />}
          {page === 1 && (
            <GoalScreen value={preferences.goal} onChoose={(goal) => save({ ...preferences, goal })} />
          )}
          {page === 2 && (
            <BlockerScreen value={preferences.blocker} onChoose={(blocker) => save({ ...preferences, blocker })} />
          )}
          {page === 3 && <SecretScreen />}
          {page === 4 && <ReadyScreen preferences={preferences} />}
        </div>

        <footer className="intro-footer">
          {page < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={next}
              disabled={!canContinue || !canContinueBlocker}
              className="intro-bottom-action"
            >
              {page === 0 ? "Let’s start" : "Continue"}
            </button>
          ) : (
            <div>
              <Link href="/sign-up" className="intro-bottom-action flex items-center justify-center">
                Start learning
              </Link>
              <p className="mt-2.5 text-center text-[0.68rem] text-muted-foreground">
                Already have an account?{" "}
                <Link href="/sign-up?mode=sign-in" className="font-semibold text-foreground underline-offset-4 hover:underline">Log in</Link>
              </p>
            </div>
          )}
        </footer>
      </section>
    </main>
  )
}

function WelcomeScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-7 pb-4 text-center">
      <div className="intro-hero-stage intro-mascot-in">
        <span className="intro-sparkle intro-sparkle-left">✦</span>
        <span className="intro-sparkle intro-sparkle-right">✦</span>
        <Image src="/parch-welcoming.png" alt="Parch waving hello" width={320} height={316} priority className="h-auto w-[13.2rem] object-contain" />
      </div>
      <h1 className="intro-title-reveal mt-5 text-[2.35rem] font-semibold leading-[1.01] tracking-[-0.055em] text-balance">Welcome to StoryTuner.</h1>
      <p className="intro-copy-reveal mt-4 max-w-[19rem] text-[1rem] leading-6 text-muted-foreground text-pretty">Learn to tell stories people actually want to hear.</p>
      <StepDots active={0} />
    </div>
  )
}

function GoalScreen({ value, onChoose }: { value: StoryGoal; onChoose: (value: Exclude<StoryGoal, "">) => void }) {
  return (
    <div className="flex flex-1 flex-col px-5 pb-1 pt-3">
      <div className="intro-question-header">
        <h1 className="intro-title-reveal max-w-[14.5rem] text-[2rem] font-semibold leading-[1.02] tracking-[-0.05em] text-balance">What do you want to get better at?</h1>
        <Image src="/parch-thinking.png" alt="Parch thinking" width={290} height={318} className="intro-side-parch h-auto w-[7.5rem] object-contain" />
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {goalDetails.map((option, index) => (
          <ChoiceButton
            key={option.value}
            selected={value === option.value}
            delay={index * 42}
            onClick={() => onChoose(option.value)}
          >
            <span className="block text-[0.92rem] font-semibold tracking-[-0.02em]">{option.title}</span>
            {option.detail && <span className="mt-0.5 block text-[0.72rem] leading-5 text-muted-foreground">{option.detail}</span>}
          </ChoiceButton>
        ))}
      </div>
    </div>
  )
}

function BlockerScreen({ value, onChoose }: { value: StoryBlocker; onChoose: (value: Exclude<StoryBlocker, "">) => void }) {
  return (
    <div className="flex flex-1 flex-col px-5 pb-1 pt-1">
      <div className="flex flex-col items-center text-center">
        <Image src="/parch-confused.png" alt="Parch looking confused" width={326} height={364} className="intro-mascot-in h-auto w-[7.3rem] object-contain" />
        <h1 className="intro-title-reveal -mt-1 max-w-[20rem] text-[1.85rem] font-semibold leading-[1.04] tracking-[-0.045em] text-balance">What usually gets in your way?</h1>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {blockers.map((blocker, index) => (
          <ChoiceButton
            key={blocker}
            selected={value === blocker}
            delay={index * 35}
            compact
            onClick={() => onChoose(blocker)}
          >
            <span className="block text-[0.84rem] font-semibold tracking-[-0.015em]">{blockerLabels[blocker]}</span>
          </ChoiceButton>
        ))}
      </div>
    </div>
  )
}

function SecretScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-2 text-center">
      <div className="intro-secret-stage">
        <span className="intro-sparkle intro-sparkle-left">✦</span>
        <span className="intro-sparkle intro-sparkle-right">✦</span>
        <Image src="/parch-intro-detective.png" alt="Parch looking closely through a magnifying glass" width={297} height={320} className="intro-mascot-in h-auto w-[12.4rem] object-contain" />
      </div>
      <div className="mt-3 min-h-[1.5rem] text-[0.82rem] font-medium text-muted-foreground">
        <TypingText text="Here’s the secret." />
      </div>
      <h1 className="intro-title-reveal mt-2 max-w-[21rem] text-[1.95rem] font-semibold leading-[1.04] tracking-[-0.05em] text-balance">Great stories aren’t about having an extraordinary life.</h1>
      <p className="intro-copy-reveal mt-4 max-w-[20rem] text-[0.92rem] leading-6 text-muted-foreground text-pretty">
        They’re about knowing <strong className="font-semibold text-foreground">what to notice, what to leave out, and what to make people care about.</strong>
      </p>
      <StepDots active={3} />
    </div>
  )
}

function ReadyScreen({ preferences }: { preferences: OnboardingPreferences }) {
  const items = ["Learn", "Practice", "Get feedback", "Improve"]

  return (
    <div className="flex flex-1 flex-col items-center px-5 pb-1 pt-3 text-center">
      <h1 className="intro-title-reveal text-[2.3rem] font-semibold leading-[1.02] tracking-[-0.055em] text-balance">StoryTuner is ready.</h1>
      <p className="intro-copy-reveal mt-3 max-w-[20rem] text-[0.92rem] leading-6 text-muted-foreground text-pretty">You’ll learn one idea at a time, then practice it in stories of your own.</p>

      <div className="mt-5 grid w-full gap-2">
        {items.map((item, index) => (
          <div key={item} className="intro-ready-row" style={{ animationDelay: `${110 + index * 55}ms` }}>
            <span className="intro-ready-number">{index + 1}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="relative mt-auto flex min-h-[10.5rem] w-full items-end justify-center pt-3">
        <span className="intro-celebrate-glow" />
        <Image src="/parch-celebrating.png" alt="Parch celebrating" width={364} height={381} className="intro-mascot-in relative z-10 h-auto w-[10rem] object-contain" />
      </div>
      <StepDots active={4} />
      {(preferences.goal || preferences.blocker) && (
        <p className="mt-2 text-[0.62rem] leading-4 text-muted-foreground/80">
          {preferences.goal && preferences.goal !== "everything" ? `Starting focus: ${goalLabels[preferences.goal]}. ` : ""}
          Your setup will help Parch make coaching more relevant.
        </p>
      )}
    </div>
  )
}

function ChoiceButton({
  selected,
  delay,
  compact = false,
  onClick,
  children,
}: {
  selected: boolean
  delay: number
  compact?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`intro-choice intro-choice-in ${compact ? "intro-choice-compact" : ""}`}
      data-selected={selected}
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <span className={`intro-choice-check ${selected ? "is-selected" : ""}`} aria-hidden="true">
        {selected && <Check className="h-4 w-4" strokeWidth={2.8} />}
      </span>
    </button>
  )
}

function StepDots({ active }: { active: number }) {
  return (
    <div className="mt-5 flex items-center justify-center gap-2" aria-hidden="true">
      {Array.from({ length: TOTAL_STEPS }, (_, index) => (
        <span key={index} className={`h-2 w-2 rounded-full transition-all ${index === active ? "w-4 bg-brand" : "bg-border"}`} />
      ))}
    </div>
  )
}

function TypingText({ text, speed = 52 }: { text: string; speed?: number }) {
  const [visible, setVisible] = useState("")

  useEffect(() => {
    setVisible("")
    let index = 0
    const timer = window.setInterval(() => {
      index += 1
      setVisible(text.slice(0, index))
      if (index >= text.length) window.clearInterval(timer)
    }, speed)
    return () => window.clearInterval(timer)
  }, [text, speed])

  return (
    <span className="intro-typing-line">
      {visible}
      <span className="intro-typing-cursor">|</span>
    </span>
  )
}
