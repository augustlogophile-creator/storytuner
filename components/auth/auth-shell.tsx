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
    <main className="min-h-screen bg-background px-5 py-6 sm:flex sm:items-center sm:justify-center sm:py-10">
      <section className="mx-auto w-full max-w-sm rounded-[2rem] border border-border bg-card p-5 shadow-xl sm:p-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Introduction
          </Link>
          <Weaver size={60} />
        </div>
        <p className="mt-5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">{copy}</p>
        <div className="mt-6">{children}</div>
      </section>
    </main>
  )
}
