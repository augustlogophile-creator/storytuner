const STRIPE_API = "https://api.stripe.com/v1"
const STRIPE_VERSION = "2025-06-30.basil"

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

export async function stripePost<T>(path: string, params: Record<string, string | number | boolean | undefined>) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_VERSION,
    },
    body: encode(params),
    cache: "no-store",
  })
  const payload = await response.json() as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message || `Stripe request failed (${response.status}).`)
  return payload
}

export async function stripeGet<T>(path: string) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Stripe-Version": STRIPE_VERSION,
    },
    cache: "no-store",
  })
  const payload = await response.json() as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message || `Stripe request failed (${response.status}).`)
  return payload
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
