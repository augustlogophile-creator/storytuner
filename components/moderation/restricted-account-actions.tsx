"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, Trash2 } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { SwitchAccountButton } from "@/components/auth/switch-account-button"
import { clearMedia } from "@/lib/media-store"
import { createClient } from "@/lib/supabase/client"

export function RestrictedAccountActions() {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function deleteAccount() {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      })
      const payload = await response.json() as { deleted?: boolean; error?: string }
      if (!response.ok || !payload.deleted) throw new Error(payload.error || "Tellwise could not delete this account.")
      await clearMedia().catch(() => undefined)
      try {
        for (const key of Object.keys(localStorage)) if (key.startsWith("storytuner")) localStorage.removeItem(key)
        sessionStorage.clear()
      } catch {}
      await createClient().auth.signOut().catch(() => undefined)
      document.documentElement.classList.remove("dark")
      document.documentElement.classList.add("light")
      router.replace("/?accountDeleted=1")
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tellwise could not delete this account.")
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <a
        href="mailto:tellwiseapp@gmail.com?subject=Tellwise%20Account%20Review"
        className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
      >
        <Mail className="h-4 w-4" /> Request a review
      </a>
      <SwitchAccountButton />
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" /> Permanently delete this account
      </button>
      {error && <p className="text-xs leading-5 text-destructive">{error}</p>}
      <ConfirmDialog
        open={confirmDelete}
        title="Permanently delete this account?"
        confirmLabel="Delete account permanently"
        tone="danger"
        busy={busy}
        onCancel={() => { if (!busy) setConfirmDelete(false) }}
        onConfirm={() => void deleteAccount()}
      >
        Your login, profile, recordings, progress, Community activity, Planner history, and billing connection will be deleted. Any active Tellwise subscription will be canceled. This cannot be undone.
      </ConfirmDialog>
    </div>
  )
}
