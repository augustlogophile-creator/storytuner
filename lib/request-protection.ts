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

/**
 * Best-effort per-instance limiter. Expensive AI routes also use database-backed
 * usage checks so limits survive serverless instance changes.
 */
export function rateLimitUser(userId: string, action: string, rules: RateRule[]) {
  const now = Date.now()
  const prepared = rules.map((rule) => {
    const key = `${action}:${userId}:${rule.windowMs}`
    const cutoff = now - rule.windowMs
    const recent = (rateBuckets.get(key) ?? []).filter((timestamp) => timestamp > cutoff)
    return { rule, key, recent }
  })

  for (const item of prepared) {
    if (item.recent.length >= item.rule.limit) {
      const retryAfterMs = Math.max(1000, item.recent[0] + item.rule.windowMs - now)
      backendLog("warn", "rate_limit_blocked", {
        action,
        userId,
        rule: item.rule.label ?? `${item.rule.limit}/${item.rule.windowMs}`,
        retryAfterMs,
      })
      return {
        allowed: false as const,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      }
    }
  }

  // Record the request only after every rule has passed. This prevents a request
  // rejected by a long window from consuming capacity in a shorter window too.
  for (const item of prepared) {
    item.recent.push(now)
    rateBuckets.set(item.key, item.recent)
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
  return requestTooLargeResponse()
}

/**
 * Reads JSON while enforcing the limit even when Content-Length is absent or
 * inaccurate. This closes the common chunked-body gap left by header-only checks.
 */
export async function readJsonBody(request: Request, maxBytes: number) {
  const headerRejection = rejectLargeRequest(request, maxBytes)
  if (headerRejection) return { ok: false as const, response: headerRejection }

  try {
    const text = await request.text()
    const byteLength = new TextEncoder().encode(text).byteLength
    if (byteLength > maxBytes) {
      return { ok: false as const, response: requestTooLargeResponse() }
    }
    if (!text.trim()) {
      return {
        ok: false as const,
        response: Response.json(
          { code: "INVALID_JSON", error: "The request body is empty." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        ),
      }
    }
    return { ok: true as const, value: JSON.parse(text) as unknown }
  } catch {
    return {
      ok: false as const,
      response: Response.json(
        { code: "INVALID_JSON", error: "The request body could not be read." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
    }
  }
}

/**
 * Defense-in-depth CSRF protection for browser mutations. Supabase session
 * cookies are already same-site, but Tellwise also rejects cross-origin and ambiguous
 * POST/PATCH/DELETE requests before any privileged server work begins.
 */
export function requireSameOrigin(request: Request) {
  const requestOrigin = new URL(request.url).origin
  const origin = request.headers.get("origin")
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase() ?? ""

  // Exact Origin wins when present. This deliberately rejects a sibling
  // subdomain even though the browser may classify it as "same-site".
  if (origin) {
    try {
      if (new URL(origin).origin !== requestOrigin) return crossSiteResponse()
    } catch {
      return crossSiteResponse()
    }
    if (fetchSite && !["same-origin", "none"].includes(fetchSite)) return crossSiteResponse()
    return null
  }

  // Browser mutation routes fail closed when Origin is missing. The only
  // tolerated fallback is an explicit browser assertion of same-origin.
  if (fetchSite !== "same-origin") return crossSiteResponse()
  return null
}


export function rejectUnexpectedJsonFields(value: unknown, allowedFields: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Response.json(
      { code: "INVALID_REQUEST", error: "The request body must be a JSON object." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }
  const allowed = new Set(allowedFields)
  const unexpected = Object.keys(value as Record<string, unknown>).filter((key) => !allowed.has(key))
  if (!unexpected.length) return null
  return Response.json(
    { code: "UNEXPECTED_FIELDS", error: "The request included unsupported fields." },
    { status: 400, headers: { "Cache-Control": "no-store" } },
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

function requestTooLargeResponse() {
  return Response.json(
    { code: "REQUEST_TOO_LARGE", error: "That request is too large." },
    { status: 413, headers: { "Cache-Control": "no-store" } },
  )
}

function crossSiteResponse() {
  return Response.json(
    { code: "CROSS_SITE_REQUEST_BLOCKED", error: "This request was blocked for security reasons." },
    { status: 403, headers: { "Cache-Control": "no-store", "Vary": "Origin" } },
  )
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
