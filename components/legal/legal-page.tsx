import type { ReactNode } from "react"
import { BackLink } from "@/components/page-header"

export function LegalPage({
  eyebrow,
  title,
  summary,
  children,
  backHref = "/",
  backLabel = "Tellwise",
}: {
  eyebrow: string
  title: string
  summary: string
  children: ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <main className="book-app legal-page mx-auto min-h-svh w-full max-w-md bg-background px-5 py-[max(1.5rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] text-foreground">
      <article className="mx-auto w-full">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <BackLink href={backHref} label={backLabel} />
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">Public document</span>
        </div>

        <header className="border-b border-border pb-6">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[#8e6849]">{eyebrow}</p>
          <h1 className="mt-2.5 text-[clamp(1.8rem,7vw,2.55rem)] leading-[1.02] tracking-[-0.03em]">{title}</h1>
          <p className="mt-3 max-w-xl text-[0.9rem] leading-6 text-muted-foreground">{summary}</p>
          <p className="mt-3 text-[0.7rem] text-muted-foreground">Last updated August 14, 2026</p>
        </header>

        <div className="legal-copy py-7">
          {children}
        </div>

        <footer className="mt-4 border-t border-border pt-6 text-[0.86rem] text-muted-foreground">
          <p>Questions or requests: <a className="underline underline-offset-4" href="mailto:tellwiseapp@gmail.com">tellwiseapp@gmail.com</a></p>
        </footer>
      </article>
    </main>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border py-5 last:border-b-0">
      <h2 className="text-[1.18rem] leading-tight">{title}</h2>
      <div className="mt-2.5 space-y-3 text-[0.88rem] leading-6 text-muted-foreground">{children}</div>
    </section>
  )
}
