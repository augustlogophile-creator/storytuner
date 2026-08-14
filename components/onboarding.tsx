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

const TYPE_SPEED = 40
const TYPE_GAP = 165

const goalDetails: Array<{ value: StoryGoalChoice; title: string; detail: string }> = [
  { value: "everyday", title: "Everyday stories", detail: "Tell better stories with friends." },
  { value: "speaking", title: "Interviews & speaking", detail: "Answer clearly and confidently." },
  { value: "writing", title: "Writing", detail: "Turn experiences into stronger stories." },
  { value: "confidence", title: "Confidence", detail: "Feel better when people are listening." },
]

const blockers: Array<Exclude<StoryBlocker, "">> = ["ramble", "start", "boring", "details", "nervous", "confident"]

export function Onboarding({ initialPage = 0 }: { initialPage?: number }) {
  const [page, setPage] = useState(() => Math.max(0, Math.min(4, initialPage)))
  const pageRef = useRef(page)
  const bookRef = useRef<BookSliderHandle>(null)
  const [seenPages, setSeenPages] = useState<Set<number>>(() => new Set(initialPage > 0 ? [initialPage] : []))
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

  function handlePageChange(nextPage: number) {
    const previous = pageRef.current
    setSeenPages((current) => {
      const next = new Set(current)
      next.add(previous)
      // A backwards turn always lands on a page the reader has already seen,
      // so its content should be fully present instead of replaying reveals.
      if (nextPage < previous) next.add(nextPage)
      return next
    })
    pageRef.current = nextPage
    setPage(nextPage)
  }

  const pageAnimation = (index: number) => page === index && !seenPages.has(index)

  return (
    <main className={page === 0 ? "book-intro-canvas is-cover" : "book-intro-canvas"}>
      <BookSlider
        ref={bookRef}
        page={page}
        onPageChange={handlePageChange}
        canGoNext={canAdvance}
        onTurn={(direction) => triggerIntroFeedback(direction === "next" ? "page" : "back")}
      >
        <BookPage cover>
          <CoverPage active={page === 0} animate={pageAnimation(0)} onNext={nextPage} />
        </BookPage>

        <BookPage>
          <GoalPage active={page === 1} animate={pageAnimation(1)} values={selectedGoals} onToggle={toggleGoal} onNext={nextPage} onBack={previousPage} />
        </BookPage>

        <BookPage>
          <BlockerPage active={page === 2} animate={pageAnimation(2)} value={preferences.blocker} onChoose={chooseBlocker} onNext={nextPage} onBack={previousPage} />
        </BookPage>

        <BookPage>
          <SecretPage active={page === 3} animate={pageAnimation(3)} onNext={nextPage} onBack={previousPage} />
        </BookPage>

        <BookPage>
          <ReadyPage active={page === 4} animate={pageAnimation(4)} preferences={preferences} onBack={previousPage} />
        </BookPage>
      </BookSlider>
    </main>
  )
}

function CoverPage({ active, animate, onNext }: { active: boolean; animate: boolean; onNext: () => void }) {
  const title = "Welcome to StoryTuner."
  const subtitle = "Learn to tell stories people actually want to hear."
  const titleDelay = 220
  const subtitleDelay = titleDelay + typeDuration(title, 42) + 170

  return (
    <div className="book-cover-content">
      <div className="book-cover-rule" aria-hidden="true" />
      <div>
        <p className="book-cover-kicker">STORYTUNER</p>
        <TypewriterText as="h1" text={title} active={active} instant={!animate} delay={titleDelay} speed={42} />
        <TypewriterText className="book-cover-subtitle" as="p" text={subtitle} active={active} instant={!animate} delay={subtitleDelay} speed={40} />
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
  animate,
  values,
  onToggle,
  onNext,
  onBack,
}: {
  active: boolean
  animate: boolean
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
  const choicesVisible = useRevealAfter(active, choicesDelay, !animate)

  return (
    <PaperLayout pageNumber={1} onBack={onBack}>
      <div className="book-paper-heading">
        <TypewriterText className="book-paper-eyebrow" as="p" text={eyebrow} active={active} instant={!animate} delay={eyebrowDelay} />
        <TypewriterText as="h1" text={title} active={active} instant={!animate} delay={titleDelay} />
        <TypewriterText as="p" text={helper} active={active} instant={!animate} delay={helperDelay} />
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
  animate,
  value,
  onChoose,
  onNext,
  onBack,
}: {
  active: boolean
  animate: boolean
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
  const choicesVisible = useRevealAfter(active, choicesDelay, !animate)

  return (
    <PaperLayout pageNumber={2} onBack={onBack}>
      <div className="book-paper-heading compact">
        <TypewriterText className="book-paper-eyebrow" as="p" text={eyebrow} active={active} instant={!animate} delay={eyebrowDelay} />
        <TypewriterText as="h1" text={title} active={active} instant={!animate} delay={titleDelay} />
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

function SecretPage({ active, animate, onNext, onBack }: { active: boolean; animate: boolean; onNext: () => void; onBack: () => void }) {
  const eyebrow = "Here’s the secret."
  const title = "Great stories aren’t about having an extraordinary life."
  const copyLead = "They’re about knowing "
  const copyStrong = "what to notice, what to leave out, and what to make people care about."
  const eyebrowDelay = 130
  const titleDelay = eyebrowDelay + typeDuration(eyebrow) + TYPE_GAP
  const copyDelay = titleDelay + typeDuration(title, 40) + 150
  const artDelay = copyDelay + typeDuration(copyLead + copyStrong, 38) + 180
  const artVisible = useRevealAfter(active, artDelay, !animate)

  return (
    <PaperLayout pageNumber={3} onBack={onBack} centered>
      <div className="book-secret-reveal">
        <TypewriterText className="book-paper-eyebrow" as="p" text={eyebrow} active={active} instant={!animate} delay={eyebrowDelay} />
        <TypewriterText className="book-secret-title" as="h1" text={title} active={active} instant={!animate} delay={titleDelay} speed={40} />
        <RichTypewriterText
          className="book-secret-copy"
          as="p"
          active={active}
          instant={!animate}
          delay={copyDelay}
          speed={38}
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

function ReadyPage({ active, animate, preferences, onBack }: { active: boolean; animate: boolean; preferences: OnboardingPreferences; onBack: () => void }) {
  const items = ["Learn", "Practice", "Get feedback", "Improve"]
  const goals = preferences.goals ?? []
  const eyebrow = "Your next chapter"
  const title = "StoryTuner is ready."
  const subtitle = "You’ll learn one idea at a time, then practice it in stories of your own."
  const focus = goals.length > 0 ? `Starting focus: ${goals.map((goal) => goalLabels[goal]).join(", ")}.` : ""

  const eyebrowDelay = 120
  const titleDelay = eyebrowDelay + typeDuration(eyebrow) + TYPE_GAP
  const subtitleDelay = titleDelay + typeDuration(title) + TYPE_GAP
  const listStartDelay = subtitleDelay + typeDuration(subtitle, 38) + 150
  const listStep = 180
  const focusDelay = listStartDelay + items.reduce((total, item) => total + typeDuration(item, 38) + listStep, 0)

  return (
    <PaperLayout pageNumber={4} onBack={onBack}>
      <div className="book-paper-heading">
        <TypewriterText className="book-paper-eyebrow" as="p" text={eyebrow} active={active} instant={!animate} delay={eyebrowDelay} />
        <TypewriterText as="h1" text={title} active={active} instant={!animate} delay={titleDelay} />
        <TypewriterText as="p" text={subtitle} active={active} instant={!animate} delay={subtitleDelay} speed={38} />
      </div>

      <div className="book-ready-list">
        {items.map((item, index) => {
          const itemDelay = listStartDelay + items.slice(0, index).reduce((total, previous) => total + typeDuration(previous, 38) + listStep, 0)
          return (
            <div key={item} className="book-ready-line">
              <span>{index + 1}.</span>
              <TypewriterText as="strong" text={item} active={active} instant={!animate} delay={itemDelay} speed={38} />
            </div>
          )
        })}
      </div>

      {focus && (
        <TypewriterText className="book-focus-note" as="p" text={focus} active={active} instant={!animate} delay={focusDelay} speed={38} />
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
  instant = false,
  delay = 0,
  speed = TYPE_SPEED,
  as = "span",
  className,
}: {
  text: string
  active: boolean
  instant?: boolean
  delay?: number
  speed?: number
  as?: ElementType
  className?: string
}) {
  return (
    <RichTypewriterText
      segments={[{ text }]}
      active={active}
      instant={instant}
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
  instant = false,
  delay = 0,
  speed = TYPE_SPEED,
  as: Tag = "span",
  className,
}: {
  segments: TypewriterSegment[]
  active: boolean
  instant?: boolean
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

    if (instant || prefersReducedMotion()) {
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
  }, [active, delay, fullText, instant, speed])

  let offset = 0
  let cursorPlaced = false
  const isTyping = active && !instant && visibleCharacters > 0 && visibleCharacters < fullText.length

  // Keep every complete word in the DOM at its final width from the first frame.
  // Only the letters change visibility. This prevents a partly typed word such as
  // “gets” from briefly fitting on one line and then jumping to the next.
  const rendered = segments.flatMap((segment, segmentIndex) => {
    const tokens = segment.text.match(/\s+|[^\s]+/g) ?? []

    return tokens.map((token, tokenIndex) => {
      const start = offset
      const end = start + token.length
      offset = end
      const key = `${segmentIndex}-${tokenIndex}`

      if (/^\s+$/.test(token)) {
        const cursorBelongsHere = isTyping && !cursorPlaced && visibleCharacters >= start && visibleCharacters <= end
        if (cursorBelongsHere) cursorPlaced = true
        return (
          <span key={key}>
            {token}
            {cursorBelongsHere && <span className="book-typewriter-cursor" aria-hidden="true" />}
          </span>
        )
      }

      const visibleAmount = Math.max(0, Math.min(token.length, visibleCharacters - start))
      const visible = token.slice(0, visibleAmount)
      const pending = token.slice(visibleAmount)
      const cursorBelongsHere = isTyping && !cursorPlaced && visibleCharacters >= start && visibleCharacters <= end
      if (cursorBelongsHere) cursorPlaced = true

      const word = (
        <span className="book-typewriter-word">
          {visible}
          {cursorBelongsHere && <span className="book-typewriter-cursor" aria-hidden="true" />}
          {pending && <span className="book-typewriter-pending" aria-hidden="true">{pending}</span>}
        </span>
      )

      return segment.strong
        ? <strong key={key}>{word}</strong>
        : <span key={key}>{word}</span>
    })
  })

  return (
    <Tag className={className} aria-label={fullText}>
      {rendered}
    </Tag>
  )
}

function useRevealAfter(active: boolean, delay: number, instant = false) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }

    if (instant || prefersReducedMotion()) {
      setVisible(true)
      return
    }

    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [active, delay, instant])

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
      const settings = kind === "selection"
        ? { frequency: 235, end: 205, duration: 0.055, volume: 0.026 }
        : kind === "action"
          ? { frequency: 285, end: 245, duration: 0.07, volume: 0.03 }
          : kind === "back"
            ? { frequency: 145, end: 126, duration: 0.062, volume: 0.021 }
            : { frequency: 165, end: 142, duration: 0.068, volume: 0.023 }

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(settings.frequency, now)
      oscillator.frequency.exponentialRampToValueAtTime(settings.end, now + settings.duration)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(settings.volume, now + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration)

      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + settings.duration + 0.008)
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

