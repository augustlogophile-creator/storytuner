import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { Weaver } from "@/components/weaver"

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="entry-shell">
      <section className="auth-canvas">
        <div className="auth-canvas-inner">
          <header className="flex items-center justify-between">
            <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-full px-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Introduction
            </Link>
            <Weaver colorId="classic" size={56} />
          </header>
          <div className="auth-content">{children}</div>
        </div>
      </section>
    </main>
  )
}
