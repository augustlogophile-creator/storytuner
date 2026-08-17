export function safeInternalPath(value: string | null | undefined, fallback = "/home") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback
  try {
    const parsed = new URL(value, "https://storytuner.local")
    if (parsed.origin !== "https://storytuner.local") return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim()
  const raw = configured || vercel || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000")
  if (!raw) throw new Error("NEXT_PUBLIC_APP_URL is required in production")
  const withProtocol = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`
  const parsed = new URL(withProtocol)
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production")
  }
  return parsed.origin
}
