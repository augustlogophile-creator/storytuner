"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Bell, Flame, Heart, Loader2, MessageCircle, Sparkles } from "lucide-react"
import { useApp } from "@/lib/app-state"
import { notificationSeenKey } from "@/components/notifications/use-notification-unread"

type CommunityNotification = {
  id: string
  kind: "post_like" | "post_reply" | "reply_like" | "reply_reply"
  actor: { username: string; displayName: string }
  text: string
  createdAt: string
  href: string
}

type Filter = "all" | "community" | "practice"

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return "Recently"
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return "Now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value))
}

export function NotificationsClient() {
  const { state } = useApp()
  const [community, setCommunity] = useState<CommunityNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        const response = await fetch("/api/notifications?limit=50", { cache: "no-store", headers: { Accept: "application/json" } })
        const payload = await response.json() as { items?: CommunityNotification[]; error?: string }
        if (!response.ok) throw new Error(payload.error || "Notifications could not be loaded.")
        if (cancelled) return
        const items = payload.items ?? []
        setCommunity(items)
        const latestCommunity = items[0]?.createdAt ?? null
        const latestPractice = state.streak > 0 && state.activityDates.length
          ? `${[...state.activityDates].sort().at(-1)}T12:00:00`
          : null
        const latest = [latestCommunity, latestPractice]
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? new Date().toISOString()
        try { localStorage.setItem(notificationSeenKey(state.accountOwnerId), latest) } catch {}
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Notifications could not be loaded.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [state.accountOwnerId, state.activityDates, state.streak])

  const practice = useMemo(() => {
    if (state.streak <= 0) return []
    const latestDay = [...state.activityDates].sort().at(-1)
    const createdAt = latestDay ? `${latestDay}T12:00:00` : new Date().toISOString()
    const milestone = state.streak >= 3 && (state.streak === 3 || state.streak === 5 || state.streak % 7 === 0)
    return [{
      id: `streak:${state.streak}:${latestDay ?? "today"}`,
      createdAt,
      title: milestone ? `${state.streak}-day streak` : "Your streak is active",
      detail: milestone
        ? `You have practiced ${state.streak} days in a row. Keep the rhythm going.`
        : `You are on a ${state.streak}-day streak. One more practice keeps it moving.`,
    }]
  }, [state.activityDates, state.streak])

  const showCommunity = filter === "all" || filter === "community"
  const showPractice = filter === "all" || filter === "practice"
  const empty = (!showCommunity || community.length === 0) && (!showPractice || practice.length === 0)

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/profile" prefetch className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Profile
        </Link>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand"><Bell className="h-4 w-4" /></span>
      </div>

      <header>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Updates for you</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Replies, likes, and streaks.</p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Notification filters">
        {(["all", "community", "practice"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${filter === value ? "border-brand/55 bg-brand-soft text-brand" : "border-border bg-card text-muted-foreground"}`}
          >
            {value === "all" ? "All" : value === "community" ? "Community" : "Practice"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-border bg-card px-5 py-10 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking updates...</div>
      ) : error ? (
        <div className="rounded-3xl border border-destructive/25 bg-card p-5 text-sm text-destructive">{error}</div>
      ) : empty ? (
        <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">You are all caught up</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">New updates appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.7rem] border border-border bg-card">
          {showPractice && practice.map((item) => (
            <div key={item.id} className="flex gap-3 border-b border-border px-4 py-4 last:border-b-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Flame className="h-4.5 w-4.5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold">{item.title}</p><span className="shrink-0 text-[0.65rem] text-muted-foreground">{relativeTime(item.createdAt)}</span></div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          ))}

          {showCommunity && community.map((item) => {
            const isLike = item.kind === "post_like" || item.kind === "reply_like"
            return (
              <div key={item.id} className="flex gap-3 border-b border-border px-4 py-4 last:border-b-0">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isLike ? "bg-rose-50 text-rose-500" : "bg-brand-soft text-brand"}`}>
                  {isLike ? <Heart className="h-4.5 w-4.5" /> : <MessageCircle className="h-4.5 w-4.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm leading-5"><span className="font-semibold">@{item.actor.username}</span> {item.text}</p>
                    <span className="shrink-0 text-[0.65rem] text-muted-foreground">{relativeTime(item.createdAt)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
