import { z } from "zod"
import { backendError } from "@/lib/backend-log"
import { moderateCommunityText } from "@/lib/community/ai-moderation"
import { checkUsernameSafety } from "@/lib/profile/username-moderation"
import { validateDisplayName } from "@/lib/profile/public-name"
import { getAuthenticatedUser } from "@/lib/require-auth"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const setupSchema = z.object({
  username: z.string().trim().max(20).optional(),
  displayName: z.string().trim().max(15).optional(),
  confirmedAge13Plus: z.literal(true),
}).strict()

type ExistingProfile = {
  username: string
  display_name: string
  confirmed_age_13_plus: boolean
  onboarding_completed: boolean
}

export async function POST(request: Request) {
  const crossSite = requireSameOrigin(request)
  if (crossSite) return crossSite

  const auth = await getAuthenticatedUser()
  if (!auth) {
    return Response.json(
      { code: "AUTH_REQUIRED", error: "Your session expired. Log in again." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  const blocked = rateLimitResponse(
    rateLimitUser(auth.id, "account_setup", [
      { limit: 10, windowMs: 60_000, label: "10/min" },
      { limit: 40, windowMs: 60 * 60 * 1000, label: "40/hour" },
    ]),
    "Too many profile setup attempts. Wait a moment and try again.",
  )
  if (blocked) return blocked

  const json = await readJsonBody(request, 4_000)
  if (!json.ok) return json.response
  const parsed = setupSchema.safeParse(json.value)
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_SETUP", error: "That account setup request is invalid." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }
  const body = parsed.data

  const admin = createAdminClient()
  const { data: existingProfile, error: profileError } = await admin
    .from("profiles")
    .select("username, display_name, confirmed_age_13_plus, onboarding_completed")
    .eq("id", auth.id)
    .maybeSingle<ExistingProfile>()

  if (profileError) {
    backendError("account_setup_profile_lookup_failed", profileError, { userId: auth.id })
    return Response.json(
      { code: "PROFILE_LOOKUP_FAILED", error: "Tellwise couldn't verify your profile right now." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  // Existing users keep the username they already own. The recovery path only
  // completes the age/onboarding flags and never exposes a username-change path.
  if (existingProfile?.username?.trim()) {
    const requestedUsername = typeof body.username === "string" ? body.username.trim().toLowerCase() : ""
    if (requestedUsername && requestedUsername !== existingProfile.username.trim().toLowerCase()) {
      return Response.json(
        { code: "USERNAME_IMMUTABLE", error: "Your Tellwise username is permanent and cannot be changed. You can change your display name in Settings." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      )
    }

    const { error } = await admin
      .from("profiles")
      .update({ confirmed_age_13_plus: true, onboarding_completed: true })
      .eq("id", auth.id)

    if (error) {
      backendError("account_setup_recovery_failed", error, { userId: auth.id })
      return Response.json(
        { code: "PROFILE_SAVE_FAILED", error: "Tellwise couldn't finish your account setup." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      )
    }

    return Response.json(
      { completed: true, username: existingProfile.username, displayName: existingProfile.display_name, existing: true },
      { headers: { "Cache-Control": "no-store" } },
    )
  }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : ""
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : ""

  if (!username || !displayName) {
    return Response.json(
      { code: "PROFILE_FIELDS_REQUIRED", error: "Choose both a username and a display name to continue." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const displayNameError = validateDisplayName(displayName)
  if (displayNameError) {
    return Response.json(
      { code: "DISPLAY_NAME_INVALID", error: displayNameError },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const { data: userData, error: userError } = await auth.supabase.auth.getUser()
  if (userError || !userData.user) {
    return Response.json(
      { code: "AUTH_REQUIRED", error: "Your session expired. Log in again." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  const verifiedEmail = userData.user.email?.trim().toLowerCase() ?? ""
  if (!verifiedEmail || !userData.user.email_confirmed_at) {
    return Response.json(
      { code: "VERIFIED_EMAIL_REQUIRED", error: "Tellwise could not verify the email on this account. Sign in with a verified Google account and try again." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    )
  }
  const allowOfficialTellwiseHandle = verifiedEmail === "tellwiseapp@gmail.com" && username === "tellwise"

  // Safety is checked before availability so prohibited handles always receive
  // the safety explanation rather than leaking a different response if one was
  // ever present in legacy data.
  const usernameSafety = await checkUsernameSafety(username, { allowReserved: allowOfficialTellwiseHandle })
  if (!usernameSafety.ok) {
    return Response.json(
      { code: usernameSafety.code === "UNAVAILABLE" ? "USERNAME_CHECK_UNAVAILABLE" : "USERNAME_NOT_ALLOWED", error: usernameSafety.message },
      { status: usernameSafety.code === "UNAVAILABLE" ? 503 : 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  try {
    const displayModeration = await moderateCommunityText(`Public display name: ${displayName}`)
    if (displayModeration.flagged) {
      return Response.json(
        { code: "DISPLAY_NAME_NOT_ALLOWED", error: "Tellwise doesn't allow display names with hateful, racist, sexual, vulgar, threatening, or harassing content." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      )
    }
  } catch (error) {
    backendError("display_name_ai_moderation_failed_during_setup", error, { userId: auth.id, displayNameLength: displayName.length })
    return Response.json(
      { code: "DISPLAY_NAME_CHECK_UNAVAILABLE", error: "Tellwise couldn't verify that display name right now. Try again in a moment." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  const { data: taken, error: takenError } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (takenError) {
    backendError("username_availability_lookup_failed", takenError, { userId: auth.id })
    return Response.json(
      { code: "USERNAME_CHECK_FAILED", error: "Tellwise couldn't check that username right now." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
  if (taken) {
    return Response.json(
      { code: "USERNAME_TAKEN", error: "That username is already taken. Choose another one." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    )
  }

  const { error: saveError } = await admin.from("profiles").upsert({
    id: auth.id,
    username,
    display_name: displayName,
    confirmed_age_13_plus: true,
    onboarding_completed: true,
  }, { onConflict: "id" })

  if (saveError) {
    backendError("username_claim_failed", saveError, {
      userId: auth.id,
      supabaseCode: typeof saveError.code === "string" ? saveError.code : null,
    })
    if (saveError.code === "23505") {
      return Response.json(
        { code: "USERNAME_TAKEN", error: "That username is already taken. Choose another one." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      )
    }
    if (saveError.code === "23514") {
      return Response.json(
        { code: "USERNAME_NOT_ALLOWED", error: "Tellwise doesn't allow usernames with hateful, racist, sexual, vulgar, threatening, harassing, or reserved content." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      )
    }
    return Response.json(
      { code: "PROFILE_SAVE_FAILED", error: "Tellwise couldn't save your profile right now." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }

  return Response.json(
    { completed: true, username, displayName, existing: false },
    { headers: { "Cache-Control": "no-store" } },
  )
}
