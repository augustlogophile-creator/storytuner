"use client"

import { useState, type ChangeEvent } from "react"
import { ArrowRight, BookOpen, LockKeyhole, Mic2 } from "lucide-react"
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
]

export function Onboarding() {
  const { state, ready, completeOnboarding } = useApp()
  const [page, setPage] = useState(0)
  const [name, setName] = useState(state.profile.name === "Storyteller" ? "" : state.profile.name)
  if (!ready || state.onboardingComplete) return null
  const item = pages[page]
  const Icon = item.icon
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 p-3 backdrop-blur-sm sm:items-center">
      <section className="w-full max-w-md rounded-[2rem] border border-border bg-background p-6 shadow-2xl">
        {page === 0 ? (
          <div className="mb-5 flex justify-center">
            <Weaver size={106} />
          </div>
        ) : (
          <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-accent-foreground">
            <Icon className="h-6 w-6" />
          </span>
        )}
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
          Welcome to StoryTuner
        </p>
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
        <div className="mt-6 flex gap-1.5">
          {pages.map((_, index) => (
            <span key={index} className={`h-1.5 flex-1 rounded-full ${index <= page ? "bg-brand" : "bg-secondary"}`} />
          ))}
        </div>
        <button
          type="button"
          disabled={page === 0 && !name.trim()}
          onClick={() => (page === pages.length - 1 ? completeOnboarding(name) : setPage((value) => value + 1))}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {page === pages.length - 1 ? "Begin" : "Continue"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    </div>
  )
}
