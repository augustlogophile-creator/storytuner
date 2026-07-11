import type { ReactNode } from "react"
import { BottomNav } from "@/components/bottom-nav"

export function MobileShell({ children, nav = true, wide = false }: { children: ReactNode; nav?: boolean; wide?: boolean }) {
  return (
    <div className={`mx-auto flex min-h-screen w-full min-w-0 flex-col overflow-x-clip bg-background ${wide ? "max-w-3xl" : "max-w-md"}`}>
      <main className={`w-full min-w-0 flex-1 overflow-x-clip px-5 pt-6 ${nav ? "pb-28" : "pb-10"}`}>{children}</main>
      {nav && <BottomNav />}
    </div>
  )
}
