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
    copy: "Short lessons, quick checks, and focused practice teach you what to notice when you tell a story out loud.",
    icon: BookOpen,
  },
  {
    eyebrow: "Practice",
    title: "Tell it out loud. Then make the next take better.",
    copy: "Record a real take in Arena and get clear notes on what landed, what drifted, and what to sharpen next.",
    icon: Mic2,
  },
  {
    eyebrow: "Private by default",
    title: "Your stories stay yours.",
    copy: "Recordings stay private unless you deliberately share one with Community. You stay in control of what leaves your archive.",
    icon: LockKeyhole,
  },
  {
    eyebrow: "Keep your progress",
    title: "Come back exactly where you left off.",
    copy: "Create a secure account so your lessons, recordings, progress, and Weaver history follow you across devices.",
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
        <header className="flex items-center justify-between px-5 pt-[max(1.2rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
          <p className="text-[0.72rem] font-semibold tracking-[-0.015em] text-foreground">StoryTuner</p>
          <p className="text-[0.6rem] font-medium tabular-nums tracking-[0.08em] text-muted-foreground/70">
            {String(page + 1).padStart(2, "0")} / {String(pages.length).padStart(2, "0")}
          </p>
        </header>

        <div className="flex flex-1 items-center px-5 py-6 sm:px-6 sm:py-8">
          <div key={page} className="app-page-enter w-full">
            <div className="mb-5 flex h-14 items-center">
              {page === 0 ? (
                <Weaver colorId="classic" size={62} />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-brand/15 bg-brand-soft/70 text-accent-foreground">
                  <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.65} />
                </span>
              )}
            </div>

            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-brand">{item.eyebrow}</p>
            <h1 className="text-title mt-2.5 max-w-[21rem] text-[1.88rem] leading-[1.05] text-balance sm:text-[2rem]">
              {item.title}
            </h1>
            <p className="mt-3 max-w-[22rem] text-[0.84rem] leading-[1.65] text-muted-foreground text-pretty">
              {item.copy}
            </p>

            {page === 0 && (
              <label className="mt-6 block max-w-[22rem]">
                <span className="text-[0.58rem] font-medium text-muted-foreground">What should we call you?</span>
                <input
                  value={name}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value.slice(0, 40))}
                  placeholder="First name or nickname"
                  autoComplete="name"
                  autoFocus
                  className="mt-1.5 w-full border-0 border-b border-border bg-transparent px-0 py-2.5 text-[0.86rem] outline-none transition placeholder:text-muted-foreground/55 focus:border-brand"
                />
              </label>
            )}
          </div>
        </div>

        <footer className="px-5 pb-[max(1.35rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
          <div className="mb-4 grid grid-cols-4 gap-1.5" aria-label={`Introduction step ${page + 1} of ${pages.length}`}>
            {pages.map((_, index) => (
              <span
                key={index}
                className={`h-px rounded-full transition-colors duration-300 ${index <= page ? "bg-foreground/70" : "bg-border"}`}
              />
            ))}
          </div>

          {accountStep ? (
            <div className="space-y-2.5">
              <Link href="/sign-up" className="intro-primary-button">Create account</Link>
              <p className="text-center text-[0.72rem] text-muted-foreground">
                Already have one?{" "}
                <Link href="/sign-up?mode=sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">Log in</Link>
              </p>
            </div>
          ) : (
            <button
              type="button"
              disabled={!ready || (page === 0 && !name.trim())}
              onClick={continueIntro}
              className="intro-primary-button disabled:cursor-not-allowed disabled:opacity-30"
            >
              Continue
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          {page > 0 && (
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              className="mx-auto mt-3 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[0.7rem] font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
          )}
        </footer>
      </section>
    </main>
  )
}
