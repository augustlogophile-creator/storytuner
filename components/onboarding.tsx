"use client"

import Link from "next/link"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TouchEvent,
} from "react"
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
type TypewriterTag = "h1" | "p" | "span"

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
      <div className="intro-welcome-wash" aria-hidden="true" />

      <div className="intro-welcome-main">
        <div className="intro-welcome-art intro-reveal" style={introOrder(0)} aria-hidden="true">
          <IntroBookSketch />
        </div>
        <p className="intro-eyebrow intro-reveal" style={introOrder(1)}>Tellwise</p>
        <TypewriterText
          tag="h1"
          className="intro-welcome-title"
          text="Welcome to Tellwise."
          delay={300}
          speed={31}
        />
        <TypewriterText
          tag="p"
          className="intro-welcome-subtitle"
          text="Learn to tell stories people actually want to hear."
          delay={980}
          speed={18}
        />
      </div>

      <div className="intro-welcome-action intro-reveal" style={introOrder(15)}>
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
        <TypewriterText
          tag="h1"
          text="What do you want to get better at?"
          delay={180}
          speed={20}
        />
        <p className="intro-reveal intro-hint" style={introOrder(9)}>Choose as many as you want.</p>
      </div>

      <div className="intro-choice-list">
        {goalDetails.map((option, index) => (
          <IntroChoice
            key={option.value}
            selected={values.includes(option.value)}
            onClick={() => onToggle(option.value)}
            order={10 + index}
          >
            <span className="intro-choice-title">{option.title}</span>
            <span className="intro-choice-detail">{option.detail}</span>
          </IntroChoice>
        ))}
      </div>

      <div className="intro-action-slot intro-reveal" style={introOrder(15)}>
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
        <TypewriterText
          tag="h1"
          text="What usually gets in your way?"
          delay={180}
          speed={21}
        />
        <p className="intro-reveal intro-hint" style={introOrder(9)}>Choose as many as you want.</p>
      </div>

      <div className="intro-choice-list is-compact">
        {blockers.map((blocker, index) => (
          <IntroChoice
            key={blocker}
            selected={values.includes(blocker)}
            compact
            onClick={() => onToggle(blocker)}
            order={10 + index}
          >
            <span className="intro-choice-title">{blockerLabels[blocker]}</span>
          </IntroChoice>
        ))}
      </div>

      <div className="intro-action-slot intro-reveal" style={introOrder(17)}>
        <IntroAction onClick={onNext} disabled={values.length === 0}>Continue</IntroAction>
      </div>
    </IntroLayout>
  )
}

function SecretPage({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <IntroLayout page={3} onBack={onBack}>
      <div className="intro-secret-reveal">
        <div className="intro-secret-art intro-reveal" style={introOrder(1)} aria-hidden="true">
          <span className="intro-secret-art-wash" />
          <img
            src="/magnifying-glass-sketch.png"
            alt=""
            className="intro-secret-magnifier"
            draggable={false}
          />
          <span className="intro-secret-shadow" />
        </div>
        <p className="intro-eyebrow intro-reveal" style={introOrder(3)}>Here’s the secret.</p>
        <TypewriterText
          tag="h1"
          className="intro-secret-title"
          text="Great stories aren’t about having an extraordinary life."
          delay={390}
          speed={19}
        />
        <p className="intro-secret-copy intro-reveal" style={introOrder(17)}>
          They’re about knowing <strong>what to notice, what to leave out, and what to make people care about.</strong>
        </p>
      </div>

      <div className="intro-action-slot intro-reveal" style={introOrder(19)}>
        <IntroAction onClick={onNext}>Continue</IntroAction>
      </div>
    </IntroLayout>
  )
}

function ReadyPage({ onBack }: { onBack: () => void }) {
  const items = [
    { numeral: "I", title: "Learn", detail: "Build your instincts with short lessons on real storytelling craft." },
    { numeral: "II", title: "Practice", detail: "Apply each idea to your own stories or a real-life scenario." },
    { numeral: "III", title: "Get feedback", detail: "See what landed, what could improve, and why." },
    { numeral: "IV", title: "Improve", detail: "Keep practicing and watch your storytelling get stronger." },
  ]

  return (
    <IntroLayout page={4} onBack={onBack} ready>
      <div className="intro-heading intro-ready-heading">
        <p className="intro-eyebrow intro-reveal" style={introOrder(1)}>Your next chapter</p>
        <TypewriterText
          tag="h1"
          text="Tellwise is ready."
          delay={190}
          speed={25}
        />
        <p className="intro-reveal" style={introOrder(8)}>
          You’ll learn one idea at a time, then implement those ideas in stories of your own.
        </p>
      </div>

      <div className="intro-ready-list">
        {items.map((item, index) => (
          <div key={item.numeral} className="intro-ready-line intro-reveal" style={introOrder(10 + index * 2)}>
            <span className="intro-ready-roman">{item.numeral}</span>
            <div className="intro-ready-copy">
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="intro-action-slot intro-reveal" style={introOrder(19)}>
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
  ready = false,
  children,
}: {
  page: number
  onBack: () => void
  compact?: boolean
  centered?: boolean
  ready?: boolean
  children: ReactNode
}) {
  const progress = `${Math.round((page / LAST_PAGE) * 100)}%`

  return (
    <section className={`intro-flow-page${compact ? " is-compact" : ""}${centered ? " is-centered" : ""}${ready ? " is-ready" : ""}`}>
      <header className="intro-topbar intro-reveal" style={introOrder(0)}>
        <button type="button" onClick={onBack} aria-label="Go back" className="intro-back-button">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="intro-progress" aria-label={`Step ${page} of ${LAST_PAGE}`}>
          <span style={{ width: progress }} />
        </div>
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

function TypewriterText({
  tag = "span",
  text,
  className = "",
  delay = 120,
  speed = 22,
}: {
  tag?: TypewriterTag
  text: string
  className?: string
  delay?: number
  speed?: number
}) {
  const [visibleCharacters, setVisibleCharacters] = useState(0)
  const [done, setDone] = useState(false)
  const Tag = tag

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    if (reduce) {
      setVisibleCharacters(text.length)
      setDone(true)
      return
    }

    setVisibleCharacters(0)
    setDone(false)
    let interval: ReturnType<typeof setInterval> | null = null
    const startTimer = setTimeout(() => {
      let index = 0
      interval = setInterval(() => {
        index += 1
        setVisibleCharacters(index)
        if (index >= text.length) {
          if (interval) clearInterval(interval)
          interval = null
          setDone(true)
        }
      }, speed)
    }, delay)

    return () => {
      clearTimeout(startTimer)
      if (interval) clearInterval(interval)
    }
  }, [delay, speed, text])

  return (
    <Tag className={`intro-typewriter ${className}`.trim()} aria-label={text}>
      <span className="intro-typewriter-measure" aria-hidden="true">{text}</span>
      <span className="intro-typewriter-live" aria-hidden="true">
        {text.slice(0, visibleCharacters)}
        <span className={`intro-typewriter-caret${done ? " is-done" : ""}`} />
      </span>
    </Tag>
  )
}

function IntroBookSketch() {
  return (
    <svg className="intro-book-sketch" viewBox="0 0 260 190" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="intro-page-left" x1="44" y1="40" x2="122" y2="151" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fffdf8" />
          <stop offset="1" stopColor="#eee8dd" />
        </linearGradient>
        <linearGradient id="intro-page-right" x1="212" y1="41" x2="138" y2="151" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fffdf8" />
          <stop offset="1" stopColor="#efe9de" />
        </linearGradient>
        <linearGradient id="intro-book-edge" x1="130" y1="138" x2="130" y2="161" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d9d1c4" />
          <stop offset="1" stopColor="#bdb2a2" />
        </linearGradient>
        <filter id="intro-book-shadow" x="-35%" y="-35%" width="170%" height="190%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#5f5548" floodOpacity=".2" />
        </filter>
      </defs>

      <ellipse className="intro-book-ground" cx="130" cy="160" rx="94" ry="13" fill="#6e6458" fillOpacity=".11" />
      <g className="intro-book-object" filter="url(#intro-book-shadow)">
        <path className="intro-book-edge" d="M31 58c34-11 67-8 99 11 32-19 65-22 99-11v91c-33-9-66-6-99 13-33-19-66-22-99-13V58Z" fill="url(#intro-book-edge)" />
        <path className="intro-book-page intro-book-page-left" d="M29 48c33-12 66-9 101 12v91c-34-20-67-23-101-11V48Z" fill="url(#intro-page-left)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path className="intro-book-page intro-book-page-right" d="M231 48c-33-12-66-9-101 12v91c34-20 67-23 101-11V48Z" fill="url(#intro-page-right)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path className="intro-book-gutter" d="M130 60c-4 27-4 59 0 91" stroke="#8f684b" strokeWidth="2" strokeLinecap="round" />
        <path className="intro-book-highlight" d="M127 63c-20-11-45-15-76-8" stroke="#fff" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" />
        <path className="intro-book-highlight" d="M133 63c20-11 45-15 76-8" stroke="#fff" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" />

        <g className="intro-book-copy" stroke="#b6ada0" strokeWidth="2" strokeLinecap="round">
          <path d="M48 75c20-5 40-3 59 4" />
          <path d="M48 91c19-4 38-2 56 4" />
          <path d="M48 107c18-4 36-2 53 4" />
          <path d="M48 123c17-3 34-1 49 4" />
          <path d="M212 75c-20-5-40-3-59 4" />
          <path d="M212 91c-19-4-38-2-56 4" />
          <path d="M212 107c-18-4-36-2-53 4" />
          <path d="M212 123c-17-3-34-1-49 4" />
        </g>

        <path className="intro-book-accent" d="M117 143c5 2 9 5 13 8 4-3 8-6 13-8" stroke="#9c6949" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
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
