"use client"

import { useEffect, useState, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check } from "lucide-react"
import { Weaver } from "@/components/weaver"
import { useApp } from "@/lib/app-state"

export function AccountSetup() {
  const router = useRouter()
  const { state, ready, completeOnboarding } = useApp()
  const [name, setName] = useState("")

  useEffect(() => {
    if (!ready) return
    setName(state.profile.name === "Storyteller" ? "" : state.profile.name)
  }, [ready, state.profile.name])

  function finish() {
    const clean = name.trim()
    if (!clean) return
    completeOnboarding(clean)
    router.replace("/home")
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:flex sm:items-center sm:justify-center">
      <section className="mx-auto w-full max-w-sm rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <div className="flex justify-center"><Weaver size={82} /></div>
        <span className="mx-auto mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-accent-foreground"><Check className="h-5 w-5" /></span>
        <p className="mt-5 text-center font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Account created</p>
        <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight">Your StoryTuner account is ready.</h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">Confirm what StoryTuner should call you, then enter the app.</p>
        <label className="mt-6 block">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">Display name</span>
          <input
            value={name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value.slice(0, 40))}
            placeholder="Your first name or nickname"
            autoComplete="name"
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand"
          />
        </label>
        <button
          type="button"
          disabled={!ready || !name.trim()}
          onClick={finish}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
        >
          Enter StoryTuner
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    </main>
  )
}
