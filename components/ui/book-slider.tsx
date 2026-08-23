"use client"

import HTMLFlipBook from "react-pageflip"
import {
  Children,
  forwardRef,
  type CSSProperties,
  type ReactNode,
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

  // Let react-pageflip handle the physical page-drag animation itself.
  // We only gate where a gesture may start. Taps never turn pages: the
  // library has disableFlipByClick enabled and we do not add any tap fallback.
  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    const stopNative = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    const ratioFor = (clientX: number) => {
      const rect = shell.getBoundingClientRect()
      return (clientX - rect.left) / Math.max(1, rect.width)
    }

    const shouldBlock = (clientX: number) => {
      const ratio = ratioFor(clientX)
      const current = currentPageRef.current
      if (ratio > 0.25 && ratio < 0.75) return true
      if (ratio >= 0.75 && !canGoNextRef.current) return true
      if (ratio <= 0.25 && current <= 0) return true
      if (ratio >= 0.75 && current >= lastPage) return true
      return false
    }

    const onTouchStart = (event: TouchEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest("button, a, input, textarea, select, label, [data-book-no-turn='true']")) return
      const touch = event.changedTouches[0]
      if (!touch) return
      if (shouldBlock(touch.clientX)) stopNative(event)
      else onPreparePage?.(ratioFor(touch.clientX) >= 0.75 ? currentPageRef.current + 1 : currentPageRef.current - 1)
    }

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      const target = event.target
      if (target instanceof Element && target.closest("button, a, input, textarea, select, label, [data-book-no-turn='true']")) return
      if (shouldBlock(event.clientX)) stopNative(event)
      else onPreparePage?.(ratioFor(event.clientX) >= 0.75 ? currentPageRef.current + 1 : currentPageRef.current - 1)
    }

    shell.addEventListener("touchstart", onTouchStart, { capture: true, passive: false })
    shell.addEventListener("mousedown", onMouseDown, true)
    return () => {
      shell.removeEventListener("touchstart", onTouchStart, true)
      shell.removeEventListener("mousedown", onMouseDown, true)
    }
  }, [lastPage, onPreparePage])

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

    const flipDuration = 1000

    try {
      if (nextPage === current + 1) flip.flipNext("bottom")
      else if (nextPage === current - 1) flip.flipPrev("bottom")
      else flip.flip(nextPage, "bottom")
    } catch {
      flip.turnToPage(nextPage)
    }

    finishNavigationFallback(nextPage, flipDuration + 120)
  }


  useImperativeHandle(forwardedRef, () => ({
    next: () => requestPage(currentPageRef.current + 1),
    previous: () => requestPage(currentPageRef.current - 1),
    goTo: requestPage,
  }), [canGoNext, lastPage])

  return (
    <div
      ref={shellRef}
      data-page={page}
      className={cn(
        "story-book-wrap book-pageflip-shell",
        isFlipping && "is-flipping",
        isFlipping && page === 0 && requestedTargetRef.current === 1 && "is-opening-cover",
        page > 0 && "has-opened-cover",
        className,
      )}
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
        flippingTime={1000}
        usePortrait
        startZIndex={10}
        autoSize={false}
        maxShadowOpacity={0.24}
        showCover={false}
        mobileScrollSupport
        clickEventForward
        useMouseEvents
        swipeDistance={14}
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
