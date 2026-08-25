"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { preload } from "react-dom"
import { BookOpen, Check } from "lucide-react"
import BookSlider, { BookPage, type BookSliderHandle } from "@/components/ui/book-slider"
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

const blockers: StoryBlockerChoice[] = ["ramble", "start", "boring", "details", "nervous", "confident"]

export function Onboarding({ initialPage = 0 }: { initialPage?: number }) {
  // Warm the mascot video during onboarding so the authentication page can
  // render Parch immediately instead of beginning the media request only after
  // navigation.
  preload("/parch-reading.mp4", { as: "video", type: "video/mp4" })
  preload("/parch-reading-poster.jpg", { as: "image" })
  const normalizedInitialPage = Math.max(0, Math.min(4, initialPage))
  const [page, setPage] = useState(normalizedInitialPage)
  const [coverOpening, setCoverOpening] = useState(false)
  const coverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageRef = useRef(normalizedInitialPage)
  const bookRef = useRef<BookSliderHandle>(null)
  const [preferences, setPreferences] = useState<OnboardingPreferences>({ goal: "", goals: [], blocker: "", blockers: [] })

  useEffect(() => {
    setPreferences(readOnboardingPreferences())
    return () => {
      if (coverTimerRef.current) clearTimeout(coverTimerRef.current)
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

  function openCover() {
    if (coverOpening || page !== 0) return
    triggerIntroFeedback("page")
    setCoverOpening(true)
    if (coverTimerRef.current) clearTimeout(coverTimerRef.current)
    coverTimerRef.current = setTimeout(() => {
      pageRef.current = 1
      setPage(1)
      setCoverOpening(false)
      coverTimerRef.current = null
    }, 690)
  }

  function nextPage() {
    if (page === 0) {
      openCover()
      return
    }
    if (!canAdvance) return
    triggerIntroFeedback("page")
    bookRef.current?.next()
  }

  function previousPage() {
    if (pageRef.current <= 0) return
    triggerIntroFeedback("back")

    // On the first inside page, return to the hardcover instead of asking
    // react-pageflip to synthesize a backwards hard-cover turn.
    if (pageRef.current === 1) {
      pageRef.current = 0
      setPage(0)
      setCoverOpening(false)
      return
    }

    bookRef.current?.previous()
  }

  function handleInsidePageChange(nextPage: number) {
    const logicalPage = nextPage + 1
    pageRef.current = logicalPage
    setPage(logicalPage)
  }

  return (
    <main className={page === 0 ? "book-intro-canvas is-cover" : "book-intro-canvas"}>
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
      <div className="book-inside-pages" aria-hidden={page === 0 && !coverOpening ? "true" : undefined}>
        <BookSlider
          ref={bookRef}
          page={Math.max(0, page - 1)}
          onPageChange={handleInsidePageChange}
          canGoNext={canAdvance}
          onTurn={(direction) => triggerIntroFeedback(direction === "next" ? "page" : "back")}
        >
          <BookPage>
            <GoalPage values={selectedGoals} onToggle={toggleGoal} onNext={nextPage} onBack={previousPage} />
          </BookPage>

          <BookPage>
            <BlockerPage values={selectedBlockers} onToggle={toggleBlocker} onNext={nextPage} onBack={previousPage} />
          </BookPage>

          <BookPage>
            <SecretPage onNext={nextPage} onBack={previousPage} />
          </BookPage>

          <BookPage>
            <ReadyPage onBack={previousPage} />
          </BookPage>
        </BookSlider>
      </div>

      {page === 0 && (
        <div className={coverOpening ? "book-standalone-cover is-opening" : "book-standalone-cover"}>
          <CoverPage onNext={openCover} />
        </div>
      )}
    </main>
  )
}

function CoverPage({ onNext }: { onNext: () => void }) {
  return (
    <div className="book-cover-content">
      <div className="book-cover-rule" aria-hidden="true" />
      <div>
        <p className="book-cover-kicker">TELLWISE</p>
        <h1>Welcome to Tellwise.</h1>
        <p className="book-cover-subtitle">Learn to tell stories people actually want to hear.</p>
      </div>
      <BookOpen className="book-cover-icon" strokeWidth={1.5} aria-hidden="true" />
      <button
        type="button"
        className="book-cover-open"
        data-book-no-turn="true"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onClick={onNext}
      >
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

      <div className="book-choice-list is-visible">
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
    <PaperLayout pageNumber={2} onBack={onBack}>
      <div className="book-paper-heading compact">
        <p className="book-paper-eyebrow">Be honest</p>
        <h1>What usually gets in your way?</h1>
        <p>Choose as many as you want.</p>
      </div>

      <div className="book-choice-list book-choice-list-compact is-visible">
        {blockers.map((blocker) => (
          <BookChoice key={blocker} selected={values.includes(blocker)} compact onClick={() => onToggle(blocker)}>
            <span className="book-choice-title">{blockerLabels[blocker]}</span>
          </BookChoice>
        ))}
      </div>

      <PageTurnAction onClick={onNext} disabled={values.length === 0}>Continue</PageTurnAction>
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
          className="book-secret-magnifier is-visible"
          draggable={false}
        />
      </div>
      <PageTurnAction onClick={onNext}>Continue</PageTurnAction>
    </PaperLayout>
  )
}

function ReadyPage({ onBack }: { onBack: () => void }) {
  const items = ["Learn", "Practice", "Get feedback", "Improve"]

  return (
    <PaperLayout pageNumber={4} onBack={onBack}>
      <div className="book-paper-heading">
        <p className="book-paper-eyebrow">Your next chapter</p>
        <h1>Tellwise is ready.</h1>
        <p>You’ll learn one idea at a time, then implement those ideas in stories of your own.</p>
      </div>

      <div className="book-ready-list">
        {items.map((item, index) => (
          <div key={item} className="book-ready-line">
            <span>{index + 1}.</span>
            <strong>{item}</strong>
          </div>
        ))}
      </div>

      <div className="book-final-actions" data-book-no-turn="true">
        <Link
          href="/sign-up"
          prefetch
          data-book-no-turn="true"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={() => triggerIntroFeedback("page")}
          className="book-start-link"
        >
          Start learning
        </Link>
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
        <button
          type="button"
          data-book-no-turn="true"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onBack()
          }}
          aria-label="Turn to the previous page"
        >
          ←
        </button>
        <span>Tellwise</span>
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
      data-no-global-tap="true"
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
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onClick={onClick}
      disabled={disabled}
      data-book-no-turn="true"
      className="book-turn-action"
    >
      <span className="book-turn-action-label">{children}</span>
    </button>
  )
}

let introAudioContext: AudioContext | null = null

function getIntroAudioContext(create: boolean) {
  if (typeof window === "undefined") return null
  if (!introAudioContext && create && "AudioContext" in window) {
    try {
      introAudioContext = new window.AudioContext()
    } catch {
      return null
    }
  }
  return introAudioContext
}

function playIntroSound(kind: "selection" | "action" | "page" | "back") {
  const context = getIntroAudioContext(true)
  if (!context) return

  const play = () => {
    try {
      const now = context.currentTime

      if (kind === "selection") {
        const body = context.createOscillator()
        const bodyGain = context.createGain()
        body.type = "sine"
        body.frequency.setValueAtTime(190, now)
        body.frequency.exponentialRampToValueAtTime(158, now + 0.055)
        bodyGain.gain.setValueAtTime(0.0001, now)
        bodyGain.gain.linearRampToValueAtTime(0.031, now + 0.004)
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.057)
        body.connect(bodyGain)
        bodyGain.connect(context.destination)
        body.start(now)
        body.stop(now + 0.065)

        const noiseLength = Math.max(1, Math.floor(context.sampleRate * 0.028))
        const noiseBuffer = context.createBuffer(1, noiseLength, context.sampleRate)
        const noiseData = noiseBuffer.getChannelData(0)
        for (let index = 0; index < noiseLength; index += 1) {
          const envelope = 1 - index / noiseLength
          noiseData[index] = (Math.random() * 2 - 1) * envelope
        }

        const noise = context.createBufferSource()
        const filter = context.createBiquadFilter()
        const noiseGain = context.createGain()
        noise.buffer = noiseBuffer
        filter.type = "lowpass"
        filter.frequency.setValueAtTime(1050, now)
        noiseGain.gain.setValueAtTime(0.014, now)
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028)
        noise.connect(filter)
        filter.connect(noiseGain)
        noiseGain.connect(context.destination)
        noise.start(now)
        noise.stop(now + 0.03)
        return
      }

      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const settings = kind === "action"
        ? { frequency: 465, end: 390, duration: 0.075, volume: 0.05, wave: "triangle" as OscillatorType }
        : kind === "back"
          ? { frequency: 225, end: 185, duration: 0.064, volume: 0.034, wave: "sine" as OscillatorType }
          : { frequency: 285, end: 235, duration: 0.07, volume: 0.038, wave: "sine" as OscillatorType }

      oscillator.type = settings.wave
      oscillator.frequency.setValueAtTime(settings.frequency, now)
      oscillator.frequency.exponentialRampToValueAtTime(settings.end, now + settings.duration)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(settings.volume, now + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration)

      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + settings.duration + 0.01)
    } catch {}
  }

  if (context.state === "suspended") {
    void context.resume().then(play).catch(() => {})
  } else {
    play()
  }
}

function triggerIntroFeedback(kind: "selection" | "action" | "page" | "back") {
  if (typeof window === "undefined") return

  playIntroSound(kind)

  if (!("vibrate" in window.navigator)) return
  try {
    const duration = kind === "selection" ? 10 : kind === "action" ? 14 : kind === "back" ? 9 : 12
    window.navigator.vibrate(duration)
  } catch {}
}
