"use client"

import HTMLFlipBook from "react-pageflip"
import {
  Children,
  forwardRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { cn } from "@/lib/utils"

export type BookSliderHandle = {
  next: () => void
  previous: () => void
  goTo: (page: number) => void
}

export const BookPage = forwardRef<HTMLDivElement, {
  children: ReactNode
  cover?: boolean
  className?: string
}>(function BookPage({ children, cover = false, className }, ref) {
  return (
    <div
      ref={ref}
      className={cn("story-book-page-inner", cover && "story-book-cover-inner", className)}
      data-density={cover ? "hard" : "soft"}
      data-book-cover={cover ? "true" : "false"}
    >
      {children}
    </div>
  )
})

const BookSlider = forwardRef<BookSliderHandle, {
  children: ReactNode
  page: number
  onPageChange: (page: number) => void
  canGoNext?: boolean
  className?: string
  onTurn?: (direction: "next" | "previous") => void
  onPreparePage?: (page: number) => void
}>(function BookSlider({
  children,
  page,
  onPageChange,
  canGoNext = true,
  className,
  onTurn,
  onPreparePage,
}, forwardedRef) {
  const pages = useMemo(() => Children.toArray(children), [children])
  const bookRef = useRef<any>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const currentPageRef = useRef(page)
  const programmaticRef = useRef(false)
  const isFlippingRef = useRef(false)
  const requestedTargetRef = useRef<number | null>(null)
  const pendingTargetRef = useRef<number | null>(null)
  const flipFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFlipAtRef = useRef(0)
  const canGoNextRef = useRef(canGoNext)
  const [isFlipping, setIsFlippingState] = useState(false)
  const [bookSize, setBookSize] = useState({ width: 448, height: 800 })
  const lastPage = pages.length - 1

  useLayoutEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    const measure = () => {
      const rect = shell.getBoundingClientRect()
      const width = Math.max(1, Math.round(rect.width))
      const height = Math.max(1, Math.round(rect.height))
      setBookSize((current) => current.width === width && current.height === height ? current : { width, height })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(shell)
    window.addEventListener("orientationchange", measure)

    return () => {
      observer.disconnect()
      window.removeEventListener("orientationchange", measure)
    }
  }, [])

  useEffect(() => {
    currentPageRef.current = page
  }, [page])

  useEffect(() => {
    canGoNextRef.current = canGoNext
  }, [canGoNext])

  useEffect(() => () => {
    if (flipFallbackRef.current) clearTimeout(flipFallbackRef.current)
  }, [])

  function isInteractiveTarget(target: EventTarget | null) {
    return target instanceof Element
      && Boolean(target.closest("button, a, input, textarea, select, label, [data-book-no-turn='true']"))
  }

  function setFlipping(value: boolean) {
    isFlippingRef.current = value
    setIsFlippingState(value)
  }

  // Keep the page-flip library away from the left-quarter back zone, and
  // completely block forward page gestures while a required quiz answer is
  // missing. This runs in native capture phase so react-pageflip never gets a
  // chance to start a fold that the onboarding rules do not allow.
  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    let touchStart: { x: number; y: number; id: number | null; direction: "previous" | "next" } | null = null
    let mouseStart: { x: number; y: number; direction: "previous" | "next" } | null = null

    const ratioFor = (clientX: number) => {
      const rect = shell.getBoundingClientRect()
      return (clientX - rect.left) / Math.max(1, rect.width)
    }

    const stopNative = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    const onTouchStart = (event: TouchEvent) => {
      if (isInteractiveTarget(event.target)) return
      const touch = event.changedTouches[0]
      if (!touch) return

      const ratio = ratioFor(touch.clientX)
      if (ratio <= 0.25 && currentPageRef.current > 0) {
        touchStart = { x: touch.clientX, y: touch.clientY, id: touch.identifier, direction: "previous" }
        stopNative(event)
        return
      }

      if (!canGoNextRef.current && ratio > 0.25) {
        stopNative(event)
        return
      }

      // Remember a right-quarter press without cancelling react-pageflip. A
      // real drag still belongs to the library, while a short tap is completed
      // programmatically on touchend so it never takes a second tap.
      if (ratio >= 0.75 && currentPageRef.current < lastPage) {
        touchStart = { x: touch.clientX, y: touch.clientY, id: touch.identifier, direction: "next" }
      }
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (!touchStart) return
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === touchStart?.id) ?? event.changedTouches[0]
      const startPoint = touchStart
      touchStart = null
      if (!touch) return

      const distance = Math.hypot(touch.clientX - startPoint.x, touch.clientY - startPoint.y)

      if (startPoint.direction === "previous") {
        stopNative(event)
        if (distance <= 18 && currentPageRef.current > 0) {
          onTurn?.("previous")
          requestPage(currentPageRef.current - 1)
        }
        return
      }

      if (distance <= 18 && canGoNextRef.current && currentPageRef.current < lastPage) {
        onTurn?.("next")
        requestPage(currentPageRef.current + 1)
      }
    }

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || isInteractiveTarget(event.target)) return
      const ratio = ratioFor(event.clientX)

      if (ratio <= 0.25 && currentPageRef.current > 0) {
        mouseStart = { x: event.clientX, y: event.clientY, direction: "previous" }
        stopNative(event)
        return
      }

      if (!canGoNextRef.current && ratio > 0.25) {
        stopNative(event)
        return
      }

      if (ratio >= 0.75 && currentPageRef.current < lastPage) {
        mouseStart = { x: event.clientX, y: event.clientY, direction: "next" }
      }
    }

    const onMouseUp = (event: MouseEvent) => {
      if (!mouseStart) return
      const startPoint = mouseStart
      mouseStart = null

      const distance = Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y)

      if (startPoint.direction === "previous") {
        stopNative(event)
        if (distance <= 10 && currentPageRef.current > 0) {
          onTurn?.("previous")
          requestPage(currentPageRef.current - 1)
        }
        return
      }

      if (distance <= 10 && canGoNextRef.current && currentPageRef.current < lastPage) {
        onTurn?.("next")
        requestPage(currentPageRef.current + 1)
      }
    }

    shell.addEventListener("touchstart", onTouchStart, { capture: true, passive: false })
    shell.addEventListener("touchend", onTouchEnd, { capture: true, passive: false })
    shell.addEventListener("mousedown", onMouseDown, true)
    shell.addEventListener("mouseup", onMouseUp, true)

    return () => {
      shell.removeEventListener("touchstart", onTouchStart, true)
      shell.removeEventListener("touchend", onTouchEnd, true)
      shell.removeEventListener("mousedown", onMouseDown, true)
      shell.removeEventListener("mouseup", onMouseUp, true)
    }
  }, [onTurn])

  function api() {
    return bookRef.current?.pageFlip?.()
  }

  function finishNavigationFallback(target: number, waitMs: number) {
    if (flipFallbackRef.current) clearTimeout(flipFallbackRef.current)
    flipFallbackRef.current = setTimeout(() => {
      const flip = api()
      const actual = Number(flip?.getCurrentPageIndex?.() ?? currentPageRef.current)

      // If the animated command was swallowed by the library, force the page
      // into the requested position. This makes the back arrow deterministic.
      if (actual !== target && flip) {
        flip.turnToPage(target)
      }

      const synced = Number(flip?.getCurrentPageIndex?.() ?? target)
      currentPageRef.current = synced
      requestedTargetRef.current = null
      programmaticRef.current = false
      setFlipping(false)
      flipFallbackRef.current = null
      onPageChange(synced)

      if (pendingTargetRef.current !== null && pendingTargetRef.current !== synced) {
        const pending = pendingTargetRef.current
        pendingTargetRef.current = null
        window.setTimeout(() => requestPage(pending), 0)
      }
    }, waitMs)
  }

  function requestPage(target: number) {
    const nextPage = Math.max(0, Math.min(lastPage, target))
    const flip = api()
    const current = Number(flip?.getCurrentPageIndex?.() ?? currentPageRef.current)
    currentPageRef.current = current

    if (nextPage === current) return
    if (nextPage > current && !canGoNext) return
    if (!flip) {
      currentPageRef.current = nextPage
      onPageChange(nextPage)
      return
    }

    if (isFlippingRef.current) {
      pendingTargetRef.current = nextPage
      return
    }

    onPreparePage?.(nextPage)
    requestedTargetRef.current = nextPage
    programmaticRef.current = true
    setFlipping(true)

    const isOpeningCover = current === 0 && nextPage === 1
    const flipDuration = isOpeningCover ? 760 : 300

    try {
      if (nextPage === current + 1) flip.flipNext("bottom")
      else if (nextPage === current - 1) flip.flipPrev("bottom")
      else flip.flip(nextPage, "bottom")
    } catch {
      flip.turnToPage(nextPage)
    }

    finishNavigationFallback(nextPage, flipDuration + 120)
  }

  function goTo(target: number) {
    requestPage(target)
  }

  function blockMiddleMouseTurn(event: ReactMouseEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const ratio = x / Math.max(1, rect.width)

    if (!canGoNext && ratio > 0.25) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    if (ratio >= 0.75 && currentPageRef.current < lastPage) {
      onPreparePage?.(currentPageRef.current + 1)
    }
    if (ratio > 0.25 && ratio < 0.75) event.stopPropagation()
  }

  function blockMiddleTouchTurn(event: ReactTouchEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) return
    const touch = event.touches[0]
    if (!touch) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = touch.clientX - rect.left
    const ratio = x / Math.max(1, rect.width)

    if (!canGoNext && ratio > 0.25) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    if (ratio >= 0.75 && currentPageRef.current < lastPage) {
      onPreparePage?.(currentPageRef.current + 1)
    }
    if (ratio > 0.25 && ratio < 0.75) event.stopPropagation()
  }

  function handleShellClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target) || isFlippingRef.current) return
    if (Date.now() - lastFlipAtRef.current < 210) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const current = currentPageRef.current

    if (x <= rect.width * 0.25 && current > 0) {
      onTurn?.("previous")
      goTo(current - 1)
      return
    }

    if (x >= rect.width * 0.75 && current < lastPage && canGoNext) {
      onTurn?.("next")
      goTo(current + 1)
    }
  }

  useImperativeHandle(forwardedRef, () => ({
    next: () => requestPage(currentPageRef.current + 1),
    previous: () => requestPage(currentPageRef.current - 1),
    goTo: requestPage,
  }), [canGoNext, lastPage])

  return (
    <div
      ref={shellRef}
      className={cn("story-book-wrap book-pageflip-shell", isFlipping && "is-flipping", className)}
      onMouseDownCapture={blockMiddleMouseTurn}
      onTouchStartCapture={blockMiddleTouchTurn}
      onClickCapture={handleShellClick}
    >
      <HTMLFlipBook
        key={`${bookSize.width}-${bookSize.height}`}
        ref={bookRef}
        className="story-pageflip"
        style={{ margin: 0 } as CSSProperties}
        startPage={page}
        size="fixed"
        width={bookSize.width}
        height={bookSize.height}
        minWidth={bookSize.width}
        maxWidth={bookSize.width}
        minHeight={bookSize.height}
        maxHeight={bookSize.height}
        drawShadow
        flippingTime={page === 0 ? 760 : 300}
        usePortrait
        startZIndex={10}
        autoSize={false}
        maxShadowOpacity={0.3}
        showCover
        mobileScrollSupport
        clickEventForward
        useMouseEvents
        swipeDistance={18}
        showPageCorners={false}
        disableFlipByClick
        onChangeState={(event: any) => {
          const state = event?.data
          const flipping = state === "flipping" || state === "user_fold" || state === "fold_corner"
          setFlipping(flipping)
          if (!flipping && pendingTargetRef.current !== null) {
            const target = pendingTargetRef.current
            pendingTargetRef.current = null
            window.setTimeout(() => requestPage(target), 0)
          }
        }}
        onFlip={(event: any) => {
          const nextPage = Number(event?.data ?? 0)
          const previousPage = currentPageRef.current

          // Defensive guard for gesture events. Required onboarding questions
          // cannot be bypassed by dragging a page even if the library receives
          // an edge gesture before our capture handler on a particular browser.
          if (!programmaticRef.current && nextPage > previousPage && !canGoNextRef.current) {
            const flip = api()
            flip?.turnToPage(previousPage)
            requestedTargetRef.current = null
            pendingTargetRef.current = null
            setFlipping(false)
            return
          }

          currentPageRef.current = nextPage
          lastFlipAtRef.current = Date.now()
          setFlipping(false)
          if (flipFallbackRef.current) {
            clearTimeout(flipFallbackRef.current)
            flipFallbackRef.current = null
          }

          if (!programmaticRef.current && nextPage !== previousPage) {
            onTurn?.(nextPage > previousPage ? "next" : "previous")
          }
          programmaticRef.current = false
          requestedTargetRef.current = null
          onPageChange(nextPage)
        }}
      >
        {pages}
      </HTMLFlipBook>
    </div>
  )
})

export default BookSlider
