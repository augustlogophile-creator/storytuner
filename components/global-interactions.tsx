"use client"

import { useEffect, useRef } from "react"
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

const SURFACE_SELECTOR = [
  ".story-card-interactive",
  ".story-card",
  ".journal-row",
  ".planner-field-card",
  ".membership-plan-choice",
  ".book-choice",
  ".home-library-book",
  "section[class*='rounded'][class*='border']",
  "article[class*='rounded'][class*='border']",
].join(",")

const REVEAL_SELECTOR = [
  ".story-card-interactive",
  ".story-card",
  ".journal-row",
  ".planner-field-card",
  ".membership-plan-choice",
  ".home-library-book",
  ".progress-streak-card",
  ".studio-review-card",
  ".studio-transcript-card",
].join(",")

const SELECTED_SELECTOR = [
  "[data-selected='true']",
  "[aria-selected='true']",
  "[aria-pressed='true']",
  "[role='switch'][aria-checked='true']",
  "label:has(input[type='checkbox']:checked)",
  "label:has(input[type='radio']:checked)",
].join(",")

function replayClass(element: HTMLElement | null, className: string, duration: number) {
  if (!element) return
  element.classList.remove(className)
  void element.offsetWidth
  element.classList.add(className)
  window.setTimeout(() => element.classList.remove(className), duration)
}

export function GlobalInteractions() {
  const pathname = usePathname()
  const bloomRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const content = document.querySelector<HTMLElement>("[data-app-scroll-root='true']")
    if (!content || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    replayClass(content, "tellwise-route-enter", 320)
  }, [pathname])

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return

    let revealIndex = 0
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue
        entry.target.classList.add("tellwise-reveal-in")
        observer.unobserve(entry.target)
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -3% 0px" })

    const observeWithin = (root: ParentNode) => {
      const candidates = root instanceof HTMLElement && root.matches(REVEAL_SELECTOR)
        ? [root]
        : Array.from(root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR))
      for (const element of candidates) {
        if (element.dataset.tellwiseRevealObserved === "true") continue
        element.dataset.tellwiseRevealObserved = "true"
        element.style.setProperty("--tellwise-reveal-delay", `${Math.min(revealIndex % 4, 3) * 34}ms`)
        revealIndex += 1
        observer.observe(element)
      }
    }

    observeWithin(document)
    const mutationObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement) observeWithin(node)
        }
      }
    })
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      mutationObserver.disconnect()
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")

    function showBloom(event: PointerEvent, interactive: HTMLElement) {
      if (reducedMotion?.matches || interactive.matches("select")) return
      const bloom = bloomRef.current
      if (!bloom) return
      bloom.style.left = `${event.clientX}px`
      bloom.style.top = `${event.clientY}px`
      bloom.classList.remove("is-active")
      void bloom.offsetWidth
      bloom.classList.add("is-active")
    }

    function tap(event: PointerEvent) {
      if (!(event.target instanceof Element)) return
      const interactive = event.target.closest<HTMLElement>(INTERACTIVE_SELECTOR)
      if (!interactive || interactive.matches(":disabled") || interactive.getAttribute("aria-disabled") === "true" || interactive.dataset.noGlobalTap === "true") return

      replayClass(interactive, "tellwise-tap", 280)
      replayClass(interactive.closest<HTMLElement>(SURFACE_SELECTOR), "tellwise-surface-tap", 300)
      showBloom(event, interactive)

      if (coarsePointer?.matches && "vibrate" in navigator) {
        try { navigator.vibrate(interactive.dataset.haptic === "strong" ? 12 : 6) } catch {}
      }
    }

    function celebrateSelection(target: EventTarget | null) {
      if (!(target instanceof Element)) return
      window.setTimeout(() => {
        const interactive = target.closest<HTMLElement>(INTERACTIVE_SELECTOR)
        const selected = target.closest<HTMLElement>(SELECTED_SELECTOR)
          ?? interactive?.closest<HTMLElement>(SELECTED_SELECTOR)
          ?? (interactive?.matches(SELECTED_SELECTOR) ? interactive : null)
        replayClass(selected, "tellwise-choice-pop", 360)
      }, 0)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return
      tap(event)
    }
    const onClick = (event: MouseEvent) => celebrateSelection(event.target)
    const onChange = (event: Event) => celebrateSelection(event.target)

    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true })
    document.addEventListener("click", onClick, { capture: true, passive: true })
    document.addEventListener("change", onChange, { capture: true, passive: true })
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("change", onChange, true)
    }
  }, [])

  return <span ref={bloomRef} className="tellwise-tap-bloom" aria-hidden="true" />
}
