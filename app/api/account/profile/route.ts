import { z } from "zod"
import { backendError } from "@/lib/backend-log"
import { moderateCommunityText } from "@/lib/community/ai-moderation"
import { validateDisplayName } from "@/lib/profile/public-name"
import { getActiveAuthenticatedUser } from "@/lib/require-auth"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({
  displayName: z.string().trim().min(1).max(15),
}).strict()

export async function PATCH(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite

  const auth = await getActiveAuthenticatedUser()
  if (!auth.ok) return auth.response

  const limited = rateLimitResponse(
    rateLimitUser(auth.user.id, "profile_display_name", [
      { limit: 8, windowMs: 10 * 60 * 1000, label: "8/10min" },
      { limit: 25, windowMs: 24 * 60 * 60 * 1000, label: "25/day" },
    ]),
    "Too many profile changes. Wait a while and try again.",
  )
  if (limited) return limited

  const json = await readJsonBody(request, 2_000)
  if (!json.ok) return json.response
  const parsed = schema.safeParse(json.value)
  if (!parsed.success) {
    return Response.json({ error: "Choose a display name from 3 to 15 letters/characters." }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  const displayName = parsed.data.displayName
  const deterministicError = validateDisplayName(displayName)
  if (deterministicError) {
    return Response.json({ error: deterministicError }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }

  try {
    const moderation = await moderateCommunityText(`Public display name: ${displayName}`)
    if (moderation.flagged) {
      return Response.json(
        { error: "Choose a different display name. Vulgar, sexual, hateful, or harassing terms are not allowed." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      )
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", auth.user.id)
    if (error) throw error

    return Response.json({ saved: true, displayName }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    backendError("profile_display_name_update_failed", error, { userId: auth.user.id })
    return Response.json(
      { error: "StoryTuner could not safely update your display name right now. Try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
