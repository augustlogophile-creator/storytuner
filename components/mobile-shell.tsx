import type { ReactNode } from "react"
import { BottomNav } from "@/components/bottom-nav"

export function MobileShell({ children, nav = true, wide = false }: { children: ReactNode; nav?: boolean; wide?: boolean }) {
  return (
    <div className={`app-shell mx-auto flex min-h-screen w-full min-w-0 flex-col overflow-x-clip bg-background ${wide ? "max-w-4xl" : "max-w-2xl"}`}>
      <main className={`app-page-enter w-full min-w-0 flex-1 overflow-x-clip px-5 pt-6 sm:px-8 sm:pt-8 ${nav ? "pb-28 sm:pb-32" : "pb-10 sm:pb-14"}`}>{children}</main>
      {nav && <BottomNav />}
    </div>
  )
}
