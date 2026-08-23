"use client"

import { Moon, Sun } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const THEME_STORAGE_KEY = "tellwise:theme"
type ThemeMode = "light" | "dark"

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.classList.toggle("light", theme === "light")
  root.dataset.theme = theme
  try { window.localStorage.setItem(THEME_STORAGE_KEY, theme) } catch {}
  try { document.cookie = `tellwise_theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax` } catch {}

  const themeMeta = document.querySelector('meta[name="theme-color"]')
  if (themeMeta) themeMeta.setAttribute("content", theme === "dark" ? "#1d1b18" : "#faf8f2")
}

export function CinematicThemeSwitcher() {
  const [mounted, setMounted] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>("light")
  const [animating, setAnimating] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const current: ThemeMode = document.documentElement.classList.contains("dark") ? "dark" : "light"
    setTheme(current)
    setMounted(true)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  function toggleTheme() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark"
    setAnimating(true)
    setTheme(next)
    applyTheme(next)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setAnimating(false), 760)
  }

  if (!mounted) {
    return <span className="theme-switcher theme-switcher-placeholder" aria-hidden="true" />
  }

  const dark = theme === "dark"
  return (
    <button
      type="button"
      className={`theme-switcher ${dark ? "is-dark" : "is-light"} ${animating ? "is-animating" : ""}`}
      onClick={toggleTheme}
      role="switch"
      aria-checked={dark}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
    >
      <span className="theme-switcher-groove" aria-hidden="true" />
      <span className="theme-switcher-icons" aria-hidden="true"><Sun /><Moon /></span>
      <span className="theme-switcher-thumb" aria-hidden="true">
        <span className="theme-switcher-particle p1" />
        <span className="theme-switcher-particle p2" />
        <span className="theme-switcher-particle p3" />
        {dark ? <Moon /> : <Sun />}
      </span>
    </button>
  )
}
