"use client"

import type { ReactNode } from "react"
import { useEffect, useLayoutEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"

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
  const mainRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const main = mainRef.current
    if (!main) return
    main.scrollTop = 0
    main.scrollLeft = 0
    // Some mobile browsers restore a nested scroll container one frame after
    // navigation. Re-assert the route's canonical starting position once.
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
      className={`app-shell book-app mx-auto flex w-full min-w-0 flex-col overflow-x-clip bg-background ${wide ? "max-w-3xl" : "max-w-md"} ${fitViewport ? "h-svh overflow-hidden" : "min-h-screen"}`}
    >
      <main
        ref={mainRef}
        data-app-scroll-root="true"
        className={`app-content-reveal book-app-content w-full min-w-0 flex-1 overflow-x-clip px-5 pt-6 ${nav ? (fitViewport ? "pb-[4.8rem]" : "pb-28") : "pb-10"} ${fitViewport ? `min-h-0 ${scrollable ? "overflow-y-auto overscroll-y-none [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] [overflow-anchor:none]" : "overflow-y-hidden"}` : ""}`}
      >
        {children}
      </main>
      {nav && <BottomNav />}
    </div>
  )
}
