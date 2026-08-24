"use client"

import { useEffect } from "react"

const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  "[role='button']",
  "[role='switch']",
  "input[type='checkbox']",
  "input[type='radio']",
  "select",
].join(",")

export function GlobalInteractions() {
  useEffect(() => {
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")

    function tap(target: EventTarget | null) {
      if (!(target instanceof Element)) return
      const interactive = target.closest<HTMLElement>(INTERACTIVE_SELECTOR)
      if (!interactive || interactive.matches(":disabled") || interactive.getAttribute("aria-disabled") === "true" || interactive.dataset.noGlobalTap === "true") return

      interactive.classList.remove("tellwise-tap")
      void interactive.offsetWidth
      interactive.classList.add("tellwise-tap")
      window.setTimeout(() => interactive.classList.remove("tellwise-tap"), 240)

      if (coarsePointer?.matches && "vibrate" in navigator) {
        try { navigator.vibrate(interactive.dataset.haptic === "strong" ? 12 : 6) } catch {}
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return
      tap(event.target)
    }

    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true })
    return () => document.removeEventListener("pointerdown", onPointerDown, true)
  }, [])

  return null
}
