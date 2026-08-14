"use client"

import {
  Children,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react"
import { cn } from "@/lib/utils"

type DragState = {
  direction: "next" | "previous"
  pageIndex: number
  startX: number
  progress: number
}

export function BookPage({
  children,
  cover = false,
  className,
}: {
  children: ReactNode
  cover?: boolean
  className?: string
}) {
  return (
    <div className={cn("story-book-page-inner", cover && "story-book-cover-inner", className)} data-book-cover={cover ? "true" : "false"}>
      {children}
    </div>
  )
}

export default function BookSlider({
  children,
  page,
  onPageChange,
  canGoNext = true,
  className,
  onTurn,
}: {
  children: ReactNode
  page: number
  onPageChange: (page: number) => void
  canGoNext?: boolean
  className?: string
  onTurn?: (direction: "next" | "previous") => void
}) {
  const pages = useMemo(() => Children.toArray(children), [children])
  const stageRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [settling, setSettling] = useState(false)

  const lastPage = pages.length - 1
  const canPrevious = page > 0
  const canNext = page < lastPage && canGoNext

  function width() {
    return Math.max(stageRef.current?.getBoundingClientRect().width ?? 1, 1)
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>, direction: "next" | "previous") {
    if (settling) return
    if (direction === "next" && !canNext) return
    if (direction === "previous" && !canPrevious) return

    const target = event.target as HTMLElement
    if (target.closest("button, a, input, textarea, label, [data-book-no-turn='true']")) return

    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      direction,
      pageIndex: direction === "next" ? page : page - 1,
      startX: event.clientX,
      progress: 0,
    })
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return
    const distance = drag.direction === "next"
      ? drag.startX - event.clientX
      : event.clientX - drag.startX
    const progress = Math.max(0, Math.min(1, distance / (width() * 0.74)))
    setDrag((current) => current ? { ...current, progress } : current)
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {}

    const shouldTurn = drag.progress > 0.24
    const direction = drag.direction
    setDrag(null)

    if (!shouldTurn) return
    turn(direction)
  }

  function turn(direction: "next" | "previous") {
    if (settling) return
    if (direction === "next" && !canNext) return
    if (direction === "previous" && !canPrevious) return

    setSettling(true)
    onTurn?.(direction)
    onPageChange(direction === "next" ? page + 1 : page - 1)
    window.setTimeout(() => setSettling(false), 690)
  }

  function handleTap(event: ReactMouseEvent<HTMLDivElement>) {
    if (drag || settling) return
    const target = event.target as HTMLElement
    if (target.closest("button, a, input, textarea, label, [data-book-no-turn='true']")) return

    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const relativeX = event.clientX - rect.left
    if (relativeX > rect.width * 0.62) turn("next")
    else if (relativeX < rect.width * 0.18) turn("previous")
  }

  return (
    <div className={cn("story-book-wrap", className)}>
      <div
        ref={stageRef}
        className="story-book-stage"
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const x = event.clientX - rect.left
          if (x >= rect.width * 0.72) beginDrag(event, "next")
          else if (x <= rect.width * 0.16) beginDrag(event, "previous")
        }}
        onClick={handleTap}
      >
        <div className="story-book-spine" aria-hidden="true" />
        {pages.map((child, index) => {
          const isDragPage = drag?.pageIndex === index
          let rotation = index < page ? -180 : 0
          let dragProgress = 0

          if (isDragPage && drag) {
            dragProgress = drag.progress
            rotation = drag.direction === "next"
              ? -180 * drag.progress
              : -180 + 180 * drag.progress
          }

          const isCover = index === 0
          const style = {
            "--book-rotation": `${rotation}deg`,
            "--book-drag": dragProgress,
            zIndex: isDragPage ? pages.length + 4 : index < page ? index + 1 : pages.length - index + 1,
            pointerEvents: index === page ? "auto" : "none",
          } as CSSProperties

          return (
            <div
              key={index}
              className={cn(
                "story-book-sheet",
                isCover && "story-book-sheet-cover",
                isDragPage && "is-dragging",
                index < page && "is-turned",
              )}
              style={style}
              aria-hidden={index !== page}
            >
              <div className="story-book-face story-book-front">{child}</div>
              <div className={cn("story-book-face story-book-back", isCover && "story-book-back-cover")} aria-hidden="true" />
              <div className="story-book-turn-shadow" aria-hidden="true" />
            </div>
          )
        })}

        {canNext && <span className="story-book-corner story-book-corner-next" aria-hidden="true" />}
        {canPrevious && <span className="story-book-corner story-book-corner-previous" aria-hidden="true" />}
      </div>
    </div>
  )
}
