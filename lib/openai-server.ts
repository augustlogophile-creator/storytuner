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
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name,
          strict: true,
          schema,
        },
      },
    }),
  })

  const data = (await response.json()) as {
    error?: { message?: string }
    choices?: Array<{ message?: { content?: string } }>
  }
  if (!response.ok) throw new Error(data.error?.message || "OpenAI request failed")
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("OpenAI returned an empty response")
  return JSON.parse(content) as T
}

export async function openAIText(messages: ChatMessage[]) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.45,
      messages,
    }),
  })

  const data = (await response.json()) as {
    error?: { message?: string }
    choices?: Array<{ message?: { content?: string } }>
  }
  if (!response.ok) throw new Error(data.error?.message || "OpenAI request failed")
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error("OpenAI returned an empty response")
  return content
}

export async function transcribeWithOpenAI(file: File) {
  const form = new FormData()
  form.set("file", file)
  form.set("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1")
  form.set("response_format", "json")
  form.set("language", "en")

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  })
  const data = (await response.json()) as { text?: string; error?: { message?: string } }
  if (!response.ok) throw new Error(data.error?.message || "OpenAI transcription failed")
  if (!data.text?.trim()) throw new Error("OpenAI returned an empty transcript")
  return data.text.trim()
}
