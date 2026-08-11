import { backendError, backendLog } from "@/lib/backend-log"

type JsonSchema = Record<string, unknown>

type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

function apiKey() {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error("OPENAI_API_KEY is not configured")
  return key
}

function model() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini"
}

export async function openAIJson<T>({
  name,
  schema,
  messages,
  temperature = 0.25,
}: {
  name: string
  schema: JsonSchema
  messages: ChatMessage[]
  temperature?: number
}): Promise<T> {
  const startedAt = Date.now()
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model(),
        temperature,
        messages,
        max_tokens: 4500,
        response_format: {
          type: "json_schema",
          json_schema: {
            name,
            strict: true,
            schema,
          },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    })

    const data = (await response.json()) as {
      error?: { message?: string }
      choices?: Array<{ message?: { content?: string } }>
    }
    if (!response.ok) throw new Error(data.error?.message || "OpenAI request failed")
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error("OpenAI returned an empty response")
    backendLog("info", "openai_json_completed", { name, model: model(), durationMs: Date.now() - startedAt })
    return JSON.parse(content) as T
  } catch (error) {
    backendError("openai_json_failed", error, { name, model: model(), durationMs: Date.now() - startedAt })
    throw error
  }
}

export async function openAIText(messages: ChatMessage[], operation = "coach") {
  const startedAt = Date.now()
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model(),
        temperature: 0.45,
        max_tokens: 900,
        messages,
      }),
      signal: AbortSignal.timeout(35_000),
    })

    const data = (await response.json()) as {
      error?: { message?: string }
      choices?: Array<{ message?: { content?: string } }>
    }
    if (!response.ok) throw new Error(data.error?.message || "OpenAI request failed")
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error("OpenAI returned an empty response")
    backendLog("info", "openai_text_completed", { operation, model: model(), durationMs: Date.now() - startedAt })
    return content
  } catch (error) {
    backendError("openai_text_failed", error, { operation, model: model(), durationMs: Date.now() - startedAt })
    throw error
  }
}

export async function transcribeWithOpenAI(file: File) {
  const startedAt = Date.now()
  try {
    const form = new FormData()
    form.set("file", file)
    form.set("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1")
    form.set("response_format", "json")
    form.set("language", "en")

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}` },
      body: form,
      signal: AbortSignal.timeout(55_000),
    })
    const data = (await response.json()) as { text?: string; error?: { message?: string } }
    if (!response.ok) throw new Error(data.error?.message || "OpenAI transcription failed")
    if (!data.text?.trim()) throw new Error("OpenAI returned an empty transcript")
    backendLog("info", "openai_transcription_completed", {
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1",
      bytes: file.size,
      durationMs: Date.now() - startedAt,
    })
    return data.text.trim()
  } catch (error) {
    backendError("openai_transcription_failed", error, {
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1",
      bytes: file.size,
      durationMs: Date.now() - startedAt,
    })
    throw error
  }
}
