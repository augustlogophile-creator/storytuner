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
  { value: "other", title: "Other", detail: "Something else you want to work on." },
]

type StoryBlockerChoice = Exclude<StoryBlocker, "">
type IntroDirection = "next" | "back"
type IntroFeedback = "selection" | "action" | "page" | "back" | "typing" | "reveal"
type TypewriterTag = "h1" | "p" | "span"

const blockers: StoryBlockerChoice[] = ["ramble", "start", "boring", "details", "nervous", "other"]
const LAST_PAGE = 4
const PAGE_EXIT_MS = 140
const PAGE_ENTER_MS = 410

// Keep track of pages already experienced during this client session so using
// Back never replays the authored typewriter/reveal sequences.
const playedIntroPagesSession = new Set<number>()

export function Onboarding({ initialPage = 0 }: { initialPage?: number }) {
  preload("/parch-reading.mp4", { as: "video", type: "video/mp4" })

  const normalizedInitialPage = Math.max(0, Math.min(LAST_PAGE, initialPage))
  const [page, setPage] = useState(normalizedInitialPage)
  const [direction, setDirection] = useState<IntroDirection>("next")
  const [phase, setPhase] = useState<"enter" | "idle" | "exit">("enter")
  const [preferences, setPreferences] = useState<OnboardingPreferences>({ goal: "", goals: [], blocker: "", blockers: [] })
  const transitionTimers = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const pageRef = useRef(normalizedInitialPage)
  const initialPlayedPages = new Set(playedIntroPagesSession)
  if (normalizedInitialPage > 0) initialPlayedPages.add(normalizedInitialPage)
  const playedPages = useRef<Set<number>>(initialPlayedPages)

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

    playedPages.current.add(current)
    playedIntroPagesSession.add(current)
    if (nextDirection === "back") {
      // A back target has, by definition, already been seen. Mark it before the
      // render so its internal animations are immediately shown in final state.
      playedPages.current.add(safeTarget)
      playedIntroPagesSession.add(safeTarget)
    }
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

  const animatePage = !playedPages.current.has(page)

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
        {page === 0 && <WelcomePage onNext={nextPage} animate={animatePage} />}
        {page === 1 && (
          <GoalPage
            values={selectedGoals}
            onToggle={toggleGoal}
            onNext={nextPage}
            onBack={previousPage}
            animate={animatePage}
          />
        )}
        {page === 2 && (
          <BlockerPage
            values={selectedBlockers}
            onToggle={toggleBlocker}
            onNext={nextPage}
            onBack={previousPage}
            animate={animatePage}
          />
        )}
        {page === 3 && <SecretPage onNext={nextPage} onBack={previousPage} animate={animatePage} />}
        {page === 4 && <ReadyPage onBack={previousPage} animate={animatePage} />}
      </div>
    </main>
  )
}

function WelcomePage({ onNext, animate }: { onNext: () => void; animate: boolean }) {
  const [titleStarted, setTitleStarted] = useState(!animate)
  const [titleDone, setTitleDone] = useState(!animate)
  const [subtitleVisible, setSubtitleVisible] = useState(!animate)
  const [sequenceDone, setSequenceDone] = useState(!animate)

  useEffect(() => {
    if (!animate) {
      setTitleStarted(true)
      setTitleDone(true)
      setSubtitleVisible(true)
      setSequenceDone(true)
      return
    }

    setTitleStarted(false)
    setTitleDone(false)
    setSubtitleVisible(false)
    setSequenceDone(false)
    const timer = window.setTimeout(() => setTitleStarted(true), 820)
    return () => window.clearTimeout(timer)
  }, [animate])

  useEffect(() => {
    if (!animate || !titleDone) return
    const subtitleTimer = window.setTimeout(() => setSubtitleVisible(true), 460)
    const doneTimer = window.setTimeout(() => setSequenceDone(true), 1120)
    return () => {
      window.clearTimeout(subtitleTimer)
      window.clearTimeout(doneTimer)
    }
  }, [animate, titleDone])

  return (
    <section className={`intro-flow-page intro-welcome-page${animate ? "" : " is-static"}`}>
      <div className="intro-welcome-wash" aria-hidden="true" />

      <div className="intro-welcome-main">
        <div className="intro-welcome-art intro-reveal" style={introOrder(0)} aria-hidden="true">
          <IntroBookSketch />
        </div>
        <TypewriterText
          tag="h1"
          className="intro-welcome-title"
          text="Welcome to Tellwise."
          delay={0}
          speed={72}
          animate={animate}
          start={titleStarted}
          onComplete={() => setTitleDone(true)}
        />
        <p
          className={`intro-welcome-subtitle intro-welcome-subtitle-reveal${subtitleVisible ? " is-visible" : ""}${animate ? "" : " is-static"}`}
        >
          Learn to tell stories people actually want to hear.
        </p>
      </div>

      <div className="intro-welcome-action">
        <IntroAction onClick={onNext} disabled={!sequenceDone}>Let’s start</IntroAction>
      </div>
    </section>
  )
}

function GoalPage({
  values,
  onToggle,
  onNext,
  onBack,
  animate,
}: {
  values: StoryGoalChoice[]
  onToggle: (value: StoryGoalChoice) => void
  onNext: () => void
  onBack: () => void
  animate: boolean
}) {
  const [typed, setTyped] = useState(!animate)

  useEffect(() => {
    if (!animate) setTyped(true)
  }, [animate])

  return (
    <IntroLayout page={1} onBack={onBack} animate={animate}>
      <div className="intro-heading">
        <p className="intro-eyebrow intro-reveal" style={introOrder(1)}>A note about you</p>
        <TypewriterText
          tag="h1"
          text="What do you want to get better at?"
          delay={300}
          speed={64}
          animate={animate}
          onComplete={() => setTyped(true)}
        />
      </div>

      <div className={`intro-after-typing${typed ? " is-visible" : ""}${animate ? "" : " is-static"}`}>
        <p className="intro-hint intro-follow-reveal" style={introFollowOrder(0)}>Choose as many as you want.</p>
        <div className="intro-choice-list">
          {goalDetails.map((option, index) => (
            <IntroChoice
              key={option.value}
              selected={values.includes(option.value)}
              onClick={() => onToggle(option.value)}
              followOrder={index + 1}
            >
              <span className="intro-choice-title">{option.title}</span>
              <span className="intro-choice-detail">{option.detail}</span>
            </IntroChoice>
          ))}
        </div>

        <div className="intro-action-slot intro-follow-reveal" style={introFollowOrder(goalDetails.length + 1)}>
          <IntroAction onClick={onNext} disabled={values.length === 0}>Continue</IntroAction>
        </div>
      </div>
    </IntroLayout>
  )
}

function BlockerPage({
  values,
  onToggle,
  onNext,
  onBack,
  animate,
}: {
  values: StoryBlockerChoice[]
  onToggle: (value: StoryBlockerChoice) => void
  onNext: () => void
  onBack: () => void
  animate: boolean
}) {
  const [typed, setTyped] = useState(!animate)

  useEffect(() => {
    if (!animate) setTyped(true)
  }, [animate])

  return (
    <IntroLayout page={2} onBack={onBack} compact animate={animate}>
      <div className="intro-heading is-compact">
        <p className="intro-eyebrow intro-reveal" style={introOrder(1)}>Be honest</p>
        <TypewriterText
          tag="h1"
          text="What usually gets in your way?"
          delay={300}
          speed={64}
          animate={animate}
          onComplete={() => setTyped(true)}
        />
      </div>

      <div className={`intro-after-typing${typed ? " is-visible" : ""}${animate ? "" : " is-static"}`}>
        <p className="intro-hint intro-follow-reveal" style={introFollowOrder(0)}>Choose as many as you want.</p>
        <div className="intro-choice-list is-compact">
          {blockers.map((blocker, index) => (
            <IntroChoice
              key={blocker}
              selected={values.includes(blocker)}
              compact
              onClick={() => onToggle(blocker)}
              followOrder={index + 1}
            >
              <span className="intro-choice-title">{blockerLabels[blocker]}</span>
            </IntroChoice>
          ))}
        </div>

        <div className="intro-action-slot intro-follow-reveal" style={introFollowOrder(blockers.length + 1)}>
          <IntroAction onClick={onNext} disabled={values.length === 0}>Continue</IntroAction>
        </div>
      </div>
    </IntroLayout>
  )
}

function SecretPage({ onNext, onBack, animate }: { onNext: () => void; onBack: () => void; animate: boolean }) {
  const [typed, setTyped] = useState(!animate)

  useEffect(() => {
    if (!animate) setTyped(true)
  }, [animate])

  useEffect(() => {
    if (!animate || !typed) return

    // Match the three editorial reveal beats below. Each one gets a restrained
    // paper-like tick so the sequence feels deliberate without becoming noisy.
    const timers = [1600, 2400, 3200].map((delay) =>
      window.setTimeout(() => triggerIntroFeedback("reveal"), delay),
    )
    return () => timers.forEach(window.clearTimeout)
  }, [animate, typed])

  return (
    <IntroLayout page={3} onBack={onBack} animate={animate}>
      <div className="intro-secret-reveal">
        <div className="intro-secret-art intro-secret-art-entrance" aria-hidden="true">
          <span className="intro-secret-art-wash" />
          <img
            src="/magnifying-glass-sketch.png"
            alt=""
            className="intro-secret-magnifier"
            draggable={false}
          />
          <span className="intro-secret-shadow" />
        </div>
        <p className="intro-eyebrow intro-secret-eyebrow">Here’s the thing.</p>
        <TypewriterText
          tag="h1"
          className="intro-secret-title"
          text="Great stories aren’t about having an extraordinary life."
          accentText="aren’t"
          delay={1150}
          speed={56}
          animate={animate}
          onComplete={() => setTyped(true)}
        />

        <div className={`intro-secret-copy-sequence intro-after-typing${typed ? " is-visible" : ""}${animate ? "" : " is-static"}`}>
          <p className="intro-secret-copy-lead intro-follow-reveal" style={introFollowOrder(0)}>They’re about knowing</p>
          <div className="intro-secret-points">
            <span className="intro-secret-point intro-follow-reveal" style={introFollowOrder(1)}>what to notice,</span>
            <span className="intro-secret-point intro-follow-reveal" style={introFollowOrder(2)}>what to leave out,</span>
            <span className="intro-secret-point intro-follow-reveal" style={introFollowOrder(3)}>and what to make people care about.</span>
          </div>
        </div>
      </div>

      <div className={`intro-action-slot intro-secret-action intro-after-typing${typed ? " is-visible" : ""}${animate ? "" : " is-static"}`}>
        <div className="intro-follow-reveal" style={introFollowOrder(5)}>
          <IntroAction onClick={onNext}>Continue</IntroAction>
        </div>
      </div>
    </IntroLayout>
  )
}

function ReadyPage({ onBack, animate }: { onBack: () => void; animate: boolean }) {
  const [typed, setTyped] = useState(!animate)
  const items = [
    { numeral: "I", title: "Learn", detail: "Build your instincts with short lessons on real storytelling craft." },
    { numeral: "II", title: "Practice", detail: "Apply each idea to your own stories or a real-life scenario." },
    { numeral: "III", title: "Get feedback", detail: "See what landed, what could improve, and why." },
    { numeral: "IV", title: "Improve", detail: "Keep practicing and watch your storytelling get stronger." },
  ]

  useEffect(() => {
    if (!animate) setTyped(true)
  }, [animate])

  return (
    <IntroLayout page={4} onBack={onBack} ready animate={animate}>
      <div className="intro-heading intro-ready-heading">
        <p className="intro-eyebrow intro-reveal" style={introOrder(1)}>Your next chapter</p>
        <TypewriterText
          tag="h1"
          text="Tellwise is ready."
          delay={300}
          speed={68}
          animate={animate}
          onComplete={() => setTyped(true)}
        />
      </div>

      <div className={`intro-ready-sequence intro-after-typing${typed ? " is-visible" : ""}${animate ? "" : " is-static"}`}>
        <p className="intro-ready-intro intro-follow-reveal" style={introFollowOrder(0)}>
          You’ll learn one idea at a time, then implement those ideas in stories of your own.
        </p>

        <div className="intro-summary-list">
          {items.map((item, index) => (
            <div key={item.numeral} className="intro-summary-row intro-follow-reveal" style={introFollowOrder(index + 1)}>
              <span className="intro-summary-roman">{item.numeral}</span>
              <div className="intro-summary-copy">
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <PencilArrowMoment active={typed} animate={animate} />
      </div>

      <div className={`intro-action-slot intro-after-typing${typed ? " is-visible" : ""}${animate ? "" : " is-static"}`}>
        <div className="intro-follow-reveal" style={introFollowOrder(items.length + 2)}>
          <Link
            href="/sign-up"
            prefetch
            onClick={() => triggerIntroFeedback("action")}
            className="tellwise-press-button"
            data-no-global-tap="true"
          >
            <span>Start learning</span>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </Link>
        </div>
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
  animate = true,
  children,
}: {
  page: number
  onBack: () => void
  compact?: boolean
  centered?: boolean
  ready?: boolean
  animate?: boolean
  children: ReactNode
}) {
  const progress = `${Math.round((page / LAST_PAGE) * 100)}%`

  return (
    <section className={`intro-flow-page${compact ? " is-compact" : ""}${centered ? " is-centered" : ""}${ready ? " is-ready" : ""}${animate ? "" : " is-static"}`}>
      <header className="intro-topbar intro-reveal" style={introOrder(0)}>
        <button type="button" onClick={onBack} aria-label="Go back" className="intro-back-button" data-no-global-tap="true">
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
  followOrder = 0,
  children,
}: {
  selected: boolean
  compact?: boolean
  onClick: () => void
  followOrder?: number
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      data-no-global-tap="true"
      className={`intro-choice intro-follow-reveal${compact ? " is-compact" : ""}${selected ? " is-selected" : ""}`}
      style={introFollowOrder(followOrder)}
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
      data-no-global-tap="true"
    >
      {children}
    </TellwisePressButton>
  )
}

function PencilArrowMoment({ active, animate }: { active: boolean; animate: boolean }) {
  const [drawing, setDrawing] = useState(!animate)
  const mainPathRef = useRef<SVGPathElement>(null)
  const mainTextureRef = useRef<SVGPathElement>(null)
  const headPathRef = useRef<SVGPathElement>(null)
  const headTextureRef = useRef<SVGPathElement>(null)
  const pencilRef = useRef<SVGGElement>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!animate) {
      setDrawing(true)
      return
    }
    if (!active) {
      setDrawing(false)
      return
    }

    const startTimer = window.setTimeout(() => setDrawing(true), 1320)
    return () => window.clearTimeout(startTimer)
  }, [active, animate])

  useEffect(() => {
    const mainPath = mainPathRef.current
    const mainTexture = mainTextureRef.current
    const headPath = headPathRef.current
    const headTexture = headTextureRef.current
    const pencil = pencilRef.current
    if (!mainPath || !mainTexture || !headPath || !headTexture || !pencil) return

    const mainLength = mainPath.getTotalLength()
    const headLength = headPath.getTotalLength()
    const mainPaths = [mainPath, mainTexture]
    const headPaths = [headPath, headTexture]

    mainPaths.forEach((path) => {
      path.style.strokeDasharray = `${mainLength}`
    })
    headPaths.forEach((path) => {
      path.style.strokeDasharray = `${headLength}`
    })

    const setMainProgress = (progress: number) => {
      const offset = `${mainLength * (1 - progress)}`
      mainPaths.forEach((path) => { path.style.strokeDashoffset = offset })
    }
    const setHeadProgress = (progress: number) => {
      const offset = `${headLength * (1 - progress)}`
      headPaths.forEach((path) => { path.style.strokeDashoffset = offset })
    }

    if (!animate) {
      setMainProgress(1)
      setHeadProgress(1)
      pencil.style.opacity = "0"
      return
    }

    if (!drawing) {
      setMainProgress(0)
      setHeadProgress(0)
      pencil.style.opacity = "0"
      return
    }

    const pointOn = (path: SVGPathElement, distance: number) => {
      const length = path.getTotalLength()
      const bounded = Math.max(0, Math.min(length, distance))
      const point = path.getPointAtLength(bounded)
      const before = path.getPointAtLength(Math.max(0, bounded - 1.5))
      const ahead = path.getPointAtLength(Math.min(length, bounded + 1.5))
      return {
        x: point.x,
        y: point.y,
        angle: Math.atan2(ahead.y - before.y, ahead.x - before.x) * 180 / Math.PI,
      }
    }

    let lastAngle: number | null = null
    const placePencil = (x: number, y: number, angle: number, opacity = 1) => {
      if (lastAngle !== null) {
        let delta = angle - lastAngle
        while (delta > 180) delta -= 360
        while (delta < -180) delta += 360
        angle = lastAngle + delta
      }
      lastAngle = angle
      pencil.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(2)}) translate(-1 -9)`)
      pencil.style.opacity = String(opacity)
    }

    const mainEndPoint = pointOn(mainPath, mainLength)
    const headStartPoint = pointOn(headPath, 0)
    const start = performance.now()
    const duration = 3050
    const mainEnd = 0.79
    const liftEnd = 0.865

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)

      if (t <= mainEnd) {
        const p = easeInOutCubic(t / mainEnd)
        setMainProgress(p)
        setHeadProgress(0)
        const point = pointOn(mainPath, mainLength * p)
        placePencil(point.x, point.y, point.angle)
      } else if (t <= liftEnd) {
        setMainProgress(1)
        setHeadProgress(0)
        const p = easeInOutCubic((t - mainEnd) / (liftEnd - mainEnd))
        const x = mainEndPoint.x + (headStartPoint.x - mainEndPoint.x) * p
        const y = mainEndPoint.y + (headStartPoint.y - mainEndPoint.y) * p - Math.sin(Math.PI * p) * 3.2
        const angle = mainEndPoint.angle + (headStartPoint.angle - mainEndPoint.angle) * p
        placePencil(x, y, angle, .82 - Math.sin(Math.PI * p) * .42)
      } else {
        const p = easeInOutCubic((t - liftEnd) / (1 - liftEnd))
        setMainProgress(1)
        setHeadProgress(p)
        const point = pointOn(headPath, headLength * p)
        placePencil(point.x, point.y, point.angle)
      }

      if (t < 1) {
        frameRef.current = window.requestAnimationFrame(tick)
      } else {
        setMainProgress(1)
        setHeadProgress(1)
        pencil.style.opacity = "0"
      }
    }

    frameRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [drawing, animate])

  const mainPath = "M26 106 C52 97 70 77 90 69 C108 62 124 90 143 87 C168 83 187 48 216 27"
  const headPath = "M188 31 C198 30 207 29 216 27 C214 37 211 46 207 54"

  return (
    <div className={`intro-pencil-moment${drawing ? " is-drawing" : ""}${animate ? "" : " is-static"}`} aria-hidden="true">
      <svg className="intro-pencil-arrow" viewBox="0 0 240 132" fill="none">
        <path ref={mainPathRef} className="intro-pencil-arrow-line" d={mainPath} />
        <path ref={mainTextureRef} className="intro-pencil-arrow-texture" d={mainPath} />
        <path ref={headPathRef} className="intro-pencil-arrow-head" d={headPath} />
        <path ref={headTextureRef} className="intro-pencil-arrow-head-texture" d={headPath} />
        <g ref={pencilRef} className="intro-pencil-svg-tool">
          {/* A compact, familiar yellow school pencil, based on the supplied
              reference. The graphite point sits at x=0 so it stays locked to
              the exact path position while the pencil rotates. */}
          <path d="M0 9 10.2 3.1 10.2 14.9 0 9Z" fill="#e7a58e" stroke="#38342f" strokeWidth="1.05" strokeLinejoin="round" />
          <path d="M0 9 3.8 6.8 3.8 11.2 0 9Z" fill="#282725" />
          <path d="M9.7 3.1H45.2V14.9H9.7Z" fill="#ffd12c" stroke="#38342f" strokeWidth="1.05" />
          <path d="M10.2 3.7H44.7V7.05H10.2Z" fill="#ffe166" opacity=".95" />
          <path d="M10.2 11.15H44.7V14.35H10.2Z" fill="#efb819" opacity=".78" />
          <path d="M10.6 4.1 44.4 4.1" stroke="#fff0a3" strokeWidth=".9" strokeLinecap="round" opacity=".74" />
          <path d="M45.2 3.1H52.4V14.9H45.2Z" fill="#63d7d2" stroke="#38342f" strokeWidth="1.05" />
          <path d="M46.8 3.4V14.6M50.5 3.4V14.6" stroke="#2f7778" strokeWidth=".65" opacity=".55" />
          <path d="M52.4 3.1H58.4C60.5 3.1 62.2 4.8 62.2 6.9V11.1C62.2 13.2 60.5 14.9 58.4 14.9H52.4Z" fill="#ff6868" stroke="#38342f" strokeWidth="1.05" />
          <path d="M54 4.15H58.2C59.55 4.15 60.65 5.25 60.65 6.6" stroke="#ff9b9b" strokeWidth=".95" strokeLinecap="round" opacity=".72" />
        </g>
      </svg>
    </div>
  )
}

function easeInOutCubic(value: number) {
  return value < .5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2
}

function TypewriterText({
  tag = "span",
  text,
  className = "",
  accentText,
  delay = 160,
  speed = 58,
  animate = true,
  start = true,
  onComplete,
}: {
  tag?: TypewriterTag
  text: string
  className?: string
  accentText?: string
  delay?: number
  speed?: number
  animate?: boolean
  start?: boolean
  onComplete?: () => void
}) {
  const [visibleCharacters, setVisibleCharacters] = useState(animate ? 0 : text.length)
  const [done, setDone] = useState(!animate)
  const onCompleteRef = useRef(onComplete)
  const Tag = tag

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!start) {
      setVisibleCharacters(0)
      setDone(false)
      return
    }

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    if (!animate || reduce) {
      setVisibleCharacters(text.length)
      setDone(true)
      queueMicrotask(() => onCompleteRef.current?.())
      return
    }

    let cancelled = false
    let characterTimer: ReturnType<typeof setTimeout> | null = null
    let index = 0

    setVisibleCharacters(0)
    setDone(false)

    const typeNext = () => {
      if (cancelled) return
      index += 1
      setVisibleCharacters(index)

      const character = text[index - 1] ?? ""
      if (character && !/\s/.test(character) && index % 2 === 0) {
        triggerIntroFeedback("typing")
      }

      if (index >= text.length) {
        setDone(true)
        onCompleteRef.current?.()
        return
      }

      characterTimer = setTimeout(typeNext, typewriterCharacterDelay(character, speed, index))
    }

    const startTimer = setTimeout(typeNext, delay)

    return () => {
      cancelled = true
      clearTimeout(startTimer)
      if (characterTimer) clearTimeout(characterTimer)
    }
  }, [animate, delay, speed, start, text])

  let characterIndex = 0
  const tokens = text.split(/(\s+)/)
  const caret = (key: string) => {
    const activelyTyping = animate && start && !done && visibleCharacters > 0 && visibleCharacters < text.length
    if (!activelyTyping) return null
    return <span key={key} className="intro-typewriter-caret" />
  }

  return (
    <Tag className={`intro-typewriter ${className}`.trim()} aria-label={text}>
      <span className="intro-typewriter-stable" aria-hidden="true">
        
        {tokens.map((token, tokenIndex) => {
          if (/^\s+$/.test(token)) {
            return Array.from(token).map((character, index) => {
              const currentIndex = characterIndex++
              return (
                <span className="intro-typewriter-slot" key={`space-${tokenIndex}-${index}`}>
                  <span
                    className="intro-typewriter-character"
                    style={{ visibility: currentIndex < visibleCharacters ? "visible" : "hidden" }}
                  >
                    {character}
                  </span>
                  {currentIndex + 1 === visibleCharacters ? caret(`caret-space-${tokenIndex}-${index}`) : null}
                </span>
              )
            })
          }

          const isAccent = accentText ? token === accentText : false
          return (
            <span className={`intro-typewriter-word${isAccent ? " is-accent" : ""}`} key={`${token}-${tokenIndex}`}>
              {Array.from(token).map((character, index) => {
                const currentIndex = characterIndex++
                return (
                  <span className="intro-typewriter-slot" key={`${tokenIndex}-${index}`}>
                    <span
                      className="intro-typewriter-character"
                      style={{ visibility: currentIndex < visibleCharacters ? "visible" : "hidden" }}
                    >
                      {character}
                    </span>
                    {currentIndex + 1 === visibleCharacters ? caret(`caret-${tokenIndex}-${index}`) : null}
                  </span>
                )
              })}
            </span>
          )
        })}
      </span>
    </Tag>
  )
}

function typewriterCharacterDelay(character: string, speed: number, index: number) {
  if (/[.!?]/.test(character)) return Math.round(speed * 2.7)
  if (/[,;:]/.test(character)) return Math.round(speed * 1.65)
  if (/\s/.test(character)) return Math.max(24, Math.round(speed * .55))
  const cadence = [0, 5, -2, 3, 1, -1][index % 6]
  return Math.max(34, speed + cadence)
}

function IntroBookSketch() {
  return (
    <svg className="intro-book-sketch" viewBox="0 0 280 190" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="intro-book-paper-left" x1="66" y1="48" x2="136" y2="145" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fffaf0" />
          <stop offset=".7" stopColor="#eee4d4" />
          <stop offset="1" stopColor="#ddd0bd" />
        </linearGradient>
        <linearGradient id="intro-book-paper-right" x1="214" y1="48" x2="144" y2="145" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fffaf0" />
          <stop offset=".7" stopColor="#eee4d4" />
          <stop offset="1" stopColor="#ddd0bd" />
        </linearGradient>
        <linearGradient id="intro-book-cover" x1="140" y1="129" x2="140" y2="164" gradientUnits="userSpaceOnUse">
          <stop stopColor="#627f9f" />
          <stop offset="1" stopColor="#3f6388" />
        </linearGradient>
        <filter id="intro-book-shadow" x="-35%" y="-45%" width="170%" height="220%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#43392f" floodOpacity=".2" />
        </filter>
      </defs>

      <ellipse className="intro-book-ground" cx="140" cy="158" rx="76" ry="8" fill="#5f5548" fillOpacity=".13" />
      <g className="intro-book-object" filter="url(#intro-book-shadow)">
        <path d="M55 61c29-9 57-5 85 10 28-15 56-19 85-10v86c-29-7-57-4-85 11-28-15-56-18-85-11V61Z" fill="url(#intro-book-cover)" stroke="#3b516b" strokeWidth="3" strokeLinejoin="round" />
        <path className="intro-book-page intro-book-page-left" d="M62 54c27-9 53-5 78 11v78c-25-14-51-17-78-9V54Z" fill="url(#intro-book-paper-left)" stroke="#776c60" strokeWidth="2.45" strokeLinejoin="round" />
        <path className="intro-book-page intro-book-page-right" d="M218 54c-27-9-53-5-78 11v78c25-14 51-17 78-9V54Z" fill="url(#intro-book-paper-right)" stroke="#776c60" strokeWidth="2.45" strokeLinejoin="round" />
        <path className="intro-book-gutter" d="M140 65c-3.2 23-3.2 52 0 78" stroke="#7c5b45" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M65 137c26-7 51-4 75 9 24-13 49-16 75-9" stroke="#d7c8b2" strokeWidth="1.8" strokeLinecap="round" opacity=".92" />
        <path d="M68 141c24-5 48-2 72 10 24-12 48-15 72-10" stroke="#c8b9a5" strokeWidth="1.15" strokeLinecap="round" opacity=".72" />
        <g className="intro-book-copy" stroke="#aaa091" strokeWidth="1.8" strokeLinecap="round">
          <path d="M76 74c15-3 29-1 43 3" />
          <path d="M75 85c16-3 31-1 45 3" />
          <path d="M75 96c15-3 29-1 43 3" />
          <path d="M75 107c14-2 28-1 41 3" />
          <path d="M76 118c13-2 26-1 38 3" />
          <path d="M204 74c-15-3-29-1-43 3" />
          <path d="M205 85c-16-3-31-1-45 3" />
          <path d="M205 96c-15-3-29-1-43 3" />
          <path d="M205 107c-14-2-28-1-41 3" />
          <path d="M204 118c-13-2-26-1-38 3" />
        </g>
        <path className="intro-book-highlight" d="M69 61c22-5 43-2 62 8" stroke="#fffaf0" strokeWidth="1.35" strokeLinecap="round" opacity=".7" />
        <path className="intro-book-highlight" d="M211 61c-22-5-43-2-62 8" stroke="#fffaf0" strokeWidth="1.35" strokeLinecap="round" opacity=".7" />
        <path className="intro-book-accent" d="M128 134c4.5 1.8 8.5 4.5 12 7.3 3.5-2.8 7.5-5.5 12-7.3" stroke="#a16c48" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

function introOrder(order: number): CSSProperties {
  return { "--intro-order": order } as CSSProperties
}

function introFollowOrder(order: number): CSSProperties {
  return { "--intro-follow-order": order } as CSSProperties
}

let introAudioContext: AudioContext | null = null

function playIntroFeedbackTone(kind: IntroFeedback) {
  try {
    const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextConstructor) return

    // Browsers will not unlock Web Audio before a real user gesture. Typing
    // feedback therefore waits until one of the user's first taps creates the
    // context, while native/browser vibration can still be attempted.
    if (kind === "typing" && !introAudioContext) return
    if (!introAudioContext) introAudioContext = new AudioContextConstructor()
    const context = introAudioContext
    if (context.state === "suspended") void context.resume()

    const now = context.currentTime

    const gain = context.createGain()
    const oscillator = context.createOscillator()

    if (kind === "typing") {
      oscillator.type = "triangle"
      oscillator.frequency.setValueAtTime(690, now)
      gain.gain.setValueAtTime(.0001, now)
      gain.gain.exponentialRampToValueAtTime(.0065, now + .003)
      gain.gain.exponentialRampToValueAtTime(.0001, now + .018)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + .022)
      return
    }

    if (kind === "reveal") {
      oscillator.type = "triangle"
      oscillator.frequency.setValueAtTime(465, now)
      oscillator.frequency.exponentialRampToValueAtTime(520, now + .034)
      gain.gain.setValueAtTime(.0001, now)
      gain.gain.exponentialRampToValueAtTime(.012, now + .004)
      gain.gain.exponentialRampToValueAtTime(.0001, now + .045)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + .052)
      return
    }

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(kind === "selection" ? 520 : kind === "back" ? 405 : 585, now)
    if (kind === "page" || kind === "action") {
      oscillator.frequency.exponentialRampToValueAtTime(kind === "page" ? 720 : 790, now + .052)
    }
    gain.gain.setValueAtTime(.0001, now)
    gain.gain.exponentialRampToValueAtTime(kind === "selection" ? .022 : .028, now + .006)
    gain.gain.exponentialRampToValueAtTime(.0001, now + (kind === "selection" ? .052 : .082))
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + .09)
  } catch {}
}

function triggerIntroFeedback(kind: IntroFeedback) {
  if (typeof window === "undefined") return

  try {
    window.dispatchEvent(new CustomEvent("tellwise:haptic", { detail: { kind } }))
  } catch {}

  playIntroFeedbackTone(kind)

  if (!("vibrate" in window.navigator)) return
  try {
    const pattern = kind === "typing"
      ? 4
      : kind === "reveal"
        ? 7
      : kind === "selection"
        ? 16
        : kind === "action"
          ? [18, 22, 12]
          : kind === "back"
            ? 12
            : [13, 18, 11]
    window.navigator.vibrate(pattern)
  } catch {}
}

