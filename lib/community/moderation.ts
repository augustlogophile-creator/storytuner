import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuthenticatedUser } from "@/lib/require-auth"

export type ModeratorRole = "admin"

type AuthenticatedIdentity = { id: string; claims: unknown }

function ownerBinding() {
  const userId = process.env.STORYTUNER_OWNER_USER_ID?.trim() ?? ""
  const email = process.env.STORYTUNER_OWNER_EMAIL?.trim().toLowerCase() ?? ""
  if (!userId || !email) return null
  return { userId, email }
}

const OFFICIAL_TELLWISE_OWNER_EMAIL = "tellwiseapp@gmail.com"

export function matchesConfiguredOwner(identity: AuthenticatedIdentity) {
  if (!identity.claims || typeof identity.claims !== "object") return false
  const claimEmail = (identity.claims as { email?: unknown }).email
  if (typeof claimEmail !== "string") return false

  const email = claimEmail.trim().toLowerCase()
  if (email === OFFICIAL_TELLWISE_OWNER_EMAIL) return true

  const owner = ownerBinding()
  return Boolean(owner && identity.id === owner.userId && email === owner.email)
}

/**
 * Admin access deliberately requires two independent server-side bindings:
 * the immutable Supabase user UUID/email configured in server environment
 * variables AND an admin row in the service-role-only moderators table.
 */
export async function verifiedModeratorRole(identity: AuthenticatedIdentity): Promise<ModeratorRole | null> {
  if (!matchesConfiguredOwner(identity)) return null

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("community_moderators")
      .select("role")
      .eq("user_id", identity.id)
      .maybeSingle<{ role: string }>()

    if (error || data?.role !== "admin") return null
    return "admin"
  } catch {
    // Admin authorization must fail closed if Supabase or configuration is down.
    return null
  }
}

export async function getModeratorContext() {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) {
    return {
      ok: false as const,
      response: Response.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } }),
    }
  }

  const role = await verifiedModeratorRole(authenticated)
  if (!role) {
    return {
      ok: false as const,
      response: Response.json({ error: "Admin access required." }, { status: 403, headers: { "Cache-Control": "no-store" } }),
    }
  }

  return {
    ok: true as const,
    userId: authenticated.id,
    role,
    admin: createAdminClient(),
  }
}
