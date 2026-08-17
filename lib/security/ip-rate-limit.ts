type IpRateRule = { limit: number; windowMs: number; label: string }
type IpBucketStore = Map<string, number[]>

const globalStore = globalThis as typeof globalThis & {
  __storytunerIpRateBuckets?: IpBucketStore
}

const buckets = globalStore.__storytunerIpRateBuckets ?? new Map<string, number[]>()
globalStore.__storytunerIpRateBuckets = buckets

const GENERAL_API_RULES: IpRateRule[] = [
  { limit: 180, windowMs: 60_000, label: "180/min" },
  { limit: 3_000, windowMs: 60 * 60_000, label: "3000/hour" },
]
const AI_API_RULES: IpRateRule[] = [
  { limit: 120, windowMs: 5 * 60_000, label: "120/5min" },
  { limit: 500, windowMs: 60 * 60_000, label: "500/hour" },
]
const AUTH_RULES: IpRateRule[] = [
  { limit: 40, windowMs: 10 * 60_000, label: "40/10min" },
]
const ACCOUNT_SETUP_RULES: IpRateRule[] = [
  { limit: 30, windowMs: 10 * 60_000, label: "30/10min" },
  { limit: 100, windowMs: 60 * 60_000, label: "100/hour" },
]

export function checkIpRateLimit(request: Request) {
  const url = new URL(request.url)
  const pathname = url.pathname

  // Provider-signed/background endpoints are protected by their own secrets and
  // must not share a browser-IP bucket with normal app traffic.
  if (pathname === "/api/stripe/webhook" || pathname === "/api/cron/maintenance") {
    return { allowed: true as const, retryAfterSeconds: 0, label: "provider-exempt" }
  }

  const rules = pathname === "/auth/callback"
    ? AUTH_RULES
    : pathname === "/api/account/setup"
      ? ACCOUNT_SETUP_RULES
      : isAiCostEndpoint(pathname)
        ? AI_API_RULES
        : pathname.startsWith("/api/")
          ? GENERAL_API_RULES
          : null

  if (!rules) return { allowed: true as const, retryAfterSeconds: 0, label: "not-rate-limited" }

  const keyBase = `ip:${clientKey(request)}:${rateFamily(pathname)}`
  const now = Date.now()
  const prepared = rules.map((rule) => {
    const key = `${keyBase}:${rule.windowMs}`
    const cutoff = now - rule.windowMs
    const recent = (buckets.get(key) ?? []).filter((timestamp) => timestamp > cutoff)
    return { key, rule, recent }
  })

  for (const item of prepared) {
    if (item.recent.length >= item.rule.limit) {
      const retryAfterMs = Math.max(1_000, item.recent[0] + item.rule.windowMs - now)
      return {
        allowed: false as const,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1_000),
        label: item.rule.label,
      }
    }
  }

  for (const item of prepared) {
    item.recent.push(now)
    buckets.set(item.key, item.recent)
  }
  prune(now)
  return { allowed: true as const, retryAfterSeconds: 0, label: rules[0]?.label ?? "allowed" }
}

function isAiCostEndpoint(pathname: string) {
  return pathname === "/api/coach"
    || pathname === "/api/feedback"
    || pathname === "/api/planner"
    || pathname === "/api/transcribe"
    || pathname === "/api/ai/report"
}

function rateFamily(pathname: string) {
  if (pathname === "/auth/callback") return "auth"
  if (pathname === "/api/account/setup") return "account-setup"
  if (isAiCostEndpoint(pathname)) return "ai"
  return "api"
}

function clientKey(request: Request) {
  const headers = request.headers
  const vercelForwarded = firstIp(headers.get("x-vercel-forwarded-for"))
  const forwarded = firstIp(headers.get("x-forwarded-for"))
  const real = firstIp(headers.get("x-real-ip"))
  const ip = vercelForwarded || forwarded || real
  if (ip) return ip.slice(0, 96)

  // This fallback is intentionally coarse. Vercel supplies forwarded IP headers
  // in production; the fallback merely avoids putting every header-less local
  // request into one bucket.
  const ua = (headers.get("user-agent") ?? "unknown").slice(0, 160)
  const language = (headers.get("accept-language") ?? "").slice(0, 80)
  return `fallback-${smallHash(`${ua}\u001f${language}`)}`
}

function firstIp(value: string | null) {
  if (!value) return ""
  const first = value.split(",", 1)[0]?.trim() ?? ""
  return /^[0-9a-fA-F:.]+$/.test(first) ? first : ""
}

function smallHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  }
  return (hash >>> 0).toString(36)
}

function prune(now: number) {
  if (buckets.size <= 4_000) return
  for (const [key, timestamps] of buckets) {
    const recent = timestamps.filter((timestamp) => timestamp > now - 60 * 60_000)
    if (recent.length) buckets.set(key, recent)
    else buckets.delete(key)
  }
}
