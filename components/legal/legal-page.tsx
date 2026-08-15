import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

export function LegalPage({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string
  title: string
  summary: string
  children: ReactNode
}) {
  return (
    <main className="book-app min-h-svh bg-background px-5 py-[max(1.5rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] text-foreground">
      <article className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            StoryTuner
          </Link>
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">Public document</span>
        </div>

        <header className="border-b border-border pb-7">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-[#8e6849]">{eyebrow}</p>
          <h1 className="mt-3 text-[clamp(2.2rem,9vw,4rem)] leading-[0.98] tracking-[-0.035em]">{title}</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{summary}</p>
          <p className="mt-3 text-xs text-muted-foreground">Last updated August 14, 2026</p>
        </header>

        <div className="legal-copy py-7">
          {children}
        </div>

        <footer className="mt-4 border-t border-border pt-6 text-sm text-muted-foreground">
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>
            <Link href="/terms" className="underline underline-offset-4">Terms</Link>
            <Link href="/accessibility" className="underline underline-offset-4">Accessibility</Link>
            <Link href="/community-guidelines" className="underline underline-offset-4">Community Guidelines</Link>
            <Link href="/delete-account" className="underline underline-offset-4">Delete account</Link>
          </div>
          <p className="mt-5">Questions or requests: <a className="underline underline-offset-4" href="mailto:storytunerapp@gmail.com">storytunerapp@gmail.com</a></p>
        </footer>
      </article>
    </main>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border py-6 last:border-b-0">
      <h2 className="text-2xl leading-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[0.98rem] leading-7 text-muted-foreground">{children}</div>
    </section>
  )
}
