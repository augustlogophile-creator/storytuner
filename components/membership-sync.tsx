"use client"

import { useEffect } from "react"
import { useApp } from "@/lib/app-state"

export function MembershipSync() {
  const { setPremium } = useApp()

  useEffect(() => {
    let active = true
    fetch("/api/membership", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ active?: boolean }> : { active: false })
      .then((result) => {
        if (active) setPremium(Boolean(result.active))
      })
      .catch(() => {
        if (active) setPremium(false)
      })
    return () => { active = false }
  }, [setPremium])

  return null
}
