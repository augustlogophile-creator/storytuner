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
    const shell = shellRef.current
    if (!shell) return

    const stopBackwardsGrab = (event: Event) => {
      const target = event.target
      if (target instanceof Element && target.closest("button, a, input, textarea, select, label, [data-book-no-turn='true']")) return

      const point = event instanceof TouchEvent ? event.touches[0] : event instanceof MouseEvent ? event : null
      if (!point) return

      const rect = shell.getBoundingClientRect()
      if (point.clientX - rect.left < rect.width * 0.5) {
        event.preventDefault()
        event.stopPropagation()
        if ("stopImmediatePropagation" in event) event.stopImmediatePropagation()
      }
    }

    shell.addEventListener("mousedown", stopBackwardsGrab, true)
    shell.addEventListener("touchstart", stopBackwardsGrab, { capture: true, passive: false })

    return () => {
      shell.removeEventListener("mousedown", stopBackwardsGrab, true)
      shell.removeEventListener("touchstart", stopBackwardsGrab, true)
    }
  }, [])

  function api() {
    return bookRef.current?.pageFlip?.()
  }

  function goTo(target: number) {
    const nextPage = Math.max(0, Math.min(lastPage, target))
    const current = currentPageRef.current
    if (nextPage === current) return
    if (nextPage > current && !canGoNext) return

    const flip = api()
    if (!flip) return

    programmaticRef.current = true
    if (nextPage === current + 1) flip.flipNext("bottom")
    else if (nextPage === current - 1) flip.flipPrev("bottom")
    else flip.flip(nextPage, "bottom")
  }

  function isInteractiveTarget(target: EventTarget | null) {
    return target instanceof Element
      && Boolean(target.closest("button, a, input, textarea, select, label, [data-book-no-turn='true']"))
  }

  // PageFlip supports both directions by default. StoryTuner intentionally reserves
  // manual page turning for the right side only. Previous-page navigation stays on
  // the explicit back control, which avoids accidental backwards flips on mobile.
  function blockLeftMouseTurn(event: ReactMouseEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX - rect.left < rect.width * 0.48) event.stopPropagation()
  }

  function blockLeftTouchTurn(event: ReactTouchEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) return
    const touch = event.touches[0]
    if (!touch) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (touch.clientX - rect.left < rect.width * 0.48) event.stopPropagation()
  }

  useImperativeHandle(forwardedRef, () => ({
    next: () => goTo(currentPageRef.current + 1),
    previous: () => goTo(currentPageRef.current - 1),
    goTo,
  }), [canGoNext, lastPage])

  return (
    <div
      ref={shellRef}
      className={cn("story-book-wrap book-pageflip-shell", isFlipping && "is-flipping", className)}
      onMouseDownCapture={blockLeftMouseTurn}
      onTouchStartCapture={blockLeftTouchTurn}
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
        drawShadow
        flippingTime={650}
        usePortrait
        startZIndex={10}
        autoSize={false}
        maxShadowOpacity={0.28}
        showCover
        mobileScrollSupport
        clickEventForward
        useMouseEvents={canGoNext}
        swipeDistance={12}
        showPageCorners={false}
        disableFlipByClick
        onChangeState={(event: any) => {
          const state = event?.data
          setIsFlipping(state === "flipping" || state === "user_fold" || state === "fold_corner")
        }}
        onFlip={(event: any) => {
          const nextPage = Number(event?.data ?? 0)
          const previousPage = currentPageRef.current
          currentPageRef.current = nextPage
          setIsFlipping(false)

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
