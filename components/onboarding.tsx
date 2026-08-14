"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react"
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

const TYPE_SPEED = 30
const TYPE_GAP = 130

const goalDetails: Array<{ value: StoryGoalChoice; title: string; detail: string }> = [
  { value: "everyday", title: "Everyday stories", detail: "Tell better stories with friends." },
  { value: "speaking", title: "Interviews & speaking", detail: "Answer clearly and confidently." },
  { value: "writing", title: "Writing", detail: "Turn experiences into stronger stories." },
  { value: "confidence", title: "Confidence", detail: "Feel better when people are listening." },
]

const blockers: Array<Exclude<StoryBlocker, "">> = ["ramble", "start", "boring", "details", "nervous", "confident"]

export function Onboarding({ initialPage = 0 }: { initialPage?: number }) {
  const [page, setPage] = useState(() => Math.max(0, Math.min(4, initialPage)))
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

  function chooseBlocker(blocker: Exclude<StoryBlocker, "">) {
    triggerIntroFeedback("selection")
    save({ ...preferences, blocker })
  }

  function nextPage() {
    if (!canAdvance) return
    triggerIntroFeedback("page")
    bookRef.current?.next()
  }

  function previousPage() {
    triggerIntroFeedback("back")
    bookRef.current?.previous()
  }

  return (
    <main className={page === 0 ? "book-intro-canvas is-cover" : "book-intro-canvas"}>
      <BookSlider
        ref={bookRef}
        page={page}
        onPageChange={setPage}
        canGoNext={canAdvance}
        onTurn={(direction) => triggerIntroFeedback(direction === "next" ? "page" : "back")}
      >
        <BookPage cover>
          <CoverPage active={page === 0} onNext={nextPage} />
        </BookPage>

        <BookPage>
          <GoalPage active={page === 1} values={selectedGoals} onToggle={toggleGoal} onNext={nextPage} onBack={previousPage} />
        </BookPage>

        <BookPage>
          <BlockerPage active={page === 2} value={preferences.blocker} onChoose={chooseBlocker} onNext={nextPage} onBack={previousPage} />
        </BookPage>

        <BookPage>
          <SecretPage active={page === 3} onNext={nextPage} onBack={previousPage} />
        </BookPage>

        <BookPage>
          <ReadyPage active={page === 4} preferences={preferences} onBack={previousPage} />
        </BookPage>
      </BookSlider>
    </main>
  )
}

function CoverPage({ active, onNext }: { active: boolean; onNext: () => void }) {
  const title = "Welcome to StoryTuner."
  const subtitle = "Learn to tell stories people actually want to hear."
  const titleDelay = 220
  const subtitleDelay = titleDelay + typeDuration(title, 31) + 170

  return (
    <div className="book-cover-content">
      <div className="book-cover-rule" aria-hidden="true" />
      <div>
        <p className="book-cover-kicker">STORYTUNER</p>
        <TypewriterText as="h1" text={title} active={active} delay={titleDelay} speed={31} />
        <TypewriterText className="book-cover-subtitle" as="p" text={subtitle} active={active} delay={subtitleDelay} speed={29} />
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
  active,
  values,
  onToggle,
  onNext,
  onBack,
}: {
  active: boolean
  values: StoryGoalChoice[]
  onToggle: (value: StoryGoalChoice) => void
  onNext: () => void
  onBack: () => void
}) {
  const eyebrow = "A note about you"
  const title = "What do you want to get better at?"
  const helper = "Choose as many as you want."
  const eyebrowDelay = 120
  const titleDelay = eyebrowDelay + typeDuration(eyebrow) + TYPE_GAP
  const helperDelay = titleDelay + typeDuration(title) + TYPE_GAP
  const choicesDelay = helperDelay + typeDuration(helper) + 120
  const choicesVisible = useRevealAfter(active, choicesDelay)

  return (
    <PaperLayout pageNumber={1} onBack={onBack}>
      <div className="book-paper-heading">
        <TypewriterText className="book-paper-eyebrow" as="p" text={eyebrow} active={active} delay={eyebrowDelay} />
        <TypewriterText as="h1" text={title} active={active} delay={titleDelay} />
        <TypewriterText as="p" text={helper} active={active} delay={helperDelay} />
      </div>

      <div className={choicesVisible ? "book-choice-list book-content-fade is-visible" : "book-choice-list book-content-fade"}>
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
  active,
  value,
  onChoose,
  onNext,
  onBack,
}: {
  active: boolean
  value: StoryBlocker
  onChoose: (value: Exclude<StoryBlocker, "">) => void
  onNext: () => void
  onBack: () => void
}) {
  const eyebrow = "Be honest"
  const title = "What usually gets in your way?"
  const eyebrowDelay = 120
  const titleDelay = eyebrowDelay + typeDuration(eyebrow) + TYPE_GAP
  const choicesDelay = titleDelay + typeDuration(title) + 130
  const choicesVisible = useRevealAfter(active, choicesDelay)

  return (
    <PaperLayout pageNumber={2} onBack={onBack}>
      <div className="book-paper-heading compact">
        <TypewriterText className="book-paper-eyebrow" as="p" text={eyebrow} active={active} delay={eyebrowDelay} />
        <TypewriterText as="h1" text={title} active={active} delay={titleDelay} />
      </div>

      <div className={choicesVisible ? "book-choice-list book-choice-list-compact book-content-fade is-visible" : "book-choice-list book-choice-list-compact book-content-fade"}>
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

function SecretPage({ active, onNext, onBack }: { active: boolean; onNext: () => void; onBack: () => void }) {
  const eyebrow = "Here’s the secret."
  const title = "Great stories aren’t about having an extraordinary life."
  const copyLead = "They’re about knowing "
  const copyStrong = "what to notice, what to leave out, and what to make people care about."
  const eyebrowDelay = 130
  const titleDelay = eyebrowDelay + typeDuration(eyebrow) + TYPE_GAP
  const copyDelay = titleDelay + typeDuration(title, 29) + 150
  const artDelay = copyDelay + typeDuration(copyLead + copyStrong, 27) + 180
  const artVisible = useRevealAfter(active, artDelay)

  return (
    <PaperLayout pageNumber={3} onBack={onBack} centered>
      <div className="book-secret-reveal">
        <TypewriterText className="book-paper-eyebrow" as="p" text={eyebrow} active={active} delay={eyebrowDelay} />
        <TypewriterText className="book-secret-title" as="h1" text={title} active={active} delay={titleDelay} speed={29} />
        <RichTypewriterText
          className="book-secret-copy"
          as="p"
          active={active}
          delay={copyDelay}
          speed={27}
          segments={[
            { text: copyLead },
            { text: copyStrong, strong: true },
          ]}
        />
        <img
          src="/magnifying-glass-sketch.png"
          alt=""
          aria-hidden="true"
          className={artVisible ? "book-secret-magnifier is-visible" : "book-secret-magnifier"}
          draggable={false}
        />
      </div>
      <PageTurnAction onClick={onNext}>Continue</PageTurnAction>
    </PaperLayout>
  )
}

function ReadyPage({ active, preferences, onBack }: { active: boolean; preferences: OnboardingPreferences; onBack: () => void }) {
  const items = ["Learn", "Practice", "Get feedback", "Improve"]
  const goals = preferences.goals ?? []
  const eyebrow = "Your next chapter"
  const title = "StoryTuner is ready."
  const subtitle = "You’ll learn one idea at a time, then practice it in stories of your own."
  const focus = goals.length > 0 ? `Starting focus: ${goals.map((goal) => goalLabels[goal]).join(", ")}.` : ""

  const eyebrowDelay = 120
  const titleDelay = eyebrowDelay + typeDuration(eyebrow) + TYPE_GAP
  const subtitleDelay = titleDelay + typeDuration(title) + TYPE_GAP
  const listStartDelay = subtitleDelay + typeDuration(subtitle, 28) + 150
  const listStep = 180
  const focusDelay = listStartDelay + items.reduce((total, item) => total + typeDuration(item, 28) + listStep, 0)

  return (
    <PaperLayout pageNumber={4} onBack={onBack}>
      <div className="book-paper-heading">
        <TypewriterText className="book-paper-eyebrow" as="p" text={eyebrow} active={active} delay={eyebrowDelay} />
        <TypewriterText as="h1" text={title} active={active} delay={titleDelay} />
        <TypewriterText as="p" text={subtitle} active={active} delay={subtitleDelay} speed={28} />
      </div>

      <div className="book-ready-list">
        {items.map((item, index) => {
          const itemDelay = listStartDelay + items.slice(0, index).reduce((total, previous) => total + typeDuration(previous, 28) + listStep, 0)
          return (
            <div key={item} className="book-ready-line">
              <span>{index + 1}.</span>
              <TypewriterText as="strong" text={item} active={active} delay={itemDelay} speed={28} />
            </div>
          )
        })}
      </div>

      {focus && (
        <TypewriterText className="book-focus-note" as="p" text={focus} active={active} delay={focusDelay} speed={28} />
      )}

      <div className="book-final-actions" data-book-no-turn="true">
        <Link
          href="/sign-up"
          data-book-no-turn="true"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={() => triggerIntroFeedback("action")}
          className="book-start-link"
        >
          Start learning <span aria-hidden="true">→</span>
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
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerUp={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onBack()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            if (event.detail === 0) onBack()
          }}
          aria-label="Turn to the previous page"
        >
          ←
        </button>
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
      {children} <span aria-hidden="true">→</span>
    </button>
  )
}

type TypewriterSegment = {
  text: string
  strong?: boolean
}

function TypewriterText({
  text,
  active,
  delay = 0,
  speed = TYPE_SPEED,
  as = "span",
  className,
}: {
  text: string
  active: boolean
  delay?: number
  speed?: number
  as?: ElementType
  className?: string
}) {
  return (
    <RichTypewriterText
      segments={[{ text }]}
      active={active}
      delay={delay}
      speed={speed}
      as={as}
      className={className}
    />
  )
}

function RichTypewriterText({
  segments,
  active,
  delay = 0,
  speed = TYPE_SPEED,
  as: Tag = "span",
  className,
}: {
  segments: TypewriterSegment[]
  active: boolean
  delay?: number
  speed?: number
  as?: ElementType
  className?: string
}) {
  const fullText = segments.map((segment) => segment.text).join("")
  const [visibleCharacters, setVisibleCharacters] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    if (!active) {
      setVisibleCharacters(0)
      return
    }

    if (prefersReducedMotion()) {
      setVisibleCharacters(fullText.length)
      return
    }

    setVisibleCharacters(0)

    const revealNext = (index: number) => {
      if (cancelled || index > fullText.length) return
      setVisibleCharacters(index)
      if (index < fullText.length) {
        timer = setTimeout(() => revealNext(index + 1), speed)
      }
    }

    timer = setTimeout(() => revealNext(1), delay)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [active, delay, fullText, speed])

  let offset = 0
  let cursorPlaced = false
  const isTyping = active && visibleCharacters > 0 && visibleCharacters < fullText.length

  const rendered = segments.map((segment, index) => {
    const start = offset
    const end = start + segment.text.length
    offset = end

    const visibleAmount = Math.max(0, Math.min(segment.text.length, visibleCharacters - start))
    const visible = segment.text.slice(0, visibleAmount)
    const pending = segment.text.slice(visibleAmount)
    const cursorBelongsHere = isTyping && !cursorPlaced && visibleCharacters >= start && visibleCharacters <= end
    if (cursorBelongsHere) cursorPlaced = true

    const contents = (
      <>
        {visible}
        {cursorBelongsHere && <span className="book-typewriter-cursor" aria-hidden="true" />}
        {pending && <span className="book-typewriter-pending" aria-hidden="true">{pending}</span>}
      </>
    )

    return segment.strong
      ? <strong key={index}>{contents}</strong>
      : <span key={index}>{contents}</span>
  })

  return (
    <Tag className={className} aria-label={fullText}>
      {rendered}
    </Tag>
  )
}

function useRevealAfter(active: boolean, delay: number) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }

    if (prefersReducedMotion()) {
      setVisible(true)
      return
    }

    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [active, delay])

  return visible
}

function typeDuration(text: string, speed = TYPE_SPEED) {
  return text.length * speed
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
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
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const baseFrequency = kind === "selection" ? 185 : kind === "action" ? 225 : kind === "back" ? 135 : 150
      const duration = kind === "selection" ? 0.032 : kind === "action" ? 0.04 : 0.045
      const volume = kind === "selection" ? 0.008 : kind === "action" ? 0.01 : 0.007

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(baseFrequency, now)
      oscillator.frequency.exponentialRampToValueAtTime(baseFrequency * 0.9, now + duration)
      gain.gain.setValueAtTime(volume, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + duration + 0.005)
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
    const duration = kind === "selection" ? 4 : kind === "action" ? 6 : 5
    window.navigator.vibrate(duration)
  } catch {}
}

