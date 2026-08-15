"use client"

import HTMLFlipBook from "react-pageflip"
import {
  Children,
  forwardRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
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
  const edgeGestureRef = useRef<{ pointerId: number; startX: number; startY: number; side: "left" | "right" } | null>(null)
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

  function setFlipping(value: boolean) {
    isFlippingRef.current = value
    setIsFlippingState(value)
  }

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

  useImperativeHandle(forwardedRef, () => ({
    next: () => requestPage(currentPageRef.current + 1),
    previous: () => requestPage(currentPageRef.current - 1),
    goTo: requestPage,
  }), [canGoNext, lastPage])
  function isBookControl(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest('[data-book-no-turn="true"]'))
  }

  function edgeForClientX(clientX: number) {
    const shell = shellRef.current
    if (!shell) return null
    const rect = shell.getBoundingClientRect()
    const x = clientX - rect.left
    if (x <= rect.width * 0.25) return "left" as const
    if (x >= rect.width * 0.75) return "right" as const
    return null
  }

  function handleEdgePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (isBookControl(event.target)) return
    if (event.pointerType === "mouse" && event.button !== 0) return
    const side = edgeForClientX(event.clientX)
    if (!side) return

    edgeGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      side,
    }
    // Do not let react-pageflip react to a simple press in the outer quarters.
    event.stopPropagation()
  }

  function handleEdgePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = edgeGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    event.stopPropagation()
  }

  function handleEdgePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = edgeGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    edgeGestureRef.current = null
    event.stopPropagation()

    const deltaX = event.clientX - gesture.startX
    const deltaY = event.clientY - gesture.startY
    const isHorizontalFlip = Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15
    if (!isHorizontalFlip) return

    if (gesture.side === "right" && deltaX < 0) requestPage(currentPageRef.current + 1)
    if (gesture.side === "left" && deltaX > 0) requestPage(currentPageRef.current - 1)
  }

  function handleEdgePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (edgeGestureRef.current?.pointerId === event.pointerId) edgeGestureRef.current = null
  }

  function handleEdgeClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (isBookControl(event.target)) return
    if (!edgeForClientX(event.clientX)) return
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div
      ref={shellRef}
      className={cn("story-book-wrap book-pageflip-shell", isFlipping && "is-flipping", className)}
      onPointerDownCapture={handleEdgePointerDown}
      onPointerMoveCapture={handleEdgePointerMove}
      onPointerUpCapture={handleEdgePointerUp}
      onPointerCancelCapture={handleEdgePointerCancel}
      onClickCapture={handleEdgeClick}
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
        useMouseEvents={false}
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

          // Required onboarding questions cannot be bypassed with a drag or
          // swipe. Ordinary taps never turn pages because click flipping is off.
          if (!programmaticRef.current && nextPage > previousPage && !canGoNextRef.current) {
            const flip = api()
            flip?.turnToPage(previousPage)
            requestedTargetRef.current = null
            pendingTargetRef.current = null
            setFlipping(false)
            return
          }

          currentPageRef.current = nextPage
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
