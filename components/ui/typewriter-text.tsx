"use client"

import { useEffect, useMemo, useState } from "react"

export const writingPrompts = [
  "once, on an ordinary tuesday...",
  "the part you almost left out...",
  "here is where it gets interesting...",
  "nobody warned me about what happened next...",
  "i almost didn't tell this one...",
  "it started with something small...",
  "the detail nobody else noticed...",
  "three seconds before everything changed...",
  "i still think about that afternoon...",
  "this is the story i never finish right...",
  "the moment i knew i had to say something...",
  "looking back, it makes more sense now...",
  "i wasn't planning on telling anyone this...",
  "the part that actually matters comes later...",
  "here's what i left out the first time i told it...",
]

type TypewriterTextProps = {
  prompts?: string[]
  className?: string
  typingMs?: number
  deletingMs?: number
  pauseMs?: number
}

export function TypewriterText({
  prompts = writingPrompts,
  className = "",
  typingMs = 68,
  deletingMs = 34,
  pauseMs = 1800,
}: TypewriterTextProps) {
  const source = useMemo(() => prompts.filter(Boolean), [prompts])
  const [promptIndex, setPromptIndex] = useState(0)
  const [visibleCharacters, setVisibleCharacters] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const current = source[promptIndex % Math.max(1, source.length)] ?? ""

  useEffect(() => {
    setPromptIndex(0)
    setVisibleCharacters(0)
    setDeleting(false)
  }, [source])

  useEffect(() => {
    if (promptIndex < source.length) return
    setPromptIndex(0)
  }, [promptIndex, source.length])

  useEffect(() => {
    if (!current) return

    if (!deleting && visibleCharacters < current.length) {
      const timeout = window.setTimeout(() => setVisibleCharacters((value) => value + 1), typingMs)
      return () => window.clearTimeout(timeout)
    }

    if (!deleting && visibleCharacters === current.length) {
      const timeout = window.setTimeout(() => setDeleting(true), pauseMs)
      return () => window.clearTimeout(timeout)
    }

    if (deleting && visibleCharacters > 0) {
      const timeout = window.setTimeout(() => setVisibleCharacters((value) => value - 1), deletingMs)
      return () => window.clearTimeout(timeout)
    }

    if (deleting && visibleCharacters === 0) {
      const timeout = window.setTimeout(() => {
        setPromptIndex((value) => source.length ? (value + 1) % source.length : 0)
        setDeleting(false)
      }, 320)
      return () => window.clearTimeout(timeout)
    }
  }, [current, deleting, deletingMs, pauseMs, source.length, typingMs, visibleCharacters])

  return (
    <span className={`typewriter-text ${className}`} aria-live="off">
      <span>{current.slice(0, visibleCharacters)}</span>
      <span className="typewriter-cursor" aria-hidden="true">|</span>
    </span>
  )
}
