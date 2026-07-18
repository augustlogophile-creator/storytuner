"use client"

import { createClient } from "@/lib/supabase/client"

const RECORDINGS_BUCKET = "storytuner-recordings"
const MAX_AUDIO_BYTES = 24 * 1024 * 1024
const ABANDONED_RECORDING_AGE_MS = 24 * 60 * 60 * 1000

export type CloudRecordingRef = {
  id: string
  storagePath: string
}

export type CloudRecordingStatus = "uploading" | "uploaded" | "transcribing" | "ready" | "failed"

export type CloudRecordingRow = {
  id: string
  user_id: string
  storage_path: string
  content_type: string
  size_bytes: number
  duration_seconds: number
  status: CloudRecordingStatus
  transcript: string | null
  title: string | null
  word_count: number | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export type CloudTranscriptionStage = "preparing" | "uploading" | "transcribing" | "saving"

type UploadAndTranscribeOptions = {
  blob: Blob
  durationSeconds: number
  onCreated?: (recording: CloudRecordingRef) => void
  onStage?: (stage: CloudTranscriptionStage) => void
}

type TranscriptionResponse = {
  recordingId?: string
  transcript?: string
  wordCount?: number
  status?: string
  error?: string
  details?: string
}

export async function uploadAndTranscribeRecording({
  blob,
  durationSeconds,
  onCreated,
  onStage,
}: UploadAndTranscribeOptions) {
  if (blob.size <= 0) throw new Error("The recording did not contain any audio.")
  if (blob.size > MAX_AUDIO_BYTES) {
    throw new Error("This recording is larger than the 24 MB transcription limit. Try recording with the camera off or choose a shorter target.")
  }

  const supabase = createClient()
  onStage?.("preparing")

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) throw new Error("Please log in again before transcribing this recording.")

  const id = crypto.randomUUID()
  const contentType = normalizeAudioContentType(blob.type)
  const storagePath = `${user.id}/${id}.${extensionFor(contentType)}`
  const cloudRef = { id, storagePath }

  const { error: rowError } = await supabase.from("recording_uploads").insert({
    id,
    user_id: user.id,
    storage_path: storagePath,
    content_type: contentType,
    size_bytes: blob.size,
    duration_seconds: Math.max(1, Math.min(1800, Math.round(durationSeconds))),
    status: "uploading",
  })

  if (rowError) {
    throw new Error(`Weaver could not prepare the private upload. ${rowError.message}`)
  }

  onCreated?.(cloudRef)

  try {
    onStage?.("uploading")
    const { error: uploadError } = await supabase.storage
      .from(RECORDINGS_BUCKET)
      .upload(storagePath, blob, {
        contentType,
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) throw new Error(`The private audio upload failed. ${uploadError.message}`)

    const { error: uploadedStatusError } = await supabase
      .from("recording_uploads")
      .update({ status: "uploaded", error_message: null })
      .eq("id", id)

    if (uploadedStatusError) {
      throw new Error(`The upload finished, but its status could not be saved. ${uploadedStatusError.message}`)
    }

    onStage?.("transcribing")
    const { data, error: functionError } = await supabase.functions.invoke<TranscriptionResponse>(
      "transcribe-recording",
      { body: { recordingId: id } },
    )

    if (functionError) {
      throw new Error(await edgeFunctionErrorMessage(functionError))
    }

    const transcript = typeof data?.transcript === "string" ? data.transcript.trim() : ""
    if (!transcript) throw new Error(data?.details || data?.error || "Weaver returned an empty transcript.")

    onStage?.("saving")
    const title = titleFromTranscript(transcript)
    const { error: titleError } = await supabase
      .from("recording_uploads")
      .update({ title, status: "ready", error_message: null })
      .eq("id", id)

    if (titleError) throw new Error(`The transcript finished, but its title could not be saved. ${titleError.message}`)

    return {
      ...cloudRef,
      transcript,
      title,
      wordCount: typeof data?.wordCount === "number" ? data.wordCount : meaningfulWordCount(transcript),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The recording could not be transcribed."
    try {
      await supabase
        .from("recording_uploads")
        .update({ status: "failed", error_message: message.slice(0, 500) })
        .eq("id", id)
    } catch {}
    try {
      await supabase.storage.from(RECORDINGS_BUCKET).remove([storagePath])
    } catch {}
    throw error
  }
}

export async function finalizeCloudRecording(
  recordingId: string,
  values: { title: string; transcript: string },
) {
  const supabase = createClient()
  const transcript = values.transcript.trim()
  const title = values.title.trim() || titleFromTranscript(transcript)
  const { error } = await supabase
    .from("recording_uploads")
    .update({
      title,
      transcript,
      word_count: meaningfulWordCount(transcript),
      status: "ready",
      error_message: null,
    })
    .eq("id", recordingId)
  if (error) throw new Error(error.message)
}

export async function listCloudRecordingHistory() {
  const supabase = createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return []

  await cleanupAbandonedCloudRecordings()

  const { data, error } = await supabase
    .from("recording_uploads")
    .select("id,user_id,storage_path,content_type,size_bytes,duration_seconds,status,transcript,title,word_count,error_message,created_at,updated_at")
    .eq("user_id", user.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) throw new Error(`Your private recording history could not be loaded. ${error.message}`)
  return (data ?? []) as CloudRecordingRow[]
}

export async function cleanupAbandonedCloudRecordings() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const cutoff = new Date(Date.now() - ABANDONED_RECORDING_AGE_MS).toISOString()
  const { data, error } = await supabase
    .from("recording_uploads")
    .select("id,storage_path")
    .eq("user_id", user.id)
    .in("status", ["uploading", "uploaded", "transcribing", "failed"])
    .lt("updated_at", cutoff)

  if (error || !data?.length) return

  const paths = data.map((row) => row.storage_path).filter(Boolean)
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(RECORDINGS_BUCKET).remove(paths)
    if (storageError) return
  }

  const ids = data.map((row) => row.id).filter(Boolean)
  if (ids.length) {
    try {
      await supabase.from("recording_uploads").delete().in("id", ids)
    } catch {}
  }
}

export async function createSignedCloudRecordingUrl(storagePath: string, expiresInSeconds = 3600) {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(storagePath, Math.max(60, Math.min(86400, Math.round(expiresInSeconds))))

  if (error || !data?.signedUrl) throw new Error(error?.message || "The private audio file is unavailable.")
  return data.signedUrl
}

export async function deleteCloudRecording(recording: CloudRecordingRef) {
  const supabase = createClient()
  const { error: storageError } = await supabase.storage.from(RECORDINGS_BUCKET).remove([recording.storagePath])
  if (storageError) throw new Error(`The private audio could not be deleted. ${storageError.message}`)

  const { error: rowError } = await supabase.from("recording_uploads").delete().eq("id", recording.id)
  if (rowError) throw new Error(`The recording history entry could not be deleted. ${rowError.message}`)
}

export async function deleteCloudRecordings(recordings: CloudRecordingRef[]) {
  if (!recordings.length) return
  const supabase = createClient()
  const paths = recordings.map((recording) => recording.storagePath).filter(Boolean)
  const ids = recordings.map((recording) => recording.id).filter(Boolean)

  if (paths.length) {
    const { error } = await supabase.storage.from(RECORDINGS_BUCKET).remove(paths)
    if (error) throw new Error(`Private recording audio could not be deleted. ${error.message}`)
  }

  if (ids.length) {
    const { error } = await supabase.from("recording_uploads").delete().in("id", ids)
    if (error) throw new Error(`Recording history entries could not be deleted. ${error.message}`)
  }
}

function normalizeAudioContentType(type: string) {
  const base = type.split(";")[0].trim().toLowerCase()
  if (["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav"].includes(base)) {
    return base
  }
  return "audio/webm"
}

function extensionFor(contentType: string) {
  if (contentType === "audio/ogg") return "ogg"
  if (contentType === "audio/mpeg") return "mp3"
  if (contentType === "audio/mp4") return "m4a"
  if (contentType === "audio/wav" || contentType === "audio/x-wav") return "wav"
  return "webm"
}

async function edgeFunctionErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : "Weaver could not start transcription."
  const context = (error as { context?: Response } | null)?.context
  if (!context || typeof context.clone !== "function") return fallback
  try {
    const payload = (await context.clone().json()) as TranscriptionResponse
    return payload.details || payload.error || fallback
  } catch {
    return fallback
  }
}

function meaningfulWordCount(text: string) {
  const fillerWords = new Set(["um", "uh", "erm", "hmm", "mhm", "ah", "eh"])
  const words = text.toLowerCase().match(/[a-z0-9]+(?:['’][a-z0-9]+)*/g) ?? []
  return words.filter((word) => !fillerWords.has(word)).length
}

function titleFromTranscript(text: string) {
  const sentence = text.split(/[.!?]/)[0]?.trim() || text.trim()
  const words = sentence.replace(/[^\w'’ -]/g, " ").split(/\s+/).filter(Boolean).slice(0, 7)
  return words.length ? words.join(" ") : "Untitled story"
}
