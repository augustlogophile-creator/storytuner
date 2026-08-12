"use client"

import { useMemo, useState } from "react"
import { Check, Lock, Sparkles } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { ConfirmDialog, NoticeDialog } from "@/components/confirm-dialog"
import { Weaver } from "@/components/weaver"
import { useApp, weaverColors } from "@/lib/app-state"

export function ShopClient() {
  const { state, purchaseWeaver, equipWeaver } = useApp()
  const [notice, setNotice] = useState("")
  const [pendingPurchaseId, setPendingPurchaseId] = useState<string | null>(null)
  const active = weaverColors.find((item) => item.id === state.activeWeaver) ?? weaverColors[0]
  const pendingPurchase = useMemo(
    () => weaverColors.find((item) => item.id === pendingPurchaseId) ?? null,
    [pendingPurchaseId],
  )

  function choose(id: string) {
    const color = weaverColors.find((item) => item.id === id)
    if (!color) return

    const owned = state.ownedWeavers.includes(id)
    if (owned) {
      equipWeaver(id)
      setNotice(`${color.name} is now equipped.`)
      return
    }

    if (state.xpBalance < color.cost) {
      setNotice(`You need ${color.cost - state.xpBalance} more XP to unlock ${color.name}.`)
      return
    }

    setPendingPurchaseId(id)
  }

  function confirmPurchase() {
    if (!pendingPurchase) return
    const result = purchaseWeaver(pendingPurchase.id)
    setPendingPurchaseId(null)
    setNotice(result.message)
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/home" label="Today" />
      <header className="app-page-enter">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Weaver shop</p>
        <h1 className="text-title mt-2 text-[1.7rem]">Give Weaver a fresh look.</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Trade XP for a new color. Your lifetime XP never drops — only your spendable balance does.
        </p>
      </header>

      <section className="app-surface flex items-center gap-6 rounded-3xl border border-border bg-card p-6">
        <Weaver size={104} />
        <div>
          <p className="text-sm font-semibold">{active.name}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{active.description}</p>
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            {state.xpBalance} XP available
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        {weaverColors.map((color) => {
          const owned = state.ownedWeavers.includes(color.id)
          const equipped = state.activeWeaver === color.id
          const affordable = state.xpBalance >= color.cost
          return (
            <article
              key={color.id}
              className={
                color.featured === "gold"
                  ? "flex items-center gap-4 rounded-3xl border border-amber-300/70 bg-gradient-to-r from-amber-50 to-card p-4"
                  : color.featured === "goat"
                    ? "flex items-center gap-4 rounded-3xl border border-stone-400/60 bg-gradient-to-r from-stone-100 to-card p-4"
                    : "flex items-center gap-4 rounded-3xl border border-border bg-card p-4"
              }
            >
              <Weaver size={75} colorId={color.id} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{color.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{color.description}</p>
              </div>
              <button
                type="button"
                disabled={equipped}
                onClick={() => choose(color.id)}
                className="press flex min-w-20 items-center justify-center gap-1 rounded-full border border-border px-3 py-2 text-xs font-semibold transition-colors hover:border-brand/50 disabled:opacity-50"
              >
                {equipped ? (
                  <><Check className="h-3.5 w-3.5" />Active</>
                ) : owned ? (
                  "Equip"
                ) : affordable ? (
                  `${color.cost} XP`
                ) : (
                  <><Lock className="h-3.5 w-3.5" />{color.cost}</>
                )}
              </button>
            </article>
          )
        })}
      </div>

      {pendingPurchase && (
        <ConfirmDialog
          open
          title={`Unlock ${pendingPurchase.name}?`}
          confirmLabel={`Spend ${pendingPurchase.cost} XP`}
          tone="brand"
          onCancel={() => setPendingPurchaseId(null)}
          onConfirm={confirmPurchase}
        >
          This will use <strong className="font-semibold text-foreground">{pendingPurchase.cost} XP</strong> and automatically equip the new Weaver. You will have <strong className="font-semibold text-foreground">{state.xpBalance - pendingPurchase.cost} XP</strong> left.
        </ConfirmDialog>
      )}

      <NoticeDialog open={Boolean(notice)} title="Weaver shop" onClose={() => setNotice("")}>
        {notice}
      </NoticeDialog>
    </div>
  )
}
