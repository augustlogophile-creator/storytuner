import { createAdminClient } from "@/lib/supabase/admin"
import { getAuthenticatedUser } from "@/lib/require-auth"

export type ModeratorRole = "moderator" | "admin"

export async function getModeratorContext() {
  const authenticated = await getAuthenticatedUser()
  if (!authenticated) {
    return {
      ok: false as const,
      response: Response.json({ error: "Authentication required." }, { status: 401 }),
    }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("community_moderators")
    .select("role")
    .eq("user_id", authenticated.id)
    .maybeSingle<{ role: ModeratorRole }>()

  if (error) {
    console.error("Moderator lookup failed", error)
    return {
      ok: false as const,
      response: Response.json({ error: "Moderation access could not be verified." }, { status: 500 }),
    }
  }

  if (!data) {
    return {
      ok: false as const,
      response: Response.json({ error: "Moderator access required." }, { status: 403 }),
    }
  }

  return {
    ok: true as const,
    userId: authenticated.id,
    role: data.role,
    admin,
  }
}

export async function isCommunityModerator(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from("community_moderators")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle<{ role: ModeratorRole }>()
  return data?.role ?? null
}
