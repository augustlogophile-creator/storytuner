import "server-only"
const STRIPE_API = "https://api.stripe.com/v1"
const STRIPE_VERSION = "2025-06-30.basil"
const STRIPE_TIMEOUT_MS = 15_000

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is missing.")
  return key
}

function encode(params: Record<string, string | number | boolean | undefined>) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) body.set(key, String(value))
  }
  return body
}

type StripeRequestOptions = { idempotencyKey?: string }

async function stripeRequest<T>(
  path: string,
  init: RequestInit,
  options: StripeRequestOptions = {},
) {
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${secretKey()}`)
  headers.set("Stripe-Version", STRIPE_VERSION)
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey.slice(0, 255))

  let response: Response
  try {
    response = await fetch(`${STRIPE_API}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Stripe request timed out.")
    }
    throw error
  }

  const text = await response.text()
  let payload: (T & { error?: { message?: string } }) | null = null
  try {
    payload = text ? JSON.parse(text) as T & { error?: { message?: string } } : null
  } catch {
    // Keep malformed upstream bodies out of user-facing responses.
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Stripe request failed (${response.status}).`)
  }
  if (!payload) throw new Error("Stripe returned an invalid response.")
  return payload
}

export async function stripePost<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  options?: StripeRequestOptions,
) {
  return stripeRequest<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: encode(params),
  }, options)
}

export async function stripeDelete<T>(path: string) {
  return stripeRequest<T>(path, { method: "DELETE" })
}

export async function stripeGet<T>(path: string) {
  return stripeRequest<T>(path, { method: "GET" })
}

export async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(",")
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2)
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3))
  if (!timestamp || signatures.length === 0) return false

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (!Number.isFinite(age) || age > 300) return false

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`))
  const expected = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
  return signatures.some((value) => timingSafeEqual(expected, value))
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}
