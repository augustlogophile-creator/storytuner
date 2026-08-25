"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { ConfirmDialog, NoticeDialog } from "@/components/confirm-dialog"
import { Weaver } from "@/components/weaver"
import { CountUp } from "@/components/ui/count-up"
import { useApp, weaverColors } from "@/lib/app-state"

const parchLore: Record<string, { rarity: string; title: string; note: string }> = {
  classic: { rarity: "Original", title: "The first page", note: "Paper & possibility" },
  scholar: { rarity: "Uncommon", title: "Keeper of margins", note: "Ink & inquiry" },
  detective: { rarity: "Uncommon", title: "Hunter of details", note: "Clue & consequence" },
  explorer: { rarity: "Rare", title: "Collector of roads", note: "Maps & memory" },
  bard: { rarity: "Rare", title: "Keeper of cadence", note: "Voice & rhythm" },
  sage: { rarity: "Epic", title: "The old storykeeper", note: "Wisdom & weight" },
  royal: { rarity: "Epic", title: "The crowned narrator", note: "Poise & presence" },
  master: { rarity: "Legendary", title: "Master of the telling", note: "Craft & command" },
  golden: { rarity: "Mythic", title: "The illuminated one", note: "Legacy & light" },
}

export function ShopClient() {
  const { state, purchaseWeaver, equipWeaver } = useApp()
  const activeIndex = Math.max(0, weaverColors.findIndex((item) => item.id === state.activeWeaver))
  const [selectedIndex, setSelectedIndex] = useState(activeIndex)
  const [notice, setNotice] = useState("")
  const [pendingPurchaseId, setPendingPurchaseId] = useState<string | null>(null)
  const [equippedParchId, setEquippedParchId] = useState<string | null>(null)
  const [unlockedParchId, setUnlockedParchId] = useState<string | null>(null)
  const pointerStart = useRef<number | null>(null)

  useEffect(() => {
    setSelectedIndex((current) => current < weaverColors.length ? current : activeIndex)
  }, [activeIndex])

  useEffect(() => {
    // Preload the whole collection so every Parch is ready the moment the user browses to it.
    for (const item of weaverColors) {
      const image = new window.Image()
      image.src = item.image
    }
  }, [])

  const selected = weaverColors[selectedIndex] ?? weaverColors[0]
  const selectedLore = parchLore[selected.id] ?? parchLore.classic
  const owned = state.ownedWeavers.includes(selected.id)
  const equipped = state.activeWeaver === selected.id
  const affordable = state.xpBalance >= selected.cost
  const pendingPurchase = useMemo(
    () => weaverColors.find((item) => item.id === pendingPurchaseId) ?? null,
    [pendingPurchaseId],
  )
  const unlockedParch = useMemo(
    () => weaverColors.find((item) => item.id === unlockedParchId) ?? null,
    [unlockedParchId],
  )
  const equippedParch = useMemo(
    () => weaverColors.find((item) => item.id === equippedParchId) ?? null,
    [equippedParchId],
  )

  useEffect(() => {
    if (!unlockedParchId) return
    const timeout = window.setTimeout(() => setUnlockedParchId(null), 2300)
    return () => window.clearTimeout(timeout)
  }, [unlockedParchId])

  useEffect(() => {
    if (!equippedParchId) return
    const timeout = window.setTimeout(() => setEquippedParchId(null), 1800)
    return () => window.clearTimeout(timeout)
  }, [equippedParchId])

  function select(nextIndex: number) {
    const normalized = (nextIndex + weaverColors.length) % weaverColors.length
    if (normalized === selectedIndex) return
    setSelectedIndex(normalized)
    playParchTone("browse")
  }

  function chooseSelected() {
    if (equipped) return

    if (owned) {
      equipWeaver(selected.id)
      playParchTone("equip")
      setEquippedParchId(selected.id)
      return
    }

    if (!affordable) {
      playParchTone("blocked")
      setNotice(`You need ${selected.cost - state.xpBalance} more XP to unlock ${selected.name}.`)
      return
    }

    setPendingPurchaseId(selected.id)
  }

  function confirmPurchase() {
    if (!pendingPurchase) return
    const result = purchaseWeaver(pendingPurchase.id)
    setPendingPurchaseId(null)
    if (result.ok) {
      playParchTone("unlock")
      setUnlockedParchId(pendingPurchase.id)
    } else {
      setNotice(result.message.replace(/Weaver/g, "Parch"))
    }
  }

  function handlePointerUp(clientX: number) {
    if (pointerStart.current === null) return
    const delta = clientX - pointerStart.current
    pointerStart.current = null
    if (Math.abs(delta) < 42) return
    select(selectedIndex + (delta < 0 ? 1 : -1))
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <BackLink href="/profile" label="Profile" />

      <header className="px-1">
        <div className="shop-heading-row flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-muted-foreground">Parch collection</p>
            <h1 className="mt-1.5 text-[1.65rem] font-semibold leading-tight tracking-[-0.035em]">Choose your Parch.</h1>
            <p className="mt-1 max-w-[22rem] text-sm leading-relaxed text-muted-foreground">Unlock and equip new Parch forms with XP.</p>
          </div>
          <div className="shrink-0 rounded-full border border-border bg-card px-3.5 py-2 text-right shadow-sm">
            <p className="text-sm font-semibold"><CountUp value={state.xpBalance} /> XP</p>
            <p className="text-[0.58rem] font-mono uppercase tracking-[0.12em] text-muted-foreground">available</p>
          </div>
        </div>
      </header>

      <section
        className="parch-archive relative isolate min-h-[41rem] overflow-hidden rounded-[2rem] border border-[#ded9cf] bg-[#fbfaf7] text-[#27231f] shadow-[0_16px_44px_rgba(39,35,31,0.07)] outline-none sm:min-h-[42rem]"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") select(selectedIndex - 1)
          if (event.key === "ArrowRight") select(selectedIndex + 1)
        }}
        onPointerDown={(event) => { pointerStart.current = event.clientX }}
        onPointerUp={(event) => handlePointerUp(event.clientX)}
        onPointerCancel={() => { pointerStart.current = null }}
      >
        <div className="parch-grid absolute inset-0 opacity-80" aria-hidden="true" />
        <div className="parch-glow absolute left-1/2 top-[8.7rem] h-52 w-52 -translate-x-1/2 rounded-full opacity-90 blur-3xl" aria-hidden="true" />
        <span className="parch-star left-[9%] top-[7%]" aria-hidden="true">✦</span>
        <span className="parch-star right-[12%] top-[11%] [animation-delay:900ms]" aria-hidden="true">✧</span>
        <span className="parch-star left-[17%] top-[28%] [animation-delay:1500ms]" aria-hidden="true">✧</span>

        <div className="relative flex h-full flex-col px-5 pb-5 pt-5 sm:px-7 sm:pb-7">
          <div className="flex h-5 shrink-0 items-center justify-between gap-4 font-mono text-[0.6rem] uppercase tracking-[0.17em] text-[#91887d]">
            <span>{selectedLore.rarity}</span>
            <span>Entry {String(selectedIndex + 1).padStart(2, "0")} / {String(weaverColors.length).padStart(2, "0")}</span>
          </div>

          <div className="relative mx-auto mt-3 flex h-[14.8rem] w-full max-w-[25rem] shrink-0 flex-col items-center justify-center text-center sm:h-[15.6rem]">
            <div key={selected.id} className="parch-reveal relative z-10 flex h-[9.2rem] w-[12rem] items-center justify-center sm:h-[9.8rem] sm:w-[12.7rem]">
              <Weaver size={156} colorId={selected.id} className="max-h-full max-w-full drop-shadow-[0_12px_14px_rgba(49,42,34,0.12)]" />
            </div>
            <p className="relative z-10 mt-1 font-mono text-[0.56rem] uppercase tracking-[0.2em] text-[#aa7a35]">{selectedLore.rarity}</p>
            <h2 className="relative z-10 mt-1 text-[1.42rem] font-semibold tracking-[-0.035em] text-[#27231f]">{selected.name}</h2>
          </div>

          <div className="relative mt-2 flex min-h-[18.65rem] shrink-0 flex-col rounded-[1.55rem] border border-[#ded9cf] bg-white/88 p-5 shadow-[0_8px_24px_rgba(39,35,31,0.045)] backdrop-blur-sm sm:min-h-[19.25rem] sm:p-6">
            <div className="flex h-7 shrink-0 items-center justify-between gap-3">
              <div className="inline-flex rounded-full border border-[#d7d0c5] bg-[#f6f3ed] px-2.5 py-1 font-mono text-[0.56rem] uppercase tracking-[0.15em] text-[#746d64]">{selectedLore.rarity}</div>
              <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-[#989187]">Archive {String(selectedIndex + 1).padStart(2, "0")}</span>
            </div>

            <div className="mt-3 h-[5.9rem] shrink-0 overflow-hidden">
              <h3 className="text-[1.36rem] font-semibold leading-tight tracking-[-0.03em] text-[#27231f]">{selectedLore.title}</h3>
              <p className="mt-2 line-clamp-2 max-w-[29rem] text-sm leading-relaxed text-[#716b64]">{selected.description}</p>
            </div>

            <div className="mt-3 flex h-11 shrink-0 items-center gap-3">
              <button type="button" onClick={() => select(selectedIndex - 1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d7d0c5] bg-[#fbfaf7] text-[#39342e] hover:bg-[#f2eee7]" aria-label="Previous Parch">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => select(selectedIndex + 1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d7d0c5] bg-[#fbfaf7] text-[#39342e] hover:bg-[#f2eee7]" aria-label="Next Parch">
                <ArrowRight className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-[0.7rem] font-medium text-[#777069]">Browse the collection</p>
                <div className="mt-1.5 grid w-full grid-cols-9 place-items-center gap-1" aria-label="Parch collection markers">
                  {weaverColors.map((item, index) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => select(index)}
                      className="group flex h-4 w-full min-w-0 items-center justify-center"
                      aria-label={`View ${item.name}`}
                    >
                      <span className={`parch-marker-dot ${index === selectedIndex ? "is-selected" : ""}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={chooseSelected}
              disabled={equipped}
              data-state={equipped ? "equipped" : owned ? "owned" : affordable ? "affordable" : "locked"}
              className={`parch-shop-action mt-auto flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-[inset_0_-2px_0_rgba(0,0,0,0.1)] disabled:cursor-default ${equipped ? "bg-[#ece8e1] text-[#716b64] shadow-none" : owned ? "bg-[#2b2823] text-white hover:bg-[#35312b]" : affordable ? "bg-brand text-brand-foreground hover:brightness-[1.03]" : "bg-[#ddd9d2] text-[#79736c] hover:bg-[#d3cfc8]"}`}
            >
              {equipped ? <><Check className="h-4 w-4" />Equipped</> : owned ? "Equip Parch" : <><Sparkles className="h-4 w-4" />Unlock for {selected.cost} XP</>}
            </button>
          </div>

          <p className="mt-auto pt-2 text-center text-[0.62rem] leading-relaxed text-[#9a938a]">Swipe, use the arrows, or tap a marker to browse.</p>
        </div>
      </section>

      {pendingPurchase && (
        <ConfirmDialog
          open
          title={`Unlock ${pendingPurchase.name}?`}
          confirmLabel={`Spend ${pendingPurchase.cost} XP`}
          tone="brand"
          onCancel={() => setPendingPurchaseId(null)}
          onConfirm={confirmPurchase}
        >
          This will use {pendingPurchase.cost} XP and automatically equip the new Parch. You will have {state.xpBalance - pendingPurchase.cost} XP left.
        </ConfirmDialog>
      )}


      {unlockedParch && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/10 px-5 backdrop-blur-[1px]" role="status" aria-live="polite">
          <div className="parch-unlock-medallion flex h-44 w-44 flex-col items-center justify-center rounded-full border border-[#cbbba6] bg-[#fffdf8] text-center shadow-[0_18px_55px_rgba(44,36,27,0.18)]">
            <Weaver size={76} colorId={unlockedParch.id} className="max-h-[4.9rem] max-w-[5.8rem]" />
            <p className="mt-2 px-4 text-[0.92rem] font-semibold leading-tight text-[#2d2924]">{unlockedParch.name} unlocked!</p>
          </div>
        </div>
      )}

      {equippedParch && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/5 px-5 backdrop-blur-[1px]" role="status" aria-live="polite">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border border-[#d5cabb] bg-[#fffdf9] shadow-[0_16px_40px_rgba(44,36,27,0.16)]">
              <Weaver size={88} colorId={equippedParch.id} className="max-h-[5.25rem] max-w-[6rem]" />
            </div>
            <div className="mt-3 rounded-full border border-[#d8cfc2] bg-[#fffdf9] px-5 py-2.5 shadow-[0_10px_28px_rgba(44,36,27,0.11)]">
              <p className="text-[0.92rem] font-semibold leading-tight text-[#2d2924]">{equippedParch.name} equipped</p>
            </div>
          </div>
        </div>
      )}

      <NoticeDialog open={Boolean(notice)} title="Parch collection" onClose={() => setNotice("")}>
        {notice}
      </NoticeDialog>
    </div>
  )
}

function playParchTone(kind: "browse" | "equip" | "unlock" | "blocked") {
  if (typeof window === "undefined") return
  try {
    const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return
    const context = new AudioContextCtor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const now = context.currentTime

    oscillator.type = kind === "unlock" ? "triangle" : "sine"
    const start = kind === "browse" ? 360 : kind === "equip" ? 440 : kind === "unlock" ? 520 : 220
    const end = kind === "browse" ? 430 : kind === "equip" ? 520 : kind === "unlock" ? 760 : 180
    oscillator.frequency.setValueAtTime(start, now)
    oscillator.frequency.exponentialRampToValueAtTime(end, now + (kind === "unlock" ? 0.16 : 0.09))
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(kind === "unlock" ? 0.045 : 0.024, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "unlock" ? 0.22 : 0.12))
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + (kind === "unlock" ? 0.23 : 0.13))
    oscillator.addEventListener("ended", () => void context.close())
  } catch {
    // Sound is optional. Browsing should still work when the browser blocks audio.
  }
}
