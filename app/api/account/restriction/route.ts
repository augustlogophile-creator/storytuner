import { getAccountRestriction, getAuthenticatedUser } from "@/lib/require-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) return Response.json({ error: "Authentication required." }, { status: 401 })
  const restriction = await getAccountRestriction(authenticated.id)
  return Response.json({ restriction }, { headers: { "Cache-Control": "private, no-store" } })
}
