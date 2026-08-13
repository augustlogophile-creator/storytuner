"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react"
import { BackLink } from "@/components/page-header"
import { ConfirmDialog, NoticeDialog } from "@/components/confirm-dialog"
import { Weaver } from "@/components/weaver"
import { Celebration } from "@/components/ui/celebration"
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
  const [celebrate, setCelebrate] = useState(false)
  const pointerStart = useRef<number | null>(null)

  useEffect(() => {
    setSelectedIndex((current) => current < weaverColors.length ? current : activeIndex)
  }, [activeIndex])

  const selected = weaverColors[selectedIndex] ?? weaverColors[0]
  const selectedLore = parchLore[selected.id] ?? parchLore.classic
  const owned = state.ownedWeavers.includes(selected.id)
  const equipped = state.activeWeaver === selected.id
  const affordable = state.xpBalance >= selected.cost
  const pendingPurchase = useMemo(
    () => weaverColors.find((item) => item.id === pendingPurchaseId) ?? null,
    [pendingPurchaseId],
  )

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
      setCelebrate(true)
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
      setCelebrate(true)
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
      <Celebration active={celebrate} label={equipped ? `${selected.name} equipped` : `${selected.name} unlocked`} onDone={() => setCelebrate(false)} />
      <BackLink href="/profile" label="Profile" />

      <header className="px-1">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-muted-foreground">Parch collection</p>
            <h1 className="mt-1.5 text-[1.65rem] font-semibold leading-tight tracking-[-0.035em]">Choose your Parch.</h1>
            <p className="mt-1 max-w-[22rem] text-sm leading-relaxed text-muted-foreground">Browse the archive, unlock a form with XP, then equip it everywhere in StoryTuner.</p>
          </div>
          <div className="shrink-0 rounded-full border border-border bg-card px-3.5 py-2 text-right shadow-sm">
            <p className="text-sm font-semibold"><CountUp value={state.xpBalance} /> XP</p>
            <p className="text-[0.58rem] font-mono uppercase tracking-[0.12em] text-muted-foreground">available</p>
          </div>
        </div>
      </header>

      <section
        className="parch-archive relative isolate overflow-hidden rounded-[2rem] border border-[#d5ad63]/35 bg-[#16343a] text-[#f6ead0] shadow-[0_18px_52px_rgba(20,43,48,0.18)] outline-none"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") select(selectedIndex - 1)
          if (event.key === "ArrowRight") select(selectedIndex + 1)
        }}
        onPointerDown={(event) => { pointerStart.current = event.clientX }}
        onPointerUp={(event) => handlePointerUp(event.clientX)}
        onPointerCancel={() => { pointerStart.current = null }}
      >
        <div className="parch-grid absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="parch-glow absolute left-1/2 top-[10rem] h-64 w-64 -translate-x-1/2 rounded-full opacity-70 blur-3xl" aria-hidden="true" />
        <span className="parch-star left-[9%] top-[7%]" aria-hidden="true">✦</span>
        <span className="parch-star right-[12%] top-[11%] [animation-delay:900ms]" aria-hidden="true">✧</span>
        <span className="parch-star left-[17%] top-[28%] [animation-delay:1500ms]" aria-hidden="true">✧</span>

        <div className="relative px-5 pb-5 pt-5 sm:px-7 sm:pb-7">
          <div className="flex items-center justify-between gap-4 font-mono text-[0.6rem] uppercase tracking-[0.17em] text-[#c6b78f]">
            <span>{selectedLore.rarity}</span>
            <span>Entry {String(selectedIndex + 1).padStart(2, "0")} / {String(weaverColors.length).padStart(2, "0")}</span>
          </div>

          <div className="relative mx-auto mt-4 flex min-h-[15.5rem] max-w-[25rem] flex-col items-center justify-center text-center sm:min-h-[17rem]">
            <div className="parch-orbit absolute left-1/2 top-1/2 h-[13.5rem] w-[13.5rem] -translate-x-1/2 -translate-y-[54%] rounded-full sm:h-[15rem] sm:w-[15rem]" aria-hidden="true" />
            <div className="parch-orbit parch-orbit-inner absolute left-1/2 top-1/2 h-[10.5rem] w-[10.5rem] -translate-x-1/2 -translate-y-[58%] rounded-full sm:h-[12rem] sm:w-[12rem]" aria-hidden="true" />
            <div key={selected.id} className="parch-reveal relative z-10 flex h-[10.5rem] w-[13.5rem] items-center justify-center sm:h-[12rem] sm:w-[15rem]">
              <Weaver size={190} colorId={selected.id} className="max-h-full max-w-full drop-shadow-[0_14px_16px_rgba(0,0,0,0.18)]" />
            </div>
            <p className="relative z-10 mt-1 font-mono text-[0.59rem] uppercase tracking-[0.2em] text-[#d9b463]">{selectedLore.rarity}</p>
            <h2 className="relative z-10 mt-1 text-[1.55rem] font-semibold tracking-[-0.035em] text-[#f5dfaf]">{selected.name}</h2>
          </div>

          <div className="relative mt-2 rounded-[1.55rem] border border-[#d0aa61]/24 bg-[#17373d]/88 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex rounded-full border border-[#b6a16e]/30 px-2.5 py-1 font-mono text-[0.56rem] uppercase tracking-[0.15em] text-[#bdb38f]">{selectedLore.rarity}</div>
              <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-[#8ea2a0]">Archive {String(selectedIndex + 1).padStart(2, "0")}</span>
            </div>

            <h3 className="mt-4 text-[1.42rem] font-semibold leading-tight tracking-[-0.03em] text-[#f2d69c]">{selectedLore.title}</h3>
            <p className="mt-2 max-w-[29rem] text-sm leading-relaxed text-[#aebfbc]">{selected.description}</p>

            <div className="mt-5 flex items-center gap-3">
              <button type="button" onClick={() => select(selectedIndex - 1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#c2a45d]/32 bg-transparent text-[#d8bb78] hover:bg-white/5" aria-label="Previous Parch">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => select(selectedIndex + 1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#c2a45d]/32 bg-transparent text-[#d8bb78] hover:bg-white/5" aria-label="Next Parch">
                <ArrowRight className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[0.7rem] font-medium text-[#92a6a3]">Browse the collection</p>
                <div className="mt-2 flex gap-1.5">
                  {weaverColors.map((item, index) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => select(index)}
                      className={`h-1.5 rounded-full transition-all ${index === selectedIndex ? "w-5 bg-[#ddb55d]" : "w-1.5 bg-[#6d827f]/65 hover:bg-[#8da09d]"}`}
                      aria-label={`View ${item.name}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#bfa66c]/20 pt-4">
              <div>
                <p className="font-mono text-[0.56rem] uppercase tracking-[0.16em] text-[#c6a65f]">Archive note</p>
                <p className="mt-1 text-sm text-[#a9bbb8]">{selectedLore.note}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[0.56rem] uppercase tracking-[0.16em] text-[#c6a65f]">{owned ? "Collection status" : "Unlock with"}</p>
                <p className="mt-1 text-[1.25rem] font-semibold tracking-[-0.02em] text-[#e3bb64]">{owned ? (equipped ? "Equipped" : "Owned") : `${selected.cost} XP`}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={chooseSelected}
              disabled={equipped}
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] disabled:cursor-default ${equipped ? "bg-[#283f43] text-[#b6c0bd] shadow-none" : owned ? "bg-[#eee1c1] text-[#24383a] hover:bg-[#f6e9c9]" : affordable ? "bg-brand text-brand-foreground hover:brightness-[1.03]" : "bg-[#566568] text-[#d3d9d7] hover:bg-[#607174]"}`}
            >
              {equipped ? <><Check className="h-4 w-4" />Equipped</> : owned ? "Equip Parch" : <><Sparkles className="h-4 w-4" />Unlock for {selected.cost} XP</>}
            </button>
          </div>

          <p className="mt-3 text-center text-[0.62rem] leading-relaxed text-[#76908d]">Swipe, use the arrows, or tap a marker to browse.</p>
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
          This will use <strong className="font-semibold text-foreground">{pendingPurchase.cost} XP</strong> and automatically equip the new Parch. You will have <strong className="font-semibold text-foreground">{state.xpBalance - pendingPurchase.cost} XP</strong> left.
        </ConfirmDialog>
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
