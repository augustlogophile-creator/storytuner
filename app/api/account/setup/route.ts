import { backendError } from "@/lib/backend-log"
import { checkUsernameSafety } from "@/lib/profile/username-moderation"
import { validateDisplayName } from "@/lib/profile/public-name"
import { getAuthenticatedUser } from "@/lib/require-auth"
import { readJsonBody, requireSameOrigin, rateLimitResponse, rateLimitUser } from "@/lib/request-protection"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

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
    "Too many username attempts. Wait a moment and try again.",
  )
  if (blocked) return blocked

  const json = await readJsonBody(request, 4_000)
  if (!json.ok) return json.response
  const body = json.value as Record<string, unknown>
  if (body.confirmedAge13Plus !== true) {
    return Response.json(
      { code: "AGE_CONFIRMATION_REQUIRED", error: "Confirm that you are at least 13 to continue." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const admin = createAdminClient()
  const { data: existingProfile, error: profileError } = await admin
    .from("profiles")
    .select("username, display_name, confirmed_age_13_plus, onboarding_completed")
    .eq("id", auth.id)
    .maybeSingle<ExistingProfile>()

  if (profileError) {
    backendError("account_setup_profile_lookup_failed", profileError, { userId: auth.id })
    return Response.json(
      { code: "PROFILE_LOOKUP_FAILED", error: "StoryTuner couldn't verify your profile right now." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  // Existing users keep the username they already own. The recovery path only
  // completes the age/onboarding flags and never asks them to claim it again.
  if (existingProfile?.username?.trim()) {
    const { error } = await admin
      .from("profiles")
      .update({ confirmed_age_13_plus: true, onboarding_completed: true })
      .eq("id", auth.id)

    if (error) {
      backendError("account_setup_recovery_failed", error, { userId: auth.id })
      return Response.json(
        { code: "PROFILE_SAVE_FAILED", error: "StoryTuner couldn't finish your account setup." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      )
    }

    return Response.json(
      { completed: true, username: existingProfile.username, displayName: existingProfile.display_name, existing: true },
      { headers: { "Cache-Control": "no-store" } },
    )
  }

  const username = typeof body.username === "string"
    ? body.username.trim().toLowerCase()
    : ""

  const { data: taken, error: takenError } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (takenError) {
    backendError("username_availability_lookup_failed", takenError, { userId: auth.id })
    return Response.json(
      { code: "USERNAME_CHECK_FAILED", error: "StoryTuner couldn't check that username right now." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
  if (taken) {
    return Response.json(
      { code: "USERNAME_TAKEN", error: "That username is already taken. Try another one." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    )
  }

  const safety = await checkUsernameSafety(username)
  if (!safety.ok) {
    return Response.json(
      { code: safety.code === "UNAVAILABLE" ? "USERNAME_CHECK_UNAVAILABLE" : "USERNAME_NOT_AVAILABLE", error: safety.message },
      { status: safety.code === "UNAVAILABLE" ? 503 : 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const { data: userData, error: userError } = await auth.supabase.auth.getUser()
  if (userError || !userData.user) {
    return Response.json(
      { code: "AUTH_REQUIRED", error: "Your session expired. Log in again." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  const metadata = userData.user.user_metadata ?? {}
  const metadataName = [metadata.given_name, metadata.name, metadata.full_name]
    .find((value) => typeof value === "string" && value.trim())
  const firstName = typeof metadataName === "string" ? metadataName.trim().split(/\s+/)[0]?.slice(0, 15) ?? "" : ""
  const displayName = firstName && !validateDisplayName(firstName) ? firstName : "Storyteller"

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
        { code: "USERNAME_TAKEN", error: "That username is already taken. Try another one." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      )
    }
    if (saveError.code === "23514") {
      return Response.json(
        { code: "USERNAME_NOT_AVAILABLE", error: "That username isn't available. Try another one." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      )
    }
    return Response.json(
      { code: "PROFILE_SAVE_FAILED", error: "StoryTuner couldn't save that username right now." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }

  return Response.json(
    { completed: true, username, displayName, existing: false },
    { headers: { "Cache-Control": "no-store" } },
  )
}
