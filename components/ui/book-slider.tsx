"use client"

import HTMLFlipBook from "react-pageflip"
import {
  Children,
  forwardRef,
  type CSSProperties,
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
  const ignoreForwardFlipUntilRef = useRef(0)
  const dragGestureRef = useRef<{
    pointerId: number
    pointerType: string
    startX: number
    startY: number
    side: "left" | "right"
    corner: "top" | "bottom" | "middle"
    dragging: boolean
  } | null>(null)
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

  useLayoutEffect(() => {
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

  function isBookControl(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest('[data-book-no-turn="true"]'))
  }

  function gestureRegion(clientX: number, clientY: number) {
    const shell = shellRef.current
    if (!shell) return null
    const rect = shell.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    // Give readers a generous physical edge to grab, but never turn on tap.
    // The actual fold still starts only after pointer movement is detected.
    const side = x <= rect.width * 0.30
      ? "left" as const
      : x >= rect.width * 0.70
        ? "right" as const
        : null
    if (!side) return null

    const corner = y <= rect.height * 0.38
      ? "top" as const
      : y >= rect.height * 0.62
        ? "bottom" as const
        : "middle" as const

    return { side, corner }
  }

  function flipRect() {
    const flip = api()
    const distElement = flip?.getUI?.()?.getDistElement?.()
    return distElement instanceof Element
      ? distElement.getBoundingClientRect()
      : shellRef.current?.getBoundingClientRect()
  }

  function pointForClient(clientX: number, clientY: number) {
    const rect = flipRect()
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    }
  }

  function pointForGestureStart(gesture: NonNullable<typeof dragGestureRef.current>) {
    const rect = flipRect()
    if (!rect) return pointForClient(gesture.startX, gesture.startY)

    const edgeInset = 1.5
    const x = gesture.side === "right" ? rect.width - edgeInset : edgeInset
    const rawY = gesture.startY - rect.top
    const y = gesture.corner === "top"
      ? edgeInset
      : gesture.corner === "bottom"
        ? rect.height - edgeInset
        : Math.max(edgeInset, Math.min(rect.height - edgeInset, rawY))

    return { x, y }
  }

  function handleDragPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (isBookControl(event.target)) return
    if (event.pointerType === "mouse" && event.button !== 0) return

    const region = gestureRegion(event.clientX, event.clientY)
    if (!region) return

    const current = currentPageRef.current
    if (region.side === "right" && (!canGoNextRef.current || current >= lastPage)) return
    if (region.side === "left" && current <= 0) return

    dragGestureRef.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      side: region.side,
      corner: region.corner,
      dragging: false,
    }

    try { event.currentTarget.setPointerCapture(event.pointerId) } catch {}
    event.preventDefault()
  }

  function handleDragPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = dragGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    const deltaX = event.clientX - gesture.startX
    const deltaY = event.clientY - gesture.startY
    const movement = Math.hypot(deltaX, deltaY)

    if (!gesture.dragging) {
      // A press/tap is completely inert. The fold begins only after a small
      // physical pull. Corner pulls may travel vertically, just like grabbing
      // the top or bottom corner of a real sheet of paper.
      const threshold = gesture.pointerType === "mouse" ? 3 : 4
      if (movement < threshold) return

      const movingInward = gesture.side === "right" ? deltaX < -threshold : deltaX > threshold
      const movingFromCorner = gesture.corner === "top"
        ? deltaY > threshold
        : gesture.corner === "bottom"
          ? deltaY < -threshold
          : false

      if (!movingInward && !movingFromCorner) return

      const flip = api()
      if (!flip?.startUserTouch || !flip?.userMove || !flip?.userStop) {
        dragGestureRef.current = null
        try { event.currentTarget.releasePointerCapture(event.pointerId) } catch {}
        return
      }

      onPreparePage?.(gesture.side === "right" ? currentPageRef.current + 1 : currentPageRef.current - 1)
      flip.startUserTouch(pointForGestureStart(gesture))
      gesture.dragging = true
      setFlipping(true)
    }

    api()?.userMove?.(pointForClient(event.clientX, event.clientY), gesture.pointerType !== "mouse")
    event.preventDefault()
  }

  function finishDragGesture(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const gesture = dragGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    dragGestureRef.current = null

    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch {}

    if (gesture.dragging) {
      const flip = api()
      if (cancelled) {
        flip?.turnToPage?.(currentPageRef.current)
        setFlipping(false)
      } else {
        flip?.userStop?.(pointForClient(event.clientX, event.clientY), false)
      }
    }

    // Suppress the browser click generated after pointerup. Buttons/links never
    // enter this gesture path because they are marked data-book-no-turn.
    event.preventDefault()
    event.stopPropagation()
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
      ignoreForwardFlipUntilRef.current = Date.now() + 220
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

    // A button/click sequence can occasionally dispatch twice while the page
    // is still animating. Never queue the same destination twice.
    if (requestedTargetRef.current === nextPage || pendingTargetRef.current === nextPage) return

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

  return (
    <div
      ref={shellRef}
      className={cn(
        "story-book-wrap book-pageflip-shell",
        isFlipping && "is-flipping",
        page === 0 && isFlipping && "is-opening-cover",
        className,
      )}
      onPointerDownCapture={handleDragPointerDown}
      onPointerMoveCapture={handleDragPointerMove}
      onPointerUpCapture={(event) => finishDragGesture(event)}
      onPointerCancelCapture={(event) => finishDragGesture(event, true)}
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
        drawShadow={page !== 0}
        flippingTime={page === 0 ? 760 : 300}
        usePortrait
        startZIndex={10}
        autoSize={false}
        maxShadowOpacity={0.16}
        showCover
        mobileScrollSupport
        clickEventForward
        useMouseEvents={false}
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
          const now = Date.now()

          // After a Continue/back command settles, ignore any stray second
          // forward flip emitted by the same pointer sequence. This prevents a
          // newly-landed page, especially the magnifying-glass page, from being
          // skipped before the user interacts with it.
          if (!programmaticRef.current && nextPage > previousPage && now < ignoreForwardFlipUntilRef.current) {
            api()?.turnToPage(previousPage)
            requestedTargetRef.current = null
            pendingTargetRef.current = null
            setFlipping(false)
            return
          }

          // Required onboarding questions cannot be bypassed with a drag.
          // Ordinary taps never enter the page-flip engine at all.
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
          } else if (programmaticRef.current && nextPage !== previousPage) {
            ignoreForwardFlipUntilRef.current = Date.now() + 220
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
