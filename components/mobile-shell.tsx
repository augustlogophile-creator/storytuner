"use client"

import type { ReactNode } from "react"
import { useEffect, useLayoutEffect } from "react"
import { usePathname } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { useApp } from "@/lib/app-state"

export function MobileShell({
  children,
  nav = true,
  wide = false,
  fitViewport = false,
  scrollable = false,
}: {
  children: ReactNode
  nav?: boolean
  wide?: boolean
  fitViewport?: boolean
  scrollable?: boolean
}) {
  const pathname = usePathname()
  const { ready } = useApp()
  void wide
  void fitViewport
  void scrollable

  useLayoutEffect(() => {
    // StoryTuner uses native document scrolling. Clear any stale inline lock
    // left by an older build or an interrupted dialog, then reset the route.
    document.body.style.removeProperty("overflow")
    document.documentElement.style.removeProperty("overflow")
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [pathname])

  useEffect(() => {
    const resetAfterHistoryRestore = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      document.body.style.removeProperty("overflow")
      document.documentElement.style.removeProperty("overflow")
    }
    window.addEventListener("pageshow", resetAfterHistoryRestore)
    return () => window.removeEventListener("pageshow", resetAfterHistoryRestore)
  }, [])

  return (
    <div
      className="app-shell book-app mx-auto flex min-h-dvh w-full max-w-md min-w-0 flex-col bg-background"
    >
      <main
        data-app-scroll-root="true"
        aria-busy={!ready}
        style={{ visibility: ready ? "visible" : "hidden" }}
        className={`app-content-reveal book-app-content w-full min-w-0 flex-1 overflow-x-hidden px-5 pt-6 ${nav ? "pb-28" : "pb-10"}`}
      >
        {children}
      </main>
      {nav && <BottomNav />}
    </div>
  )
}
