import { createAdminClient } from "@/lib/supabase/admin"
import { getAuthenticatedUser } from "@/lib/require-auth"

export type ModeratorRole = "admin"

export const STORYTUNER_OWNER_EMAIL = "storytunerapp@gmail.com"

export function moderatorRoleFromClaims(claims: unknown): ModeratorRole | null {
  if (!claims || typeof claims !== "object") return null
  const email = (claims as { email?: unknown }).email
  if (typeof email !== "string") return null
  return email.trim().toLowerCase() === STORYTUNER_OWNER_EMAIL ? "admin" : null
}

export async function getModeratorContext() {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) {
    return {
      ok: false as const,
      response: Response.json({ error: "Authentication required." }, { status: 401 }),
    }
  }

  const role = moderatorRoleFromClaims(authenticated.claims)
  if (!role) {
    return {
      ok: false as const,
      response: Response.json({ error: `Only ${STORYTUNER_OWNER_EMAIL} can access moderation.` }, { status: 403 }),
    }
  }

  return {
    ok: true as const,
    userId: authenticated.id,
    role,
    admin: createAdminClient(),
  }
}
