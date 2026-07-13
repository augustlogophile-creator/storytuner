import type { ReactNode } from "react"
import Link from "next/link"
import { Weaver } from "@/components/weaver"

export function AuthShell({ eyebrow, title, copy, children }: { eyebrow: string; title: string; copy: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:flex sm:items-center sm:justify-center sm:py-12">
      <section className="mx-auto w-full max-w-md">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <Weaver size={38} />
          StoryTuner
        </Link>
        <div className="mb-6">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">{copy}</p>
        </div>
        <div className="flex justify-center">{children}</div>
      </section>
    </main>
  )
}
