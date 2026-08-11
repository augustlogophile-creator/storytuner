"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function RestrictionStatusWatcher() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    async function check() {
      try {
        const response = await fetch("/api/account/restriction", { cache: "no-store", headers: { Accept: "application/json" } })
        if (!response.ok) return
        const payload = await response.json() as { restriction?: { restricted?: boolean } }
        if (!cancelled && payload.restriction && payload.restriction.restricted === false) {
          if (timer) clearInterval(timer)
          router.replace("/home")
          router.refresh()
        }
      } catch {}
    }

    void check()
    timer = setInterval(() => void check(), 1200)
    return () => { cancelled = true; if (timer) clearInterval(timer) }
  }, [router])

  return null
}
