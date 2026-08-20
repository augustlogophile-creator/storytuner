"use client"

import { useEffect, useMemo, useState } from "react"

type NotificationResponse = { latestAt?: string | null }

export function notificationSeenKey(userId: string | null | undefined) {
  return `tellwise:notifications:last-seen:${userId || "guest"}`
}

export function useNotificationUnread({ userId, streak, activityDates }: { userId: string | null; streak: number; activityDates: string[] }) {
  const [communityLatestAt, setCommunityLatestAt] = useState<string | null>(null)
  const [seenAt, setSeenAt] = useState<string | null>(null)

  useEffect(() => {
    try { setSeenAt(localStorage.getItem(notificationSeenKey(userId))) } catch { setSeenAt(null) }
    let cancelled = false
    fetch("/api/notifications?limit=1", { cache: "no-store", headers: { Accept: "application/json" } })
      .then(async (response) => response.ok ? response.json() as Promise<NotificationResponse> : null)
      .then((payload) => {
        if (!cancelled) setCommunityLatestAt(payload?.latestAt ?? null)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [userId])

  const practiceLatestAt = useMemo(() => {
    if (streak <= 0 || activityDates.length === 0) return null
    const latest = [...activityDates].sort().at(-1)
    return latest ? `${latest}T12:00:00` : null
  }, [activityDates, streak])

  const latestAt = [communityLatestAt, practiceLatestAt]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null

  return Boolean(latestAt && (!seenAt || new Date(latestAt).getTime() > new Date(seenAt).getTime()))
}
