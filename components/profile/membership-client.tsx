"use client"

import { Check } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { useApp } from "@/lib/app-state"

const rows = [
  ["Complete 14-unit course and capstone", "Included", "Included"],
  ["Private Story Reel", "Included", "Included"],
  ["Arena recordings per day", "1", "Unlimited"],
  ["Prompt tracks", "Personal story", "All tracks"],
  ["Community browsing and reactions", "Included", "Included"],
  ["Community sharing", "Transcript", "Video, audio, or transcript"],
  ["Community comments", "Read only", "Included"],
]

export function MembershipClient() {
  const { state, setPremium } = useApp()

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/profile" label="Profile" />
      <header className="text-center">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Membership</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">More practice, not a broken free product.</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The complete curriculum, streaks, and private Story Reel remain available on the free plan.
        </p>
      </header>

      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th className="pb-3">Feature</th>
                <th className="pb-3 text-center">Free</th>
                <th className="pb-3 text-center">Plus</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[0]} className="border-t border-border">
                  <td className="py-3 pr-2 font-medium">{row[0]}</td>
                  <td className="px-2 py-3 text-center text-muted-foreground">{row[1]}</td>
                  <td className="py-3 pl-2 text-center font-semibold">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl bg-primary p-5 text-primary-foreground">
        <h2 className="text-lg font-semibold">StoryTuner Plus</h2>
        <div className="mt-4 space-y-2">
          {["Unlimited Arena takes", "Every specialized prompt track", "Video and audio Community posts", "Community commenting"].map((item) => (
            <p key={item} className="flex items-center gap-2 text-sm text-primary-foreground/80">
              <Check className="h-4 w-4 text-brand" />
              {item}
            </p>
          ))}
        </div>
        {state.premium ? (
          <>
            <p className="mt-5 rounded-2xl bg-white/10 p-4 text-sm">Plus is active in this demo build. No payment has been processed.</p>
            <button type="button" onClick={() => setPremium(false)} className="mt-4 w-full rounded-full bg-background px-5 py-3 text-sm font-semibold text-foreground">
              Return to free
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setPremium(true)} className="mt-5 w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground">
              Activate Plus demo
            </button>
            <p className="mt-3 text-center text-xs text-primary-foreground/55">This project does not process payments. Connect a billing provider before launch.</p>
          </>
        )}
      </section>
    </div>
  )
}
