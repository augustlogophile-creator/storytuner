import Link from "next/link"
import type { ReactNode } from "react"
import { preload } from "react-dom"
import { ArrowLeft } from "lucide-react"
import { ParchReading } from "@/components/ui/parch-reading"

export function AuthShell({ children }: { children: ReactNode }) {
  preload("/parch-reading.mp4", { as: "video", type: "video/mp4" })

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
              <ParchReading />
            </div>
            <div className="auth-panel">{children}</div>
          </div>
        </div>
      </section>
    </main>
  )
}
