export const MAX_PRIVATE_RECORDING_BYTES = 24 * 1024 * 1024
export const MAX_DIRECT_TRANSCRIBE_BYTES = 4 * 1024 * 1024
export const AUDIO_SNIFF_BYTES = 64

export type SupportedAudioKind = "webm" | "ogg" | "mp3" | "mp4" | "wav"

const MIME_BY_KIND: Record<SupportedAudioKind, readonly string[]> = {
  webm: ["audio/webm", "video/webm"],
  ogg: ["audio/ogg", "application/ogg"],
  mp3: ["audio/mpeg", "audio/mp3"],
  mp4: ["audio/mp4", "video/mp4", "audio/x-m4a"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave"],
}

const EXTENSION_BY_KIND: Record<SupportedAudioKind, string> = {
  webm: "webm",
  ogg: "ogg",
  mp3: "mp3",
  mp4: "m4a",
  wav: "wav",
}

export function normalizeDeclaredAudioType(value: string | null | undefined) {
  return (value || "").toLowerCase().split(";", 1)[0]?.trim() ?? ""
}

export function declaredTypeIsSupported(value: string | null | undefined) {
  const normalized = normalizeDeclaredAudioType(value)
  return Object.values(MIME_BY_KIND).some((values) => values.includes(normalized))
}

export function detectAudioKind(bytes: Uint8Array): SupportedAudioKind | null {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "webm"
  }
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS") return "ogg"
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WAVE") return "wav"
  if (bytes.length >= 3 && ascii(bytes, 0, 3) === "ID3") return "mp3"
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "mp3"
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp") return "mp4"
  return null
}

export function validateAudioSignature(bytes: Uint8Array, declaredType?: string | null) {
  const kind = detectAudioKind(bytes)
  if (!kind) {
    return { ok: false as const, error: "The recording does not contain a recognized audio file signature." }
  }

  const normalized = normalizeDeclaredAudioType(declaredType)
  if (normalized && !MIME_BY_KIND[kind].includes(normalized)) {
    return { ok: false as const, error: "The recording content does not match its declared file type." }
  }

  return {
    ok: true as const,
    kind,
    contentType: MIME_BY_KIND[kind][0],
    extension: EXTENSION_BY_KIND[kind],
  }
}

export async function readRequestBodyWithLimit(request: Request, maxBytes: number) {
  const contentEncoding = request.headers.get("content-encoding")?.trim().toLowerCase()
  if (contentEncoding && contentEncoding !== "identity") {
    return {
      ok: false as const,
      response: Response.json(
        { code: "UNSUPPORTED_CONTENT_ENCODING", error: "Compressed uploads are not accepted." },
        { status: 415, headers: { "Cache-Control": "no-store" } },
      ),
    }
  }

  const rawLength = request.headers.get("content-length")
  if (rawLength) {
    const contentLength = Number(rawLength)
    if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > maxBytes) {
      return { ok: false as const, response: tooLargeResponse(maxBytes) }
    }
  }

  if (!request.body) {
    return {
      ok: false as const,
      response: Response.json(
        { code: "EMPTY_UPLOAD", error: "No recording was provided." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
    }
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel("upload limit exceeded").catch(() => undefined)
        return { ok: false as const, response: tooLargeResponse(maxBytes) }
      }
      chunks.push(value)
    }
  } catch {
    return {
      ok: false as const,
      response: Response.json(
        { code: "UPLOAD_READ_FAILED", error: "The recording upload could not be read." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
    }
  } finally {
    reader.releaseLock()
  }

  if (total <= 0) {
    return {
      ok: false as const,
      response: Response.json(
        { code: "EMPTY_UPLOAD", error: "No recording was provided." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
    }
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { ok: true as const, bytes }
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  let value = ""
  for (let index = start; index < end && index < bytes.length; index += 1) value += String.fromCharCode(bytes[index])
  return value
}

function tooLargeResponse(maxBytes: number) {
  const maxMb = Math.floor(maxBytes / (1024 * 1024))
  return Response.json(
    { code: "REQUEST_TOO_LARGE", error: `That recording is too large. The maximum upload size is ${maxMb} MB.` },
    { status: 413, headers: { "Cache-Control": "no-store" } },
  )
}
