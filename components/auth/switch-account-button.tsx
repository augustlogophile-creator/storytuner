"use client"

import { useState } from "react"
import { LogIn, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { markIntroSeen } from "@/lib/intro-history"
import { createClient } from "@/lib/supabase/client"

export function SwitchAccountButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function switchAccount() {
    if (busy) return
    setBusy(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      markIntroSeen()
      document.documentElement.classList.remove("dark")
      document.documentElement.classList.add("light")
    } finally {
      router.replace("/sign-up?mode=sign-in")
      router.refresh()
    }
  }

  return (
    <button
      type="button"
      onClick={() => void switchAccount()}
      disabled={busy}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
      Use another account
    </button>
  )
}
