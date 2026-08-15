"use client"

import type { ReactNode } from "react"
import { useEffect, useLayoutEffect, useRef } from "react"
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
  const mainRef = useRef<HTMLElement>(null)
  const shouldScroll = scrollable || !fitViewport

  useLayoutEffect(() => {
    const main = mainRef.current
    if (!main) return

    // Every app route owns its own vertical scroll container. Clearing any
    // stale document lock here prevents a dismissed modal on the previous
    // route from leaving the next screen unable to scroll.
    document.body.style.removeProperty("overflow")
    document.documentElement.style.removeProperty("overflow")

    main.scrollTop = 0
    main.scrollLeft = 0
    const frame = window.requestAnimationFrame(() => {
      main.scrollTop = 0
      main.scrollLeft = 0
    })
    return () => window.cancelAnimationFrame(frame)
  }, [pathname])

  useEffect(() => {
    const resetAfterHistoryRestore = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      const main = mainRef.current
      if (!main) return
      main.scrollTop = 0
      main.scrollLeft = 0
    }
    window.addEventListener("pageshow", resetAfterHistoryRestore)
    return () => window.removeEventListener("pageshow", resetAfterHistoryRestore)
  }, [])

  return (
    <div
      className={`app-shell book-app mx-auto flex h-dvh min-h-dvh w-full min-w-0 flex-col overflow-hidden bg-background ${wide ? "max-w-3xl" : "max-w-md"}`}
    >
      <main
        ref={mainRef}
        data-app-scroll-root="true"
        aria-busy={!ready}
        style={{ visibility: ready ? "visible" : "hidden" }}
        className={`app-content-reveal book-app-content w-full min-w-0 flex-1 overflow-x-hidden px-5 pt-6 ${nav ? "pb-28" : "pb-10"} min-h-0 ${shouldScroll ? "overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]" : "overflow-y-hidden"}`}
      >
        {children}
      </main>
      {nav && <BottomNav />}
    </div>
  )
}
