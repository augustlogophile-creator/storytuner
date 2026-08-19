import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
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

  // A browser can occasionally request the same OAuth callback twice (for
  // example after a reload/back-forward navigation). The first request may
  // already have established the session, while the repeated one sees a
  // one-time-code exchange error. In that case, trust the verified Supabase
  // session instead of showing a false sign-in failure.
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

  const [{ data: profile }, { data: existingState }] = await Promise.all([
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

  const hasUsername = Boolean(profile?.username?.trim())

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
    if (profile || existingState) {
      const setup = new URL("/choose-username", redirectOrigin)
      setup.searchParams.set("next", requestedNext)
      return NextResponse.redirect(setup)
    }

    // Google OAuth can create an auth user even when someone clicked Log in.
    // Keep Log in and Sign up separate: an entirely new Google identity must use Sign up.
    await supabase.auth.signOut()
    const error = "No existing Tellwise account was found for that Google account. Choose Sign up if you want to create one."
    return NextResponse.redirect(new URL(`/sign-up?mode=sign-in&error=${encodeURIComponent(error)}`, redirectOrigin))
  }

  // Sign up: existing users with usernames pass through; every genuinely new
  // account must claim a username before any signed-in Tellwise route opens.
  const setup = new URL("/choose-username", redirectOrigin)
  setup.searchParams.set("next", requestedNext)
  return NextResponse.redirect(setup)
}
