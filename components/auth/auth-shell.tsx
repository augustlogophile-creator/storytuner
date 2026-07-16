import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { Weaver } from "@/components/weaver"

export function AuthShell({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string
  title: string
  copy: string
  children: ReactNode
}) {
  return (
    <main className="entry-shell">
      <section className="auth-canvas">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-full px-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Introduction
            </Link>
            <Weaver colorId="classic" size={68} />
          </div>

          <div className="mt-8 sm:mt-9">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.17em] text-muted-foreground">{eyebrow}</p>
            <h1 className="mt-3 text-[2rem] font-semibold leading-[1.08] tracking-[-0.045em] text-balance sm:text-[2.25rem]">{title}</h1>
            <p className="mt-4 text-[0.95rem] leading-7 text-muted-foreground text-pretty">{copy}</p>
          </div>

          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  )
}
