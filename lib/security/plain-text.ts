// React/JSX escaping remains the primary XSS defense. This helper is a
// conservative server-side second layer for values that are intentionally
// stored and rendered as plain text. It removes non-printing control bytes
// without HTML-decoding or HTML-encoding user content, which avoids both
// executable markup and double-encoding bugs.
const DISALLOWED_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

export function sanitizePlainText(value: string, options: { maxLength?: number; singleLine?: boolean } = {}) {
  let clean = value.normalize("NFC").replace(DISALLOWED_CONTROLS, "").replace(/\r\n?/g, "\n")
  if (options.singleLine) clean = clean.replace(/[\n\u2028\u2029]+/g, " ")
  clean = clean.trim()
  if (typeof options.maxLength === "number" && clean.length > options.maxLength) clean = clean.slice(0, options.maxLength)
  return clean
}
