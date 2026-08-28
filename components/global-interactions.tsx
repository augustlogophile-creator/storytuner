"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  "[role='button']",
  "[role='switch']",
  "input[type='checkbox']",
  "input[type='radio']",
  "select",
].join(",")

const LEGACY_FLOW_SELECTOR = ".intro-flow-canvas, .entry-shell"

function replayClass(element: HTMLElement | null, className: string, duration: number) {
  if (!element) return
  element.classList.remove(className)
  void element.offsetWidth
  element.classList.add(className)
  window.setTimeout(() => element.classList.remove(className), duration)
}

export function GlobalInteractions() {
  const pathname = usePathname()

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    if (document.querySelector(LEGACY_FLOW_SELECTOR)) return
    const content = document.querySelector<HTMLElement>("[data-app-scroll-root='true']")
    replayClass(content, "tellwise-route-enter", 170)
  }, [pathname])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === "mouse" && event.button !== 0) return
      if (!(event.target instanceof Element)) return

      const interactive = event.target.closest<HTMLElement>(INTERACTIVE_SELECTOR)
      if (!interactive) return
      if (interactive.matches(":disabled") || interactive.getAttribute("aria-disabled") === "true") return
      if (interactive.dataset.noGlobalTap === "true" || interactive.closest(LEGACY_FLOW_SELECTOR)) return

      // Keep the global response nearly imperceptible. No bloom, bounce, icon
      // kick, selection pop, or surface jump. The tiny press simply makes taps
      // feel finished without drawing attention to the animation itself.
      replayClass(interactive, "tellwise-subtle-press", 120)
    }

    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true })
    return () => document.removeEventListener("pointerdown", onPointerDown, true)
  }, [])

  return null
}
