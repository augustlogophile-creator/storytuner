import type { ReactNode } from "react"
import { BottomNav } from "@/components/bottom-nav"

export function MobileShell({
  children,
  nav = true,
  wide = false,
  fitViewport = false,
}: {
  children: ReactNode
  nav?: boolean
  wide?: boolean
  fitViewport?: boolean
}) {
  return (
    <div
      className={`app-shell mx-auto flex w-full min-w-0 flex-col overflow-x-clip bg-background ${wide ? "max-w-3xl" : "max-w-md"} ${fitViewport ? "h-svh overflow-hidden" : "min-h-screen"}`}
    >
      <main
        className={`app-content-reveal w-full min-w-0 flex-1 overflow-x-clip px-5 pt-6 ${nav ? (fitViewport ? "pb-[4.8rem]" : "pb-28") : "pb-10"} ${fitViewport ? "min-h-0 overflow-y-hidden" : ""}`}
      >
        {children}
      </main>
      {nav && <BottomNav />}
    </div>
  )
}
