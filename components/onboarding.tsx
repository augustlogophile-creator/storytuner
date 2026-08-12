"use client"

import Link from "next/link"
import { useEffect, useState, type ChangeEvent } from "react"
import { ArrowLeft, ArrowRight, BookOpen, LockKeyhole, Mic2, ShieldCheck } from "lucide-react"
import { useApp } from "@/lib/app-state"
import { Weaver } from "@/components/weaver"

const pages = [
  {
    eyebrow: "Learn",
    title: "Build the instincts behind a great story.",
    copy: "Move through short lessons, quick checks, and focused practice that teach you what to notice when you tell a story out loud.",
    icon: BookOpen,
  },
  {
    eyebrow: "Practice",
    title: "Tell it out loud. Then make the next take better.",
    copy: "Record a real take in the Arena and get focused feedback on your opening, development, clarity, and landing.",
    icon: Mic2,
  },
  {
    eyebrow: "Private by default",
    title: "Your stories stay yours until you choose to share.",
    copy: "Recordings are private by default. Community posts only appear when you deliberately share them, and you can remove your data whenever you want.",
    icon: LockKeyhole,
  },
  {
    eyebrow: "Save your progress",
    title: "Keep your StoryTuner progress with you.",
    copy: "Create a secure account to sync your lessons, XP, settings, and StoryTuner progress across devices.",
    icon: ShieldCheck,
  },
]

export function Onboarding() {
  const { state, ready, updateProfileName } = useApp()
  const [page, setPage] = useState(0)
  const [name, setName] = useState("")

  useEffect(() => {
    if (!ready) return
    setName(state.profile.name === "Storyteller" ? "" : state.profile.name)
    if (state.onboardingComplete) setPage(pages.length - 1)
  }, [ready, state.onboardingComplete, state.profile.name])

  const item = pages[page]
  const Icon = item.icon
  const accountStep = page === pages.length - 1

  function continueIntro() {
    if (page === 0) {
      const clean = name.trim()
      if (!clean) return
      updateProfileName(clean)
    }
    setPage((value) => Math.min(value + 1, pages.length - 1))
  }

  return (
    <main className="entry-shell">
      <section className="intro-canvas" aria-label="StoryTuner introduction">
        <header className="intro-header">
          <button
            type="button"
            aria-label="Go back"
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            className="intro-back-button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="text-[0.92rem] font-semibold tracking-[-0.02em] text-foreground">StoryTuner</p>
          <p className="text-[0.72rem] font-medium tabular-nums text-muted-foreground">{page + 1} / {pages.length}</p>
        </header>

        <div className="intro-content">
          <div className="w-full">
            <div className="intro-visual" aria-hidden="true">
              {page === 0 ? (
                <Weaver colorId="classic" size={108} />
              ) : (
                <span className="intro-icon-tile">
                  <Icon className="h-6 w-6" strokeWidth={1.9} />
                </span>
              )}
            </div>

            <div className="mt-7 text-center">
              <p className="text-[0.73rem] font-semibold uppercase tracking-[0.12em] text-brand">{item.eyebrow}</p>
              <h1 className="mx-auto mt-2.5 max-w-[21rem] text-[1.92rem] font-semibold leading-[1.08] tracking-[-0.045em] text-balance">
                {item.title}
              </h1>
              <p className="mx-auto mt-3.5 max-w-[20.5rem] text-[0.94rem] leading-[1.55rem] text-muted-foreground text-pretty">
                {item.copy}
              </p>
            </div>

            {page === 0 && (
              <label className="mx-auto mt-6 block max-w-[20.5rem] text-left">
                <span className="text-[0.75rem] font-semibold text-foreground">What should we call you?</span>
                <input
                  value={name}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value.slice(0, 40))}
                  placeholder="First name or nickname"
                  autoComplete="name"
                  autoFocus
                  className="intro-name-input"
                />
              </label>
            )}
          </div>
        </div>

        <footer className="intro-footer">
          <div className="intro-progress" aria-label={`Introduction step ${page + 1} of ${pages.length}`}>
            {pages.map((_, index) => (
              <span key={index} className={index <= page ? "is-active" : ""} />
            ))}
          </div>

          {accountStep ? (
            <div className="space-y-2.5">
              <Link href="/sign-up" className="intro-primary-button">
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/sign-up?mode=sign-in" className="intro-secondary-button">
                I already have an account
              </Link>
            </div>
          ) : (
            <button
              type="button"
              disabled={!ready || (page === 0 && !name.trim())}
              onClick={continueIntro}
              className="intro-primary-button disabled:cursor-not-allowed disabled:opacity-35"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </footer>
      </section>
    </main>
  )
}
