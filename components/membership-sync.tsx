"use client"

import { useEffect } from "react"
import { useApp } from "@/lib/app-state"

export function MembershipSync() {
  const { state, setPremium } = useApp()
  const userId = state.accountOwnerId

  useEffect(() => {
    if (!userId) {
      setPremium(false)
      return
    }

    let active = true
    fetch("/api/membership", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ active?: boolean }> : null)
      .then((result) => {
        if (active && result) setPremium(Boolean(result.active))
      })
      .catch(() => {
        // Keep the server-provided status during a temporary network failure.
      })

    return () => { active = false }
  }, [setPremium, userId])

  return null
}
