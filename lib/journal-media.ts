"use client"

import { createClient } from "@/lib/supabase/client"

export const JOURNAL_MEDIA_BUCKET = "tellwise-journal-media"
export const MAX_JOURNAL_MEDIA_BYTES = 20 * 1024 * 1024

export type JournalMediaKind = "audio" | "video"

export type JournalMediaEntry = {
  id: string
  user_id: string
  title: string
  body: string
  entry_type: "text" | JournalMediaKind
  media_storage_path: string | null
  media_content_type: string | null
  media_size_bytes: number | null
  media_duration_seconds: number | null
  created_at: string
  updated_at: string
}

type SniffedMedia = {
  contentType: string
  extension: string
}

export async function createJournalMediaEntry({
  kind,
  blob,
  durationSeconds,
}: {
  kind: JournalMediaKind
  blob: Blob
  durationSeconds: number
}) {
  if (!blob.size) throw new Error("The recording did not contain any media.")
  if (blob.size > MAX_JOURNAL_MEDIA_BYTES) {
    throw new Error("This Journal recording is too large. Keep it under 20 MB or make a shorter recording.")
  }

  const sniffed = await sniffMedia(blob, kind)
  const supabase = createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) throw new Error("Please sign in again before saving this Journal recording.")

  const id = crypto.randomUUID()
  const storagePath = `${authData.user.id}/${id}.${sniffed.extension}`
  const safeDuration = Math.max(1, Math.min(kind === "video" ? 180 : 600, Math.round(durationSeconds || 1)))
  const title = "Untitled"
  const body = ""

  const { data: created, error: rowError } = await supabase
    .from("journal_entries")
    .insert({
      id,
      user_id: authData.user.id,
      title,
      body,
      entry_type: kind,
      media_storage_path: storagePath,
      media_content_type: sniffed.contentType,
      media_size_bytes: blob.size,
      media_duration_seconds: safeDuration,
    })
    .select("id,user_id,title,body,entry_type,media_storage_path,media_content_type,media_size_bytes,media_duration_seconds,created_at,updated_at")
    .single<JournalMediaEntry>()

  if (rowError || !created) throw new Error(rowError?.message || "Tellwise could not prepare this Journal recording.")

  const { error: uploadError } = await supabase.storage
    .from(JOURNAL_MEDIA_BUCKET)
    .upload(storagePath, blob, {
      contentType: sniffed.contentType,
      cacheControl: "3600",
      upsert: false,
    })

  if (uploadError) {
    await supabase.from("journal_entries").delete().eq("id", id)
    throw new Error(`The private Journal upload failed. ${uploadError.message}`)
  }

  return created
}

export async function createSignedJournalMediaUrl(storagePath: string, expiresInSeconds = 3600) {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(JOURNAL_MEDIA_BUCKET)
    .createSignedUrl(storagePath, Math.max(60, Math.min(86400, Math.round(expiresInSeconds))))
  if (error || !data?.signedUrl) throw new Error(error?.message || "This private Journal recording is unavailable.")
  return data.signedUrl
}

export async function deleteJournalMedia(storagePath: string) {
  if (!storagePath) return
  const supabase = createClient()
  const { error } = await supabase.storage.from(JOURNAL_MEDIA_BUCKET).remove([storagePath])
  if (error) throw new Error(`The private Journal recording could not be deleted. ${error.message}`)
}

async function sniffMedia(blob: Blob, kind: JournalMediaKind): Promise<SniffedMedia> {
  const bytes = new Uint8Array(await blob.slice(0, 64).arrayBuffer())
  const type = (blob.type || "").split(";")[0].trim().toLowerCase()

  const isWebm = bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
  const isMp4 = bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp"
  const isOgg = kind === "audio" && bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS"
  const isWav = kind === "audio" && bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WAVE"
  const isMp3 = kind === "audio" && (
    (bytes.length >= 3 && ascii(bytes, 0, 3) === "ID3")
    || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  )

  if (kind === "video") {
    if (isWebm && (type === "video/webm" || type === "")) return { contentType: "video/webm", extension: "webm" }
    if (isMp4 && ["video/mp4", "video/quicktime", ""].includes(type)) return { contentType: "video/mp4", extension: "mp4" }
    throw new Error("That file does not look like a supported private video recording.")
  }

  if (isWebm && ["audio/webm", "video/webm", ""].includes(type)) return { contentType: "audio/webm", extension: "webm" }
  if (isMp4 && ["audio/mp4", "audio/x-m4a", "video/mp4", ""].includes(type)) return { contentType: "audio/mp4", extension: "m4a" }
  if (isOgg) return { contentType: "audio/ogg", extension: "ogg" }
  if (isWav) return { contentType: "audio/wav", extension: "wav" }
  if (isMp3) return { contentType: "audio/mpeg", extension: "mp3" }
  throw new Error("That file does not look like a supported private audio recording.")
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  let value = ""
  for (let index = start; index < end && index < bytes.length; index += 1) value += String.fromCharCode(bytes[index])
  return value
}
