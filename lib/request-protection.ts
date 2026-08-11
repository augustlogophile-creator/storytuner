import { backendLog } from "@/lib/backend-log"

type RateRule = { limit: number; windowMs: number; label?: string }
type BucketStore = Map<string, number[]>

type IdempotentEntry<T> = {
  expiresAt: number
  promise: Promise<T>
}

type IdempotentStore = Map<string, IdempotentEntry<unknown>>

const globalStore = globalThis as typeof globalThis & {
  __storytunerRateBuckets?: BucketStore
  __storytunerIdempotent?: IdempotentStore
}

const rateBuckets = globalStore.__storytunerRateBuckets ?? new Map<string, number[]>()
const idempotent = globalStore.__storytunerIdempotent ?? new Map<string, IdempotentEntry<unknown>>()
globalStore.__storytunerRateBuckets = rateBuckets
globalStore.__storytunerIdempotent = idempotent

export function rateLimitUser(userId: string, action: string, rules: RateRule[]) {
  const now = Date.now()
  for (const rule of rules) {
    const key = `${action}:${userId}:${rule.windowMs}`
    const cutoff = now - rule.windowMs
    const recent = (rateBuckets.get(key) ?? []).filter((timestamp) => timestamp > cutoff)
    if (recent.length >= rule.limit) {
      const retryAfterMs = Math.max(1000, recent[0] + rule.windowMs - now)
      backendLog("warn", "rate_limit_blocked", {
        action,
        userId,
        rule: rule.label ?? `${rule.limit}/${rule.windowMs}`,
        retryAfterMs,
      })
      return {
        allowed: false as const,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      }
    }
    recent.push(now)
    rateBuckets.set(key, recent)
  }
  pruneStores(now)
  return { allowed: true as const, retryAfterSeconds: 0 }
}

export function rateLimitResponse(result: { allowed: boolean; retryAfterSeconds: number }, message = "Too many requests. Wait a moment and try again.") {
  if (result.allowed) return null
  return Response.json(
    { code: "RATE_LIMITED", error: message, retryAfterSeconds: result.retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds), "Cache-Control": "no-store" } },
  )
}

export function rejectLargeRequest(request: Request, maxBytes: number) {
  const raw = request.headers.get("content-length")
  if (!raw) return null
  const size = Number(raw)
  if (!Number.isFinite(size) || size <= maxBytes) return null
  return Response.json(
    { code: "REQUEST_TOO_LARGE", error: "That request is too large." },
    { status: 413, headers: { "Cache-Control": "no-store" } },
  )
}

export function runIdempotent<T>(key: string, task: () => Promise<T>, ttlMs = 90_000): Promise<T> {
  const now = Date.now()
  const existing = idempotent.get(key) as IdempotentEntry<T> | undefined
  if (existing && existing.expiresAt > now) return existing.promise

  const promise = task().catch((error) => {
    idempotent.delete(key)
    throw error
  })
  idempotent.set(key, { expiresAt: now + ttlMs, promise } as IdempotentEntry<unknown>)
  pruneStores(now)
  return promise
}

function pruneStores(now: number) {
  if (rateBuckets.size > 1500) {
    for (const [key, timestamps] of rateBuckets) {
      const recent = timestamps.filter((timestamp) => timestamp > now - 60 * 60 * 1000)
      if (recent.length) rateBuckets.set(key, recent)
      else rateBuckets.delete(key)
    }
  }
  if (idempotent.size > 1000) {
    for (const [key, entry] of idempotent) {
      if (entry.expiresAt <= now) idempotent.delete(key)
    }
  }
}

export function requestFingerprint(...parts: Array<string | number | boolean | null | undefined>) {
  const input = parts.map((part) => String(part ?? "")).join("\u001f")
  let hashA = 2166136261
  let hashB = 2246822519
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index)
    hashA = Math.imul(hashA ^ code, 16777619)
    hashB = Math.imul(hashB ^ code, 3266489917)
  }
  return `${(hashA >>> 0).toString(36)}${(hashB >>> 0).toString(36)}`
}
