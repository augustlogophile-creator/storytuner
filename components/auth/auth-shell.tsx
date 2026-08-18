import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="entry-shell auth-entry-shell">
      <section className="auth-canvas auth-canvas-polished">
        <div className="auth-canvas-inner">
          <header className="auth-header-row">
            <Link prefetch href="/?introPage=4" className="auth-back-link">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
              <span>Introduction</span>
            </Link>
            <span className="auth-wordmark">Tellwise</span>
          </header>

          <div className="auth-content auth-content-polished">
            <div className="auth-stage" aria-hidden="true">
              <span className="auth-stage-paper" />
              <Image
                src="/parch-classic.png"
                alt=""
                width={294}
                height={244}
                priority
                className="auth-parch"
              />
            </div>
            <div className="auth-panel">{children}</div>
          </div>
        </div>
      </section>
    </main>
  )
}
