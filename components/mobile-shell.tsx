import type { ReactNode } from "react"
import { BottomNav } from "@/components/bottom-nav"

export function MobileShell({ children, nav = true, wide = false }: { children: ReactNode; nav?: boolean; wide?: boolean }) {
  return (
    <div className={`app-shell mx-auto flex min-h-screen w-full min-w-0 flex-col overflow-x-clip bg-background ${wide ? "max-w-[28rem]" : "max-w-[25rem]"}`}>
      <main className={`app-page-enter w-full min-w-0 flex-1 overflow-x-clip px-4 pt-5 ${nav ? "pb-28" : "pb-10"}`}>{children}</main>
      {nav && <BottomNav />}
    </div>
  )
}
