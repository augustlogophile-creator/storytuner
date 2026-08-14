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
  const pendingTargetRef = useRef<number | null>(null)
  const flipFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFlipAtRef = useRef(0)
  const [isFlipping, setIsFlipping] = useState(false)
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

  // Keep the middle 50% of the page inert so normal reading/selection never
  // starts a physical fold. The outer 25% on either side stays available for
  // natural page interaction, and simple taps there are handled below.
  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    const blockMiddleGrab = (event: Event) => {
      if (isInteractiveTarget(event.target)) return

      const point = event instanceof TouchEvent ? event.touches[0] : event instanceof MouseEvent ? event : null
      if (!point) return

      const rect = shell.getBoundingClientRect()
      const x = point.clientX - rect.left
      if (x > rect.width * 0.25 && x < rect.width * 0.75) {
        event.preventDefault()
        event.stopPropagation()
        if ("stopImmediatePropagation" in event) event.stopImmediatePropagation()
      }
    }

    shell.addEventListener("mousedown", blockMiddleGrab, true)
    shell.addEventListener("touchstart", blockMiddleGrab, { capture: true, passive: false })

    return () => {
      shell.removeEventListener("mousedown", blockMiddleGrab, true)
      shell.removeEventListener("touchstart", blockMiddleGrab, true)
    }
  }, [])

  function api() {
    return bookRef.current?.pageFlip?.()
  }

  function markProgrammaticFlip() {
    programmaticRef.current = true
    setIsFlipping(true)
    if (flipFallbackRef.current) clearTimeout(flipFallbackRef.current)
    // A safety valve so a missed library state event can never permanently
    // disable the navigation controls.
    flipFallbackRef.current = setTimeout(() => {
      setIsFlipping(false)
      programmaticRef.current = false
      flipFallbackRef.current = null
    }, 900)
  }

  function performGoTo(target: number) {
    const nextPage = Math.max(0, Math.min(lastPage, target))
    const current = currentPageRef.current
    if (nextPage === current) return
    if (nextPage > current && !canGoNext) return

    const flip = api()
    if (!flip) return

    if (isFlipping) {
      pendingTargetRef.current = nextPage
      return
    }

    markProgrammaticFlip()
    if (nextPage === current + 1) flip.flipNext("bottom")
    else if (nextPage === current - 1) flip.flipPrev("bottom")
    else flip.flip(nextPage, "bottom")
  }

  function goTo(target: number) {
    performGoTo(target)
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
    if (isInteractiveTarget(event.target) || isFlipping) return
    if (Date.now() - lastFlipAtRef.current < 300) return

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
    next: () => goTo(currentPageRef.current + 1),
    previous: () => goTo(currentPageRef.current - 1),
    goTo,
  }), [canGoNext, isFlipping, lastPage])

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
        flippingTime={520}
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
          setIsFlipping(flipping)
          if (!flipping && pendingTargetRef.current !== null) {
            const target = pendingTargetRef.current
            pendingTargetRef.current = null
            window.setTimeout(() => performGoTo(target), 0)
          }
        }}
        onFlip={(event: any) => {
          const nextPage = Number(event?.data ?? 0)
          const previousPage = currentPageRef.current
          currentPageRef.current = nextPage
          lastFlipAtRef.current = Date.now()
          setIsFlipping(false)
          if (flipFallbackRef.current) {
            clearTimeout(flipFallbackRef.current)
            flipFallbackRef.current = null
          }

          if (!programmaticRef.current && nextPage !== previousPage) {
            onTurn?.(nextPage > previousPage ? "next" : "previous")
          }
          programmaticRef.current = false
          onPageChange(nextPage)
        }}
      >
        {pages}
      </HTMLFlipBook>
    </div>
  )
})

export default BookSlider
