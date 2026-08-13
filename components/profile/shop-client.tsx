"use client"

import { useMemo, useState } from "react"
import { Check, Lock, ScrollText, Sparkles, Stars } from "lucide-react"
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
    const style = weaverColors.find((item) => item.id === id)
    if (!style) return

    const owned = state.ownedWeavers.includes(id)
    if (owned) {
      equipWeaver(id)
      setNotice(`${style.name} is now equipped.`)
      return
    }

    if (state.xpBalance < style.cost) {
      setNotice(`You need ${style.cost - state.xpBalance} more XP to unlock ${style.name}.`)
      return
    }

    setPendingPurchaseId(id)
  }

  function confirmPurchase() {
    if (!pendingPurchase) return
    const result = purchaseWeaver(pendingPurchase.id)
    setPendingPurchaseId(null)
    setNotice(result.message.replace(/Weaver/g, "Parch"))
  }

  return (
    <div className="flex flex-col gap-6 pb-2">
      <BackLink href="/home" label="Today" />

      <section className="relative overflow-hidden rounded-[2rem] border border-amber-200/70 bg-[radial-gradient(circle_at_top,rgba(240,204,130,0.35),transparent_34%),linear-gradient(135deg,#2d261f_0%,#413529_52%,#8c6239_120%)] p-6 text-primary-foreground shadow-[0_18px_50px_rgba(51,36,22,0.16)]">
        <div className="absolute -right-12 top-4 h-32 w-32 rounded-full bg-amber-200/20 blur-3xl" />
        <div className="absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-orange-200/15 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="max-w-[17rem]">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[0.66rem] font-mono uppercase tracking-[0.16em] text-white/80">
              <ScrollText className="h-3.5 w-3.5" />
              Parch atelier
            </div>
            <h1 className="mt-3 text-[1.7rem] font-semibold leading-tight tracking-[-0.03em] text-balance">Choose a new form for Parch.</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/72">
              Unlock rare scroll forms with XP. Your lifetime XP stays intact, only your spendable balance changes.
            </p>
          </div>
          <div className="hidden rounded-[1.6rem] border border-white/10 bg-white/6 p-3 sm:block">
            <Weaver size={120} />
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-[1.2fr_auto] sm:items-center">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/7 px-4 py-4">
            <p className="text-[0.68rem] font-mono uppercase tracking-[0.16em] text-white/65">Currently equipped</p>
            <p className="mt-2 text-lg font-semibold text-white">{active.name}</p>
            <p className="mt-1 max-w-[18rem] text-sm leading-relaxed text-white/70">{active.description}</p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950 shadow-sm sm:self-center">
            <Sparkles className="h-4 w-4" />
            {state.xpBalance} XP available
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {weaverColors.map((style) => {
          const owned = state.ownedWeavers.includes(style.id)
          const equipped = state.activeWeaver === style.id
          const affordable = state.xpBalance >= style.cost
          const featuredClass =
            style.featured === "gold"
              ? "border-amber-300/80 bg-[linear-gradient(180deg,rgba(255,247,214,0.96),rgba(255,252,244,0.98))] shadow-[0_16px_32px_rgba(232,182,67,0.16)]"
              : style.featured === "master"
                ? "border-slate-300/80 bg-[linear-gradient(180deg,rgba(247,245,241,0.98),rgba(255,255,255,0.98))] shadow-[0_12px_28px_rgba(66,54,41,0.08)]"
                : "border-border bg-card shadow-[0_1px_2px_rgba(32,28,24,.025)]"

          return (
            <article
              key={style.id}
              className={`group relative overflow-hidden rounded-[1.8rem] border p-4 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_12px_28px_rgba(51,36,22,0.08)] ${featuredClass}`}
            >
              <div className="absolute right-3 top-3 flex items-center gap-1.5 text-[0.65rem] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                {equipped ? <><Check className="h-3.5 w-3.5 text-brand" />Equipped</> : owned ? "Owned" : `${style.cost} XP`}
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[1.45rem] border border-black/5 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                  <Weaver size={88} colorId={style.id} className="transition-transform duration-200 group-hover:scale-[1.04]" />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[1.02rem] font-semibold leading-snug tracking-[-0.02em]">{style.name}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{style.description}</p>
                    </div>
                    {(style.featured === "gold" || style.featured === "master") && (
                      <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.featured === "gold" ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-700"}`}>
                        <Stars className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {equipped ? "Active across StoryTuner" : owned ? "Ready to equip across the app" : "Unlock and equip instantly"}
                </div>
                <button
                  type="button"
                  disabled={equipped}
                  onClick={() => choose(style.id)}
                  className={`inline-flex min-w-[6.6rem] items-center justify-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50 ${equipped ? "border border-border bg-secondary text-foreground" : owned ? "bg-primary text-primary-foreground" : affordable ? "bg-brand text-brand-foreground" : "border border-border bg-card text-foreground"}`}
                >
                  {equipped ? (
                    <><Check className="h-3.5 w-3.5" />Active</>
                  ) : owned ? (
                    "Equip"
                  ) : affordable ? (
                    `${style.cost} XP`
                  ) : (
                    <><Lock className="h-3.5 w-3.5" />Locked</>
                  )}
                </button>
              </div>
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
          This will use <strong className="font-semibold text-foreground">{pendingPurchase.cost} XP</strong> and automatically equip the new Parch. You will have <strong className="font-semibold text-foreground">{state.xpBalance - pendingPurchase.cost} XP</strong> left.
        </ConfirmDialog>
      )}

      <NoticeDialog open={Boolean(notice)} title="Parch atelier" onClose={() => setNotice("")}>
        {notice}
      </NoticeDialog>
    </div>
  )
}
