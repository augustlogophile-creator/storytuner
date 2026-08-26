"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent } from "react"
import { preload } from "react-dom"
import { Check, ChevronLeft } from "lucide-react"
import { TellwisePressButton } from "@/components/ui/tellwise-press-button"
import {
  blockerLabels,
  readOnboardingPreferences,
  writeOnboardingPreferences,
  type OnboardingPreferences,
  type StoryBlocker,
  type StoryGoalChoice,
} from "@/lib/onboarding-preferences"

const goalDetails: Array<{ value: StoryGoalChoice; title: string; detail: string }> = [
  { value: "everyday", title: "Everyday stories", detail: "Tell better stories with friends." },
  { value: "speaking", title: "Interviews & speaking", detail: "Answer clearly and confidently." },
  { value: "writing", title: "Writing", detail: "Turn experiences into stronger stories." },
  { value: "confidence", title: "Confidence", detail: "Feel better when people are listening." },
]

type StoryBlockerChoice = Exclude<StoryBlocker, "">
type IntroDirection = "next" | "back"
type IntroFeedback = "selection" | "action" | "page" | "back"

const blockers: StoryBlockerChoice[] = ["ramble", "start", "boring", "details", "nervous", "confident"]
const LAST_PAGE = 4
const PAGE_EXIT_MS = 170
const PAGE_ENTER_MS = 480

export function Onboarding({ initialPage = 0 }: { initialPage?: number }) {
  preload("/parch-reading.mp4", { as: "video", type: "video/mp4" })
  preload("/parch-reading-poster.jpg", { as: "image" })

  const normalizedInitialPage = Math.max(0, Math.min(LAST_PAGE, initialPage))
  const [page, setPage] = useState(normalizedInitialPage)
  const [direction, setDirection] = useState<IntroDirection>("next")
  const [phase, setPhase] = useState<"enter" | "idle" | "exit">("enter")
  const [preferences, setPreferences] = useState<OnboardingPreferences>({ goal: "", goals: [], blocker: "", blockers: [] })
  const transitionTimers = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const pageRef = useRef(normalizedInitialPage)

  useEffect(() => {
    setPreferences(readOnboardingPreferences())
    const timer = setTimeout(() => setPhase("idle"), PAGE_ENTER_MS)
    transitionTimers.current.push(timer)

    return () => {
      transitionTimers.current.forEach(clearTimeout)
      transitionTimers.current = []
    }
  }, [])

  const selectedGoals = preferences.goals ?? (preferences.goal && preferences.goal !== "everything" ? [preferences.goal as StoryGoalChoice] : [])
  const selectedBlockers: StoryBlockerChoice[] = preferences.blockers ?? (preferences.blocker ? [preferences.blocker as StoryBlockerChoice] : [])
  const canAdvance = page === 1 ? selectedGoals.length > 0 : page === 2 ? selectedBlockers.length > 0 : true

  function save(next: OnboardingPreferences) {
    setPreferences(next)
    writeOnboardingPreferences(next)
  }

  function toggleGoal(goal: StoryGoalChoice) {
    triggerIntroFeedback("selection")
    const nextGoals = selectedGoals.includes(goal)
      ? selectedGoals.filter((item) => item !== goal)
      : [...selectedGoals, goal]

    save({
      ...preferences,
      goals: nextGoals,
      goal: nextGoals[0] ?? "",
    })
  }

  function toggleBlocker(blocker: StoryBlockerChoice) {
    triggerIntroFeedback("selection")
    const nextBlockers = selectedBlockers.includes(blocker)
      ? selectedBlockers.filter((item) => item !== blocker)
      : [...selectedBlockers, blocker]

    save({
      ...preferences,
      blockers: nextBlockers,
      blocker: nextBlockers[0] ?? "",
    })
  }

  const navigate = useCallback((target: number, nextDirection: IntroDirection) => {
    const current = pageRef.current
    const safeTarget = Math.max(0, Math.min(LAST_PAGE, target))
    if (safeTarget === current || phase !== "idle") return
    if (nextDirection === "next" && !canAdvance) return

    triggerIntroFeedback(nextDirection === "next" ? "page" : "back")
    setDirection(nextDirection)
    setPhase("exit")

    const exitTimer = setTimeout(() => {
      pageRef.current = safeTarget
      setPage(safeTarget)
      setPhase("enter")

      const enterTimer = setTimeout(() => setPhase("idle"), PAGE_ENTER_MS)
      transitionTimers.current.push(enterTimer)
    }, PAGE_EXIT_MS)

    transitionTimers.current.push(exitTimer)
  }, [canAdvance, phase])

  function nextPage() {
    navigate(pageRef.current + 1, "next")
  }

  function previousPage() {
    navigate(pageRef.current - 1, "back")
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    const target = event.target
    if (target instanceof Element && target.closest("button, a, input, textarea, select, label")) {
      touchStart.current = null
      return
    }
    const touch = event.touches[0]
    if (!touch) return
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = touchStart.current
    touchStart.current = null
    if (!start || phase !== "idle") return
    const touch = event.changedTouches[0]
    if (!touch) return

    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < 68 || Math.abs(dx) < Math.abs(dy) * 1.3) return

    if (dx < 0 && pageRef.current < LAST_PAGE && canAdvance) {
      nextPage()
    } else if (dx > 0 && pageRef.current > 0) {
      previousPage()
    }
  }

  return (
    <main className="intro-flow-canvas" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <video
        className="intro-parch-preloader"
        src="/parch-reading.mp4"
        preload="auto"
        autoPlay
        muted
        playsInline
        aria-hidden="true"
        tabIndex={-1}
      />

      <div
        key={page}
        className={`intro-flow-stage is-${phase} is-${direction}`}
        aria-live="polite"
      >
        {page === 0 && <WelcomePage onNext={nextPage} />}
        {page === 1 && (
          <GoalPage
            values={selectedGoals}
            onToggle={toggleGoal}
            onNext={nextPage}
            onBack={previousPage}
          />
        )}
        {page === 2 && (
          <BlockerPage
            values={selectedBlockers}
            onToggle={toggleBlocker}
            onNext={nextPage}
            onBack={previousPage}
          />
        )}
        {page === 3 && <SecretPage onNext={nextPage} onBack={previousPage} />}
        {page === 4 && <ReadyPage onBack={previousPage} />}
      </div>
    </main>
  )
}

function WelcomePage({ onNext }: { onNext: () => void }) {
  return (
    <section className="intro-flow-page intro-welcome-page">
      <div className="intro-welcome-brand intro-reveal" style={introOrder(0)}>Tellwise</div>

      <div className="intro-welcome-main">
        <div className="intro-welcome-art intro-reveal" style={introOrder(1)} aria-hidden="true">
          <IntroBookSketch />
        </div>
        <p className="intro-eyebrow intro-reveal" style={introOrder(2)}>A storytelling practice</p>
        <h1 className="intro-welcome-title intro-reveal" style={introOrder(3)}>Welcome to Tellwise.</h1>
        <p className="intro-welcome-subtitle intro-reveal" style={introOrder(4)}>
          Learn to tell stories people actually want to hear.
        </p>
      </div>

      <div className="intro-welcome-action intro-reveal" style={introOrder(5)}>
        <IntroAction onClick={onNext}>Let’s start</IntroAction>
      </div>
    </section>
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
    <IntroLayout page={1} onBack={onBack}>
      <div className="intro-heading">
        <p className="intro-eyebrow intro-reveal" style={introOrder(1)}>A note about you</p>
        <h1 className="intro-reveal" style={introOrder(2)}>What do you want to get better at?</h1>
        <p className="intro-reveal intro-hint" style={introOrder(3)}>Choose as many as you want.</p>
      </div>

      <div className="intro-choice-list">
        {goalDetails.map((option, index) => (
          <IntroChoice
            key={option.value}
            selected={values.includes(option.value)}
            onClick={() => onToggle(option.value)}
            order={4 + index}
          >
            <span className="intro-choice-title">{option.title}</span>
            <span className="intro-choice-detail">{option.detail}</span>
          </IntroChoice>
        ))}
      </div>

      <div className="intro-action-slot intro-reveal" style={introOrder(9)}>
        <IntroAction onClick={onNext} disabled={values.length === 0}>Continue</IntroAction>
      </div>
    </IntroLayout>
  )
}

function BlockerPage({
  values,
  onToggle,
  onNext,
  onBack,
}: {
  values: StoryBlockerChoice[]
  onToggle: (value: StoryBlockerChoice) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <IntroLayout page={2} onBack={onBack} compact>
      <div className="intro-heading is-compact">
        <p className="intro-eyebrow intro-reveal" style={introOrder(1)}>Be honest</p>
        <h1 className="intro-reveal" style={introOrder(2)}>What usually gets in your way?</h1>
        <p className="intro-reveal intro-hint" style={introOrder(3)}>Choose as many as you want.</p>
      </div>

      <div className="intro-choice-list is-compact">
        {blockers.map((blocker, index) => (
          <IntroChoice
            key={blocker}
            selected={values.includes(blocker)}
            compact
            onClick={() => onToggle(blocker)}
            order={4 + index}
          >
            <span className="intro-choice-title">{blockerLabels[blocker]}</span>
          </IntroChoice>
        ))}
      </div>

      <div className="intro-action-slot intro-reveal" style={introOrder(11)}>
        <IntroAction onClick={onNext} disabled={values.length === 0}>Continue</IntroAction>
      </div>
    </IntroLayout>
  )
}

function SecretPage({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <IntroLayout page={3} onBack={onBack} centered>
      <div className="intro-secret-reveal">
        <div className="intro-secret-art intro-reveal" style={introOrder(1)}>
          <img
            src="/magnifying-glass-sketch.png"
            alt=""
            aria-hidden="true"
            className="intro-secret-magnifier"
            draggable={false}
          />
        </div>
        <p className="intro-eyebrow intro-reveal" style={introOrder(2)}>Here’s the secret.</p>
        <h1 className="intro-secret-title intro-reveal" style={introOrder(3)}>
          Great stories aren’t about having an extraordinary life.
        </h1>
        <p className="intro-secret-copy intro-reveal" style={introOrder(4)}>
          They’re about knowing <strong>what to notice, what to leave out, and what to make people care about.</strong>
        </p>
      </div>

      <div className="intro-action-slot intro-reveal" style={introOrder(5)}>
        <IntroAction onClick={onNext}>Continue</IntroAction>
      </div>
    </IntroLayout>
  )
}

function ReadyPage({ onBack }: { onBack: () => void }) {
  const items = ["Learn", "Practice", "Get feedback", "Improve"]

  return (
    <IntroLayout page={4} onBack={onBack}>
      <div className="intro-heading intro-ready-heading">
        <p className="intro-eyebrow intro-reveal" style={introOrder(1)}>Your next chapter</p>
        <h1 className="intro-reveal" style={introOrder(2)}>Tellwise is ready.</h1>
        <p className="intro-reveal" style={introOrder(3)}>
          You’ll learn one idea at a time, then implement those ideas in stories of your own.
        </p>
      </div>

      <div className="intro-ready-list intro-reveal" style={introOrder(4)}>
        {items.map((item, index) => (
          <div key={item} className="intro-ready-line">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item}</strong>
          </div>
        ))}
      </div>

      <div className="intro-action-slot intro-reveal" style={introOrder(5)}>
        <Link
          href="/sign-up"
          prefetch
          onClick={() => triggerIntroFeedback("action")}
          className="tellwise-press-button"
        >
          <span>Start learning</span>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </Link>
      </div>
    </IntroLayout>
  )
}

function IntroLayout({
  page,
  onBack,
  compact = false,
  centered = false,
  children,
}: {
  page: number
  onBack: () => void
  compact?: boolean
  centered?: boolean
  children: ReactNode
}) {
  const progress = `${Math.round((page / LAST_PAGE) * 100)}%`

  return (
    <section className={`intro-flow-page${compact ? " is-compact" : ""}${centered ? " is-centered" : ""}`}>
      <header className="intro-topbar intro-reveal" style={introOrder(0)}>
        <button type="button" onClick={onBack} aria-label="Go back" className="intro-back-button">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="intro-progress" aria-label={`Step ${page} of ${LAST_PAGE}`}>
          <span style={{ width: progress }} />
        </div>
        <span className="intro-brand">Tellwise</span>
      </header>

      <div className="intro-flow-body">{children}</div>
    </section>
  )
}

function IntroChoice({
  selected,
  compact = false,
  onClick,
  order,
  children,
}: {
  selected: boolean
  compact?: boolean
  onClick: () => void
  order: number
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      data-no-global-tap="true"
      className={`intro-choice intro-reveal${compact ? " is-compact" : ""}${selected ? " is-selected" : ""}`}
      style={introOrder(order)}
    >
      <span className="intro-choice-copy">{children}</span>
      <span className="intro-choice-check" aria-hidden="true">
        <Check strokeWidth={2.6} />
      </span>
    </button>
  )
}

function IntroAction({
  onClick,
  disabled = false,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <TellwisePressButton
      onClick={() => {
        if (disabled) return
        onClick()
      }}
      disabled={disabled}
    >
      {children}
    </TellwisePressButton>
  )
}

function IntroBookSketch() {
  return (
    <svg className="intro-book-sketch" viewBox="0 0 220 160" fill="none" aria-hidden="true">
      <path className="intro-draw-line" pathLength="1" d="M110 39C82 25 51 25 25 38v86c26-13 57-13 85 1" />
      <path className="intro-draw-line" pathLength="1" d="M110 39c28-14 59-14 85-1v86c-26-13-57-13-85 1" />
      <path className="intro-draw-line" pathLength="1" d="M110 39v86" />
      <path className="intro-draw-line is-soft" pathLength="1" d="M40 56c17-6 36-6 54 0" />
      <path className="intro-draw-line is-soft" pathLength="1" d="M40 73c17-6 36-6 54 0" />
      <path className="intro-draw-line is-soft" pathLength="1" d="M40 90c17-6 36-6 54 0" />
      <path className="intro-draw-line is-soft" pathLength="1" d="M126 56c18-6 37-6 54 0" />
      <path className="intro-draw-line is-soft" pathLength="1" d="M126 73c18-6 37-6 54 0" />
      <path className="intro-draw-line is-soft" pathLength="1" d="M126 90c18-6 37-6 54 0" />
      <path className="intro-draw-line is-accent" pathLength="1" d="M99 118c4 2 8 4 11 7 4-3 8-5 12-7" />
    </svg>
  )
}

function introOrder(order: number): CSSProperties {
  return { "--intro-order": order } as CSSProperties
}

function triggerIntroFeedback(kind: IntroFeedback) {
  if (typeof window === "undefined") return

  try {
    window.dispatchEvent(new CustomEvent("tellwise:haptic", { detail: { kind } }))
  } catch {}

  if (!("vibrate" in window.navigator)) return
  try {
    const pattern = kind === "selection"
      ? 7
      : kind === "action"
        ? 10
        : kind === "back"
          ? 7
          : [8, 16, 8]
    window.navigator.vibrate(pattern)
  } catch {}
}
