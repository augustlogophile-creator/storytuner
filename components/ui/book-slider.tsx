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
}>(function BookSlider({
  children,
  page,
  onPageChange,
  canGoNext = true,
  className,
  onTurn,
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

  // react-pageflip owns touch/mouse gestures on the book. Capture taps on the
  // left quarter *before* the library sees them so back navigation is reliable
  // on mobile. Interactive controls (quiz choices, links, buttons) are left
  // alone, so tapping an option still selects it rather than changing pages.
  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    let touchStart: { x: number; y: number; id: number | null } | null = null
    let mouseStart: { x: number; y: number } | null = null

    const inLeftQuarter = (clientX: number) => {
      const rect = shell.getBoundingClientRect()
      return clientX - rect.left <= rect.width * 0.25
    }

    const onTouchStart = (event: TouchEvent) => {
      if (isInteractiveTarget(event.target)) return
      const touch = event.changedTouches[0]
      if (!touch || !inLeftQuarter(touch.clientX) || currentPageRef.current <= 0) return

      touchStart = { x: touch.clientX, y: touch.clientY, id: touch.identifier }
      // Stop the page-flip library from treating a left-side tap as a fold.
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (!touchStart) return
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === touchStart?.id) ?? event.changedTouches[0]
      const startPoint = touchStart
      touchStart = null
      if (!touch) return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      const distance = Math.hypot(touch.clientX - startPoint.x, touch.clientY - startPoint.y)
      if (distance <= 18 && currentPageRef.current > 0) {
        onTurn?.("previous")
        requestPage(currentPageRef.current - 1)
      }
    }

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || isInteractiveTarget(event.target)) return
      if (!inLeftQuarter(event.clientX) || currentPageRef.current <= 0) return

      mouseStart = { x: event.clientX, y: event.clientY }
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    const onMouseUp = (event: MouseEvent) => {
      if (!mouseStart) return
      const startPoint = mouseStart
      mouseStart = null

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      const distance = Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y)
      if (distance <= 10 && currentPageRef.current > 0) {
        onTurn?.("previous")
        requestPage(currentPageRef.current - 1)
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

  function finishNavigationFallback(target: number) {
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
    }, 340)
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

    requestedTargetRef.current = nextPage
    programmaticRef.current = true
    setFlipping(true)

    try {
      if (nextPage === current + 1) flip.flipNext("bottom")
      else if (nextPage === current - 1) flip.flipPrev("bottom")
      else flip.flip(nextPage, "bottom")
    } catch {
      flip.turnToPage(nextPage)
    }

    finishNavigationFallback(nextPage)
  }

  function goTo(target: number) {
    requestPage(target)
  }

  function blockMiddleMouseTurn(event: ReactMouseEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    if (x > rect.width * 0.25 && x < rect.width * 0.75) event.stopPropagation()
  }

  function blockMiddleTouchTurn(event: ReactTouchEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) return
    const touch = event.touches[0]
    if (!touch) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = touch.clientX - rect.left
    if (x > rect.width * 0.25 && x < rect.width * 0.75) event.stopPropagation()
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
        flippingTime={255}
        usePortrait
        startZIndex={10}
        autoSize={false}
        maxShadowOpacity={0.22}
        showCover
        mobileScrollSupport
        clickEventForward
        useMouseEvents
        swipeDistance={10}
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
