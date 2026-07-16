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
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim()
  const raw = configured || vercel || "http://localhost:3000"
  const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`
  return withProtocol.replace(/\/$/, "")
}
