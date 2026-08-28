import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { accountDeletionCooldownMessage, getAccountDeletionCooldown } from "@/lib/account-deletion-cooldown"
import { safeInternalPath, siteUrl } from "@/lib/auth/redirects"
import { backendError } from "@/lib/backend-log"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const otpTypes = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"])

type AuthIntent = "sign-in" | "sign-up"

type ProfileState = {
  username: string
  display_name: string
  confirmed_age_13_plus: boolean
  onboarding_completed: boolean
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const redirectOrigin = siteUrl()
  const code = url.searchParams.get("code")
  const tokenHash = url.searchParams.get("token_hash")
  const rawType = url.searchParams.get("type")
  const intent: AuthIntent = url.searchParams.get("intent") === "sign-in" ? "sign-in" : "sign-up"
  const requestedNext = safeInternalPath(url.searchParams.get("next"), rawType === "recovery" ? "/reset-password" : "/home")
  const supabase = await createClient()

  let authError: Error | null = null
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    authError = error
  } else if (tokenHash && rawType && otpTypes.has(rawType as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: rawType as EmailOtpType })
    authError = error
  } else {
    return NextResponse.redirect(new URL(`/sign-up?mode=sign-in&error=${encodeURIComponent("The authentication link is invalid or expired.")}`, redirectOrigin))
  }

  // A browser can occasionally request the same OAuth callback twice. If the
  // verified session already exists, do not treat a repeated one-time-code error
  // as a new authentication failure.
  const { data: userData, error: userLookupError } = await supabase.auth.getUser()
  if (authError && !userData.user) {
    backendError("auth_callback_exchange_failed", authError, {
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      intent,
    })
    return NextResponse.redirect(new URL(`/sign-up?mode=sign-in&error=${encodeURIComponent("We could not finish signing you in. Try again.")}`, redirectOrigin))
  }

  if (userLookupError || !userData.user) {
    if (userLookupError) backendError("auth_callback_user_lookup_failed", userLookupError, { intent })
    return NextResponse.redirect(new URL("/sign-up?mode=sign-in", redirectOrigin))
  }

  if (requestedNext === "/reset-password") {
    return NextResponse.redirect(new URL("/reset-password", redirectOrigin))
  }

  if (!userData.user.email?.trim() || !userData.user.email_confirmed_at) {
    await supabase.auth.signOut().catch(() => undefined)
    return NextResponse.redirect(new URL(`/sign-up?mode=${intent}&error=${encodeURIComponent("Tellwise requires a verified Google email address.")}`, redirectOrigin))
  }

  const [profileResult, existingStateResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name, confirmed_age_13_plus, onboarding_completed")
      .eq("id", userData.user.id)
      .maybeSingle<ProfileState>(),
    supabase
      .from("user_app_state")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle<{ user_id: string }>(),
  ])

  if (profileResult.error || existingStateResult.error) {
    if (profileResult.error) backendError("auth_callback_profile_lookup_failed", profileResult.error, { userId: userData.user.id, intent })
    if (existingStateResult.error) backendError("auth_callback_state_lookup_failed", existingStateResult.error, { userId: userData.user.id, intent })
    await supabase.auth.signOut().catch(() => undefined)
    return NextResponse.redirect(new URL(`/sign-up?mode=${intent}&error=${encodeURIComponent("Tellwise could not safely verify this account right now. Try again in a moment.")}`, redirectOrigin))
  }

  const profile = profileResult.data
  const existingState = existingStateResult.data
  const hasUsername = Boolean(profile?.username?.trim())
  const hasExistingAccountEvidence = Boolean(profile || existingState)

  // Google OAuth may create a fresh Supabase auth user before Tellwise knows
  // whether this email is allowed to register. For identities with no Tellwise
  // profile/state yet, enforce the deletion cooldown before any app profile can
  // be created. This is server-side and cannot be bypassed from the browser.
  if (!hasExistingAccountEvidence) {
    const admin = createAdminClient()
    try {
      const cooldown = await getAccountDeletionCooldown(admin, userData.user.email ?? "")
      if (cooldown) {
        const { error: cleanupError } = await admin.auth.admin.deleteUser(userData.user.id)
        if (cleanupError) backendError("auth_cooldown_orphan_cleanup_failed", cleanupError, { userId: userData.user.id })
        await supabase.auth.signOut().catch(() => undefined)
        const message = accountDeletionCooldownMessage(cooldown)
        return NextResponse.redirect(new URL(`/sign-up?mode=sign-up&error=${encodeURIComponent(message)}`, redirectOrigin))
      }
    } catch (error) {
      backendError("auth_cooldown_verification_failed", error, { userId: userData.user.id, intent })
      const { error: cleanupError } = await admin.auth.admin.deleteUser(userData.user.id)
      if (cleanupError) backendError("auth_cooldown_verification_cleanup_failed", cleanupError, { userId: userData.user.id })
      await supabase.auth.signOut().catch(() => undefined)
      return NextResponse.redirect(new URL(`/sign-up?mode=${intent}&error=${encodeURIComponent("Tellwise could not verify whether this email is eligible to register right now. Try again later.")}`, redirectOrigin))
    }
  }

  if (profile?.onboarding_completed && hasUsername) {
    return NextResponse.redirect(new URL(requestedNext, redirectOrigin))
  }

  if (intent === "sign-in") {
    // Existing accounts that already own a username never choose it again.
    if (hasUsername) {
      // Some older accounts were created before onboarding completion was finalized.
      // If age confirmation already exists, repair only the completion flag.
      if (profile?.confirmed_age_13_plus) {
        try {
          const admin = createAdminClient()
          const { error } = await admin
            .from("profiles")
            .update({ onboarding_completed: true })
            .eq("id", userData.user.id)
          if (!error) return NextResponse.redirect(new URL(requestedNext, redirectOrigin))
        } catch {}
      }

      const recovery = new URL("/onboarding", redirectOrigin)
      recovery.searchParams.set("mode", "login-recovery")
      recovery.searchParams.set("next", requestedNext)
      return NextResponse.redirect(recovery)
    }

    // A known legacy Tellwise account without a username must choose one once.
    if (hasExistingAccountEvidence) {
      const setup = new URL("/choose-username", redirectOrigin)
      setup.searchParams.set("next", requestedNext)
      return NextResponse.redirect(setup)
    }

    // Google OAuth creates an auth identity even when the person clicked Log in.
    // Remove that unintended auth-only identity so Log in cannot silently become
    // account creation or leave reusable orphan users behind.
    const admin = createAdminClient()
    const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id)
    if (deleteError) backendError("auth_signin_orphan_cleanup_failed", deleteError, { userId: userData.user.id })
    await supabase.auth.signOut().catch(() => undefined)
    const error = "No existing Tellwise account was found for that Google account. Choose Sign up if you want to create one."
    return NextResponse.redirect(new URL(`/sign-up?mode=sign-in&error=${encodeURIComponent(error)}`, redirectOrigin))
  }

  // Sign up: existing users with usernames pass through above; every genuinely
  // new account must claim its immutable username and moderated display name
  // before any signed-in Tellwise route opens.
  const setup = new URL("/choose-username", redirectOrigin)
  setup.searchParams.set("next", requestedNext)
  return NextResponse.redirect(setup)
}
