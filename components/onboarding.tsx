"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { BookOpen, Check } from "lucide-react"
import BookSlider, { BookPage, type BookSliderHandle } from "@/components/ui/book-slider"
import {
  blockerLabels,
  goalLabels,
  readOnboardingPreferences,
  writeOnboardingPreferences,
  type OnboardingPreferences,
  type StoryBlocker,
  type StoryGoalChoice,
} from "@/lib/onboarding-preferences"

const TOTAL_PAGES = 5

const goalDetails: Array<{ value: StoryGoalChoice; title: string; detail: string }> = [
  { value: "everyday", title: "Everyday stories", detail: "Tell better stories with friends." },
  { value: "speaking", title: "Interviews & speaking", detail: "Answer clearly and confidently." },
  { value: "writing", title: "Writing", detail: "Turn experiences into stronger stories." },
  { value: "confidence", title: "Confidence", detail: "Feel better when people are listening." },
]

const blockers: Array<Exclude<StoryBlocker, "">> = ["ramble", "start", "boring", "details", "nervous", "confident"]

export function Onboarding() {
  const [page, setPage] = useState(0)
  const bookRef = useRef<BookSliderHandle>(null)
  const [preferences, setPreferences] = useState<OnboardingPreferences>({ goal: "", goals: [], blocker: "" })

  useEffect(() => {
    setPreferences(readOnboardingPreferences())
  }, [])

  const selectedGoals = preferences.goals ?? (preferences.goal && preferences.goal !== "everything" ? [preferences.goal as StoryGoalChoice] : [])
  const canAdvance = page === 1 ? selectedGoals.length > 0 : page === 2 ? Boolean(preferences.blocker) : true

  function save(next: OnboardingPreferences) {
    setPreferences(next)
    writeOnboardingPreferences(next)
  }

  function toggleGoal(goal: StoryGoalChoice) {
    triggerIntroHaptic("selection")
    const nextGoals = selectedGoals.includes(goal)
      ? selectedGoals.filter((item) => item !== goal)
      : [...selectedGoals, goal]

    save({
      ...preferences,
      goals: nextGoals,
      goal: nextGoals[0] ?? "",
    })
  }

  function chooseBlocker(blocker: Exclude<StoryBlocker, "">) {
    triggerIntroHaptic("selection")
    save({ ...preferences, blocker })
  }

  function nextPage() {
    if (!canAdvance) return
    triggerIntroHaptic("action")
    bookRef.current?.next()
  }

  function previousPage() {
    triggerIntroHaptic("selection")
    bookRef.current?.previous()
  }

  return (
    <main className={page === 0 ? "book-intro-canvas is-cover" : "book-intro-canvas"}>
      <BookSlider
        ref={bookRef}
        page={page}
        onPageChange={setPage}
        canGoNext={canAdvance}
        onTurn={(direction) => triggerIntroHaptic(direction === "next" ? "action" : "selection")}
      >
        <BookPage cover>
          <CoverPage onNext={nextPage} />
        </BookPage>

        <BookPage>
          <GoalPage values={selectedGoals} onToggle={toggleGoal} onNext={nextPage} onBack={previousPage} />
        </BookPage>

        <BookPage>
          <BlockerPage value={preferences.blocker} onChoose={chooseBlocker} onNext={nextPage} onBack={previousPage} />
        </BookPage>

        <BookPage>
          <SecretPage onNext={nextPage} onBack={previousPage} />
        </BookPage>

        <BookPage>
          <ReadyPage preferences={preferences} onBack={previousPage} />
        </BookPage>
      </BookSlider>
    </main>
  )
}

function CoverPage({ onNext }: { onNext: () => void }) {
  return (
    <div className="book-cover-content">
      <div className="book-cover-rule" aria-hidden="true" />
      <div>
        <p className="book-cover-kicker">STORYTUNER</p>
        <h1>Welcome to StoryTuner.</h1>
        <p className="book-cover-subtitle">Learn to tell stories people actually want to hear.</p>
      </div>
      <BookOpen className="book-cover-icon" strokeWidth={1.5} aria-hidden="true" />
      <button type="button" className="book-cover-open" data-book-no-turn="true" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()} onClick={onNext}>
        Let’s start <span aria-hidden="true">→</span>
      </button>
    </div>
  )
}

function GoalPage({
  values,
  onToggle,
  onNext,
  onBack,
}: {
  values: StoryGoalChoice[]
  onToggle: (value: StoryGoalChoice) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <PaperLayout pageNumber={1} onBack={onBack}>
      <div className="book-paper-heading">
        <p className="book-paper-eyebrow">A note about you</p>
        <h1>What do you want to get better at?</h1>
        <p>Choose as many as you want.</p>
      </div>

      <div className="book-choice-list">
        {goalDetails.map((option) => (
          <BookChoice key={option.value} selected={values.includes(option.value)} onClick={() => onToggle(option.value)}>
            <span className="book-choice-title">{option.title}</span>
            <span className="book-choice-detail">{option.detail}</span>
          </BookChoice>
        ))}
      </div>

      <PageTurnAction onClick={onNext} disabled={values.length === 0}>Continue</PageTurnAction>
    </PaperLayout>
  )
}

function BlockerPage({
  value,
  onChoose,
  onNext,
  onBack,
}: {
  value: StoryBlocker
  onChoose: (value: Exclude<StoryBlocker, "">) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <PaperLayout pageNumber={2} onBack={onBack}>
      <div className="book-paper-heading compact">
        <p className="book-paper-eyebrow">Be honest</p>
        <h1>What usually gets in your way?</h1>
      </div>

      <div className="book-choice-list book-choice-list-compact">
        {blockers.map((blocker) => (
          <BookChoice key={blocker} selected={value === blocker} compact onClick={() => onChoose(blocker)}>
            <span className="book-choice-title">{blockerLabels[blocker]}</span>
          </BookChoice>
        ))}
      </div>

      <PageTurnAction onClick={onNext} disabled={!value}>Continue</PageTurnAction>
    </PaperLayout>
  )
}

function SecretPage({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <PaperLayout pageNumber={3} onBack={onBack} centered>
      <div className="book-secret-reveal">
        <p className="book-paper-eyebrow">Here’s the secret.</p>
        <h1 className="book-secret-title">Great stories aren’t about having an extraordinary life.</h1>
        <p className="book-secret-copy">
          They’re about knowing <strong>what to notice, what to leave out, and what to make people care about.</strong>
        </p>
        <img
          src="/magnifying-glass-sketch.png"
          alt=""
          aria-hidden="true"
          className="book-secret-magnifier"
          draggable={false}
        />
      </div>
      <PageTurnAction onClick={onNext}>Continue</PageTurnAction>
    </PaperLayout>
  )
}

function ReadyPage({ preferences, onBack }: { preferences: OnboardingPreferences; onBack: () => void }) {
  const items = ["Learn", "Practice", "Get feedback", "Improve"]
  const goals = preferences.goals ?? []

  return (
    <PaperLayout pageNumber={4} onBack={onBack}>
      <div className="book-paper-heading">
        <p className="book-paper-eyebrow">Your next chapter</p>
        <h1>StoryTuner is ready.</h1>
        <p>You’ll learn one idea at a time, then practice it in stories of your own.</p>
      </div>

      <div className="book-ready-list">
        {items.map((item, index) => (
          <div key={item} className="book-ready-line">
            <span>{index + 1}.</span>
            <strong>{item}</strong>
          </div>
        ))}
      </div>

      {(goals.length > 0 || preferences.blocker) && (
        <p className="book-focus-note">
          {goals.length > 0 ? `Starting focus: ${goals.map((goal) => goalLabels[goal]).join(", ")}. ` : ""}
          Your setup will make coaching more relevant.
        </p>
      )}

      <div className="book-final-actions" data-book-no-turn="true">
        <Link href="/sign-up" data-book-no-turn="true" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()} onClick={() => triggerIntroHaptic("action")} className="book-start-link">
          Start learning <span aria-hidden="true">→</span>
        </Link>
        <p>
          Already have an account?{" "}
          <Link href="/sign-up?mode=sign-in" data-book-no-turn="true" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()} onClick={() => triggerIntroHaptic("selection")}>Log in</Link>
        </p>
      </div>
    </PaperLayout>
  )
}

function PaperLayout({
  pageNumber,
  onBack,
  centered = false,
  children,
}: {
  pageNumber: number
  onBack: () => void
  centered?: boolean
  children: ReactNode
}) {
  return (
    <div className={centered ? "book-paper-content is-centered" : "book-paper-content"}>
      <div className="book-paper-topline">
        <button type="button" data-book-no-turn="true" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()} onClick={onBack} aria-label="Turn to the previous page">←</button>
        <span>StoryTuner</span>
      </div>
      <div className="book-paper-body">{children}</div>
      <span className="book-page-number">{pageNumber}</span>
    </div>
  )
}

function BookChoice({
  selected,
  compact = false,
  onClick,
  children,
}: {
  selected: boolean
  compact?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onClick={onClick}
      aria-pressed={selected}
      data-book-no-turn="true"
      className={compact ? "book-choice is-compact" : "book-choice"}
      data-selected={selected ? "true" : "false"}
    >
      <span className="book-choice-copy">{children}</span>
      <span className="book-choice-check" aria-hidden="true">{selected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}</span>
    </button>
  )
}

function PageTurnAction({
  onClick,
  disabled = false,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button type="button" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()} onClick={onClick} disabled={disabled} data-book-no-turn="true" className="book-turn-action">
      {children} <span aria-hidden="true">→</span>
    </button>
  )
}

function triggerIntroHaptic(kind: "selection" | "action") {
  if (typeof window === "undefined") return
  if (!("vibrate" in window.navigator)) return
  try {
    window.navigator.vibrate(kind === "action" ? 12 : 7)
  } catch {}
}
