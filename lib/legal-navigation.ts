export type LegalSearchRecord = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export function legalBackTarget(params: LegalSearchRecord) {
  const from = first(params.from)
  const mode = first(params.mode)

  if (from === "auth") {
    return {
      href: mode === "sign-in" ? "/sign-up?mode=sign-in" : "/sign-up",
      label: "Back",
    }
  }

  // `profile` is kept for compatibility with links from the previous build.
  if (from === "legal-profile" || from === "profile") {
    return { href: "/legal?from=profile", label: "Back" }
  }

  if (from === "legal") {
    return { href: "/legal", label: "Back" }
  }

  return { href: "/", label: "Tellwise" }
}

export function legalChildHref(path: string, params: LegalSearchRecord) {
  const from = first(params.from)
  const mode = first(params.mode)
  const query = new URLSearchParams()

  if (from) query.set("from", from)
  if (from === "auth" && mode === "sign-in") query.set("mode", "sign-in")

  const suffix = query.toString()
  return suffix ? `${path}?${suffix}` : path
}
