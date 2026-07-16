"use client"

import Link from "next/link"
import { useEffect, useState, type ChangeEvent } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useApp } from "@/lib/app-state"
import { WeaverEmotion, type WeaverEmotionName } from "@/components/weaver-emotion"

type IntroPage = {
  eyebrow: string
  title: string
  copy: string
  emotion: WeaverEmotionName
}

const pages: IntroPage[] = [
  {
    eyebrow: "Your personal story coach",
    title: "Learn the craft, one decision at a time.",
    copy: "StoryTuner turns a complete storytelling course into short readings, focused drills, and checks that build on each other.",
    emotion: "welcome",
  },
  {
    eyebrow: "Practice out loud",
    title: "Practice the way stories are actually told.",
    copy: "Use the Arena to record a real take, review a clean transcript, and get specific feedback on your hook, development, delivery, and landing.",
    emotion: "excited",
  },
  {
    eyebrow: "Private by default",
    title: "Your recordings stay yours.",
    copy: "A story only appears in Community when you deliberately share it. You can remove your recordings and posts whenever you choose.",
    emotion: "reassure",
  },
  {
    eyebrow: "Save your progress",
    title: "Build a craft that keeps getting stronger.",
    copy: "Create a secure account for your StoryTuner profile. Weaver can coach one story or your broader craft. Lesson progress and recordings remain on this device for now.",
    emotion: "celebrate",
  },
]

export function Onboarding() {
  const { state, ready, updateProfileName } = useApp()
  const [screen, setScreen] = useState<"landing" | "intro">("landing")
  const [page, setPage] = useState(0)
  const [name, setName] = useState("")

  useEffect(() => {
    if (!ready) return
    setName(state.profile.name === "Storyteller" ? "" : state.profile.name)
    if (state.onboardingComplete) {
      setScreen("intro")
      setPage(pages.length - 1)
    }
  }, [ready, state.onboardingComplete, state.profile.name])

  const item = pages[page]
  const accountStep = page === pages.length - 1
  const nameStep = page === 0

  function continueIntro() {
    if (nameStep) {
      const clean = name.trim()
      if (!clean) return
      updateProfileName(clean)
    }
    setPage((value) => Math.min(value + 1, pages.length - 1))
  }

  if (screen === "landing") {
    return (
      <main className="intro-shell">
        <section className="intro-canvas intro-landing">
          <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-10 text-center">
            <WeaverEmotion emotion="welcome" size={190} />
            <p className="mt-6 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">Storytelling, tuned</p>
            <h1 className="mt-2 text-[2.55rem] font-semibold tracking-[-0.055em] text-foreground">StoryTuner</h1>
            <p className="mt-3 max-w-xs text-base leading-relaxed text-muted-foreground">
              Learn to shape true stories, tell them with confidence, and understand exactly what to improve next.
            </p>
          </div>
          <div className="w-full space-y-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-7 sm:pb-7">
            <button type="button" onClick={() => setScreen("intro")} className="intro-primary-button">
              Get started <ArrowRight className="h-4 w-4" />
            </button>
            <Link href="/sign-in" className="intro-secondary-button">I already have an account</Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="intro-shell">
      <section className="intro-canvas">
        <div className="flex items-center gap-3 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-7 sm:pt-7">
          <button
            type="button"
            onClick={() => {
              if (page === 0) setScreen("landing")
              else setPage((value) => Math.max(0, value - 1))
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-1 gap-1.5" aria-label={`Introduction step ${page + 1} of ${pages.length}`}>
            {pages.map((_, index) => (
              <span key={index} className={`h-2 flex-1 rounded-full transition-colors ${index <= page ? "bg-brand" : "bg-secondary"}`} />
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-5 py-6 sm:px-8">
          <div className="relative mb-4 w-full max-w-sm rounded-2xl border border-border bg-card px-5 py-4 text-center shadow-[0_10px_30px_rgba(39,35,31,0.06)] after:absolute after:-bottom-2 after:left-1/2 after:h-4 after:w-4 after:-translate-x-1/2 after:rotate-45 after:border-b after:border-r after:border-border after:bg-card">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">{item.eyebrow}</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-balance">{item.title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{item.copy}</p>
          </div>

          <WeaverEmotion emotion={item.emotion} size={page === 3 ? 184 : 174} />

          {nameStep && (
            <label className="mt-5 block w-full max-w-sm">
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">What should we call you?</span>
              <input
                value={name}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value.slice(0, 40))}
                placeholder="Your first name or nickname"
                autoComplete="name"
                className="mt-2 w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </label>
          )}
        </div>

        <div className="w-full px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-7 sm:pb-7">
          {accountStep ? (
            <div className="space-y-3">
              <Link href="/sign-up" className="intro-primary-button">Sign up <ArrowRight className="h-4 w-4" /></Link>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account? <Link href="/sign-in" className="font-semibold text-brand hover:underline">Log in</Link>
              </p>
            </div>
          ) : (
            <button
              type="button"
              disabled={!ready || (nameStep && !name.trim())}
              onClick={continueIntro}
              className="intro-primary-button disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
