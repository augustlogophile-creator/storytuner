"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
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

  const progress = [5, 26, 48, 72, 94][page] ?? 100
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
    <main className="min-h-svh bg-card">
      <section className="mx-auto flex min-h-svh w-full max-w-md flex-col bg-card px-5 pb-[max(1.2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:border-x sm:border-border">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0}
            aria-label="Go back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground disabled:opacity-0"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
          </button>
          <div className="intro-progress-track flex-1" aria-label={`Introduction step ${page + 1} of ${TOTAL_STEPS}`}>
            <div className="intro-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </header>

        <div key={page} className="app-page-enter flex flex-1 flex-col">
          {page === 0 && <WelcomeScreen />}
          {page === 1 && (
            <ChoiceScreen title="What do you want to get better at?">
              {goalDetails.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="intro-choice"
                  data-selected={preferences.goal === option.value}
                  onClick={() => save({ ...preferences, goal: option.value })}
                >
                  <span className="block text-[0.9rem] font-semibold tracking-[-0.015em]">{option.title}</span>
                  {option.detail && <span className="mt-0.5 block text-[0.72rem] leading-5 text-muted-foreground">{option.detail}</span>}
                </button>
              ))}
            </ChoiceScreen>
          )}
          {page === 2 && (
            <ChoiceScreen title="What usually gets in your way?">
              {blockers.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="intro-choice py-3.5"
                  data-selected={preferences.blocker === value}
                  onClick={() => save({ ...preferences, blocker: value })}
                >
                  <span className="block text-[0.88rem] font-semibold tracking-[-0.012em]">{blockerLabels[value]}</span>
                </button>
              ))}
            </ChoiceScreen>
          )}
          {page === 3 && <SecretScreen />}
          {page === 4 && <ReadyScreen preferences={preferences} />}
        </div>

        <footer className="pt-4">
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
              <p className="mt-3 text-center text-[0.72rem] text-muted-foreground">
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
    <div className="flex flex-1 flex-col items-center justify-center px-2 pb-10 text-center">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.19em] text-muted-foreground">StoryTuner</p>
      <h1 className="mt-4 text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.05em] text-balance">Welcome to StoryTuner.</h1>
      <p className="mt-5 max-w-xs text-[1rem] leading-7 text-muted-foreground text-pretty">Learn to tell stories people actually want to hear.</p>
    </div>
  )
}

function ChoiceScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col pt-9">
      <h1 className="mx-auto max-w-sm text-center text-[1.8rem] font-semibold leading-[1.08] tracking-[-0.04em] text-balance">{title}</h1>
      <div className="mt-7 flex flex-col gap-2.5">{children}</div>
    </div>
  )
}

function SecretScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-3 pb-8 text-center">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">Here’s the secret</p>
      <h1 className="mt-4 max-w-sm text-[2rem] font-semibold leading-[1.08] tracking-[-0.045em] text-balance">Great stories aren’t about having an extraordinary life.</h1>
      <p className="mt-6 max-w-sm text-[0.98rem] leading-7 text-muted-foreground text-pretty">
        They’re about knowing <strong className="font-semibold text-foreground">what to notice, what to leave out, and what to make people care about.</strong>
      </p>
    </div>
  )
}

function ReadyScreen({ preferences }: { preferences: OnboardingPreferences }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-2 pb-8 text-center">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">Ready</p>
      <h1 className="mt-4 text-[2.2rem] font-semibold leading-[1.04] tracking-[-0.05em] text-balance">StoryTuner is ready.</h1>
      <p className="mt-5 max-w-sm text-[0.95rem] leading-7 text-muted-foreground text-pretty">You’ll learn one idea at a time, then practice it in stories of your own.</p>
      <div className="mt-7 grid w-full grid-cols-2 gap-2">
        {["Learn", "Practice", "Get feedback", "Improve"].map((item) => (
          <div key={item} className="rounded-2xl bg-secondary/70 px-3 py-3 text-[0.78rem] font-semibold">{item}</div>
        ))}
      </div>
      {(preferences.goal || preferences.blocker) && (
        <p className="mt-6 text-[0.68rem] leading-5 text-muted-foreground">
          {preferences.goal && preferences.goal !== "everything" ? `Starting focus: ${goalLabels[preferences.goal]}. ` : ""}
          StoryTuner will use your setup to make coaching more relevant.
        </p>
      )}
    </div>
  )
}
