import { backendError } from "@/lib/backend-log"
import { getActiveAuthenticatedUser } from "@/lib/require-auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type ExchangeRow = {
  id: string
  user_message: string
  assistant_message: string
  created_at: string
}

type StoredMessage = {
  id?: unknown
  role?: unknown
  content?: unknown
  createdAt?: unknown
}

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
}

export async function GET() {
  const auth = await getActiveAuthenticatedUser()
  if (!auth.ok) return auth.response

  const archived: Message[] = []
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("coach_exchanges")
      .select("id, user_message, assistant_message, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: true })
      .limit(30)
      .returns<ExchangeRow[]>()

    if (error) {
      backendError("coach_history_archive_lookup_failed", error, { userId: auth.user.id })
    } else {
      for (const exchange of data ?? []) {
        archived.push(
          {
            id: `${exchange.id}:user`,
            role: "user",
            content: exchange.user_message,
            createdAt: exchange.created_at,
          },
          {
            id: `${exchange.id}:assistant`,
            role: "assistant",
            content: exchange.assistant_message,
            createdAt: exchange.created_at,
          },
        )
      }
    }
  } catch (error) {
    backendError("coach_history_archive_lookup_failed", error, { userId: auth.user.id })
  }

  // user_app_state is intentionally a second source of truth for display history.
  // It predates coach_exchanges and keeps the chat usable if the archive table is
  // unavailable or an archive write fails after a successful Weaver response.
  let synced: Message[] = []
  try {
    const { data, error } = await auth.user.supabase
      .from("user_app_state")
      .select("state")
      .eq("user_id", auth.user.id)
      .maybeSingle<{ state: { coach?: { messages?: StoredMessage[] } } }>()

    if (error) {
      backendError("coach_history_state_lookup_failed", error, { userId: auth.user.id })
    } else {
      const raw: StoredMessage[] = Array.isArray(data?.state?.coach?.messages) ? data?.state?.coach?.messages ?? [] : []
      synced = raw.flatMap((message: StoredMessage, index: number): Message[] => {
        if (!message || (message.role !== "user" && message.role !== "assistant")) return []
        if (typeof message.content !== "string" || !message.content.trim()) return []
        return [{
          id: typeof message.id === "string" ? message.id : `state-${index}`,
          role: message.role,
          content: message.content.trim(),
          createdAt: typeof message.createdAt === "string" ? message.createdAt : new Date(0).toISOString(),
        }]
      })
    }
  } catch (error) {
    backendError("coach_history_state_lookup_failed", error, { userId: auth.user.id })
  }

  return Response.json(
    { messages: mergeExchanges(archived, synced) },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}

function mergeExchanges(...sources: Message[][]) {
  const all = sources.flat()
  const pairs: Array<{ user: Message; assistant: Message; sortKey: string }> = []

  for (let index = 0; index < all.length; index += 1) {
    const user = all[index]
    const assistant = all[index + 1]
    if (user?.role !== "user" || assistant?.role !== "assistant") continue
    const signature = `${user.content}\u0000${assistant.content}`
    if (!pairs.some((pair) => `${pair.user.content}\u0000${pair.assistant.content}` === signature)) {
      pairs.push({ user, assistant, sortKey: user.createdAt || assistant.createdAt || "" })
    }
    index += 1
  }

  return pairs
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .slice(-15)
    .flatMap((pair) => [pair.user, pair.assistant])
}
