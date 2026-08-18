export type SupportedAudioMime = "audio/webm" | "video/webm" | "audio/ogg" | "audio/mpeg" | "audio/mp4" | "audio/wav" | "audio/x-wav"

type AudioContainer = "webm" | "ogg" | "mpeg" | "mp4" | "wav"

const MIME_TO_CONTAINER: Record<SupportedAudioMime, AudioContainer> = {
  "audio/webm": "webm",
  "video/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mpeg",
  "audio/mp4": "mp4",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
}

export const SUPPORTED_AUDIO_MIME_TYPES = new Set<SupportedAudioMime>(Object.keys(MIME_TO_CONTAINER) as SupportedAudioMime[])

export function normalizeSupportedAudioMime(value: string): SupportedAudioMime | null {
  const base = value.toLowerCase().split(";", 1)[0]?.trim() ?? ""
  return SUPPORTED_AUDIO_MIME_TYPES.has(base as SupportedAudioMime) ? base as SupportedAudioMime : null
}

export function detectAudioContainer(bytes: Uint8Array): AudioContainer | null {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm"
  if (ascii(bytes, 0, 4) === "OggS") return "ogg"
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") return "wav"
  if (bytes.length >= 8 && ascii(bytes, 4, 4) === "ftyp") return "mp4"
  if (ascii(bytes, 0, 3) === "ID3") return "mpeg"
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "mpeg"
  return null
}

export function audioSignatureMatches(bytes: Uint8Array, declaredMime: string) {
  const mime = normalizeSupportedAudioMime(declaredMime)
  if (!mime) return false
  const detected = detectAudioContainer(bytes)
  return detected !== null && detected === MIME_TO_CONTAINER[mime]
}

export async function blobHasValidAudioSignature(blob: Blob, declaredMime = blob.type) {
  if (blob.size <= 0) return false
  const header = new Uint8Array(await blob.slice(0, 4096).arrayBuffer())
  return audioSignatureMatches(header, declaredMime)
}

export function extensionForAudioMime(value: string) {
  const mime = normalizeSupportedAudioMime(value)
  if (mime === "audio/ogg") return "ogg"
  if (mime === "audio/mpeg") return "mp3"
  if (mime === "audio/mp4") return "m4a"
  if (mime === "audio/wav" || mime === "audio/x-wav") return "wav"
  return "webm"
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  if (bytes.length < start + length) return ""
  let result = ""
  for (let index = start; index < start + length; index += 1) result += String.fromCharCode(bytes[index]!)
  return result
}
