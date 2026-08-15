import { Map } from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"

export default function PlannerLoading() {
  return (
    <div className="app-shell book-app mx-auto flex min-h-dvh w-full max-w-md min-w-0 flex-col bg-background">
      <main className="book-app-content w-full min-w-0 flex-1 overflow-x-hidden px-5 pb-28 pt-6">
        <div className="flex min-w-0 flex-col gap-7" aria-label="Loading Story Planner">
          <header className="rounded-[2rem] bg-primary p-6 text-primary-foreground">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
                <Map className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-primary-foreground/60">AI Story Planner</p>
                <h1 className="planner-hero-title mt-2 text-2xl font-semibold tracking-tight text-balance">Know where your story is going before you tell it.</h1>
                <div className="mt-4 space-y-2" aria-hidden="true">
                  <div className="h-3 w-full rounded-full bg-white/15" />
                  <div className="h-3 w-4/5 rounded-full bg-white/15" />
                </div>
              </div>
            </div>
          </header>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="h-3 w-24 rounded-full bg-secondary" />
                <div className="mt-3 h-7 w-4/5 rounded-xl bg-secondary" />
              </div>
              <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground">~3 min</span>
            </div>
            <div className="space-y-4" aria-hidden="true">
              <div className="h-52 rounded-3xl border border-border bg-card" />
              <div className="h-52 rounded-3xl border border-border bg-card" />
            </div>
          </section>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
