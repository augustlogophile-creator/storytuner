type BackendLogLevel = "info" | "warn" | "error"
type BackendLogData = Record<string, unknown>

function cleanError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message.slice(0, 800),
    }
  }
  if (error && typeof error === "object") {
    const value = error as { name?: unknown; message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
    return {
      name: typeof value.name === "string" ? value.name.slice(0, 120) : undefined,
      message: typeof value.message === "string" ? value.message.slice(0, 800) : String(error).slice(0, 800),
      code: typeof value.code === "string" ? value.code.slice(0, 120) : undefined,
      details: typeof value.details === "string" ? value.details.slice(0, 800) : undefined,
      hint: typeof value.hint === "string" ? value.hint.slice(0, 500) : undefined,
    }
  }
  return { message: String(error).slice(0, 800) }
}

export function backendLog(level: BackendLogLevel, event: string, data: BackendLogData = {}) {
  const payload = JSON.stringify({
    source: "storytuner-backend",
    event,
    at: new Date().toISOString(),
    ...data,
  })
  if (level === "error") console.error(payload)
  else if (level === "warn") console.warn(payload)
  else console.info(payload)
}

export function backendError(event: string, error: unknown, data: BackendLogData = {}) {
  backendLog("error", event, { ...data, error: cleanError(error) })
}

export function shortUserId(userId: string) {
  return userId.length > 12 ? `${userId.slice(0, 8)}…` : userId
}
