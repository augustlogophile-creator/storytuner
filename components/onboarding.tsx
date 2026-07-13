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
    copy: "Keep your lessons, feedback, recordings, and streak safe across devices.",
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
    <main className="min-h-screen bg-background px-5 py-6 sm:flex sm:items-center sm:justify-center sm:py-10">
      <section className="mx-auto w-full max-w-sm rounded-[1.9rem] border border-border bg-card p-5 shadow-xl sm:p-6">
        <div className="flex min-h-24 items-center justify-center">
          {page === 0 ? (
            <Weaver size={92} />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-accent-foreground"><Icon className="h-6 w-6" /></span>
          )}
        </div>
        <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Welcome to StoryTuner</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">{item.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">{item.copy}</p>

        {page === 0 && (
          <label className="mt-5 block">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">What should we call you?</span>
            <input
              value={name}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value.slice(0, 40))}
              placeholder="Your first name or nickname"
              autoComplete="name"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand"
            />
          </label>
        )}

        <div className="mt-6 flex gap-1.5" aria-label={`Introduction step ${page + 1} of ${pages.length}`}>
          {pages.map((_, index) => (
            <span key={index} className={`h-1.5 flex-1 rounded-full ${index <= page ? "bg-brand" : "bg-secondary"}`} />
          ))}
        </div>

        {accountStep ? (
          <div className="mt-6 space-y-3">
            <Link href="/sign-up" className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]">
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
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {page > 0 && (
          <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} className="mx-auto mt-4 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        )}
      </section>
    </main>
  )
}
