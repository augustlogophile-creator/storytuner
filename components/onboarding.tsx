"use client"

import Link from "next/link"
import { useEffect, useState, type ChangeEvent } from "react"
import { ArrowLeft, ArrowRight, BookOpen, LockKeyhole, Mic2, ShieldCheck } from "lucide-react"
import { useApp } from "@/lib/app-state"
import { Weaver } from "@/components/weaver"

const pages = [
  {
    title: "Learn the craft, one decision at a time.",
    copy: "StoryTuner turns a complete storytelling course into short readings, focused drills, and checks that build on each other.",
    icon: BookOpen,
  },
  {
    title: "Practice the way stories are actually told.",
    copy: "Use the Arena to record a real take, review the transcript, and get specific feedback on your hook, development, and landing.",
    icon: Mic2,
  },
  {
    title: "Your recordings stay private by default.",
    copy: "Community is included with Membership, and a story only appears there when you deliberately share it. You can remove your recordings and posts at any time.",
    icon: LockKeyhole,
  },
  {
    title: "Save your progress",
    copy: "Create a secure account for your StoryTuner profile. Your current lessons, recordings, and XP still stay on this device for now.",
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
        <header className="flex items-center justify-between px-6 pt-[max(1.35rem,env(safe-area-inset-top))] sm:px-10 sm:pt-9">
          <p className="text-sm font-semibold tracking-[-0.01em] text-foreground">StoryTuner</p>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.15em] text-muted-foreground">
            {page + 1} of {pages.length}
          </p>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-8 sm:px-12 sm:py-12">
          <div className="w-full max-w-md text-center">
            <div className="flex min-h-28 items-center justify-center sm:min-h-32">
              {page === 0 ? (
                <Weaver colorId="classic" size={112} />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-brand/15 bg-brand-soft text-accent-foreground shadow-[0_12px_32px_rgba(21,93,183,0.10)]">
                  <Icon className="h-7 w-7" strokeWidth={1.8} />
                </span>
              )}
            </div>

            <p className="mt-5 font-mono text-[0.64rem] uppercase tracking-[0.18em] text-muted-foreground">Welcome to StoryTuner</p>
            <h1 className="mx-auto mt-3 max-w-sm text-[2rem] font-semibold leading-[1.08] tracking-[-0.045em] text-balance sm:text-[2.35rem]">
              {item.title}
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-[0.95rem] leading-7 text-muted-foreground text-pretty sm:text-base">
              {item.copy}
            </p>

            {page === 0 && (
              <label className="mx-auto mt-7 block max-w-sm text-left">
                <span className="font-mono text-[0.61rem] uppercase tracking-[0.15em] text-muted-foreground">What should we call you?</span>
                <input
                  value={name}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value.slice(0, 40))}
                  placeholder="Your first name or nickname"
                  autoComplete="name"
                  autoFocus
                  className="mt-2.5 w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-sm shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] outline-none transition placeholder:text-muted-foreground/65 focus:border-brand focus:ring-4 focus:ring-brand/10"
                />
              </label>
            )}
          </div>
        </div>

        <footer className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-10 sm:pb-9">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-5 flex gap-1.5" aria-label={`Introduction step ${page + 1} of ${pages.length}`}>
              {pages.map((_, index) => (
                <span
                  key={index}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${index <= page ? "bg-brand" : "bg-secondary"}`}
                />
              ))}
            </div>

            {accountStep ? (
              <div className="space-y-3">
                <Link href="/sign-up" className="intro-primary-button">
                  Sign up
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/sign-in" className="font-semibold text-accent-foreground hover:underline">Log in</Link>
                </p>
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

            {page > 0 && (
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                className="mx-auto mt-4 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
          </div>
        </footer>
      </section>
    </main>
  )
}
