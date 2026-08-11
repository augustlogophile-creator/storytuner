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

export async function GET() {
  const auth = await getActiveAuthenticatedUser()
  if (!auth.ok) return auth.response

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("coach_exchanges")
      .select("id, user_message, assistant_message, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: true })
      .limit(30)
      .returns<ExchangeRow[]>()

    if (error) throw error

    const messages = (data ?? []).flatMap((exchange) => [
      {
        id: `${exchange.id}:user`,
        role: "user" as const,
        content: exchange.user_message,
        createdAt: exchange.created_at,
      },
      {
        id: `${exchange.id}:assistant`,
        role: "assistant" as const,
        content: exchange.assistant_message,
        createdAt: exchange.created_at,
      },
    ])

    return Response.json({ messages }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    backendError("coach_history_lookup_failed", error, { userId: auth.user.id })
    return Response.json({ error: "Weaver history could not be loaded right now." }, { status: 500 })
  }
}
