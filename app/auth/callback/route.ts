import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { safeInternalPath } from "@/lib/auth/redirects"
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
    return NextResponse.redirect(new URL(`/sign-up?mode=sign-in&error=${encodeURIComponent("The authentication link is invalid or expired.")}`, url.origin))
  }

  if (authError) {
    return NextResponse.redirect(new URL(`/sign-up?mode=sign-in&error=${encodeURIComponent("We could not finish signing you in. Try again.")}`, url.origin))
  }

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return NextResponse.redirect(new URL("/sign-up?mode=sign-in", url.origin))

  if (requestedNext === "/reset-password") {
    return NextResponse.redirect(new URL("/reset-password", url.origin))
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

  if (profile?.onboarding_completed) {
    return NextResponse.redirect(new URL(requestedNext, url.origin))
  }

  if (intent === "sign-in") {
    // Some older accounts were created before profile onboarding was finalized.
    // If age confirmation already exists, repair the completion flag silently.
    if (profile?.confirmed_age_13_plus) {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", userData.user.id)
      if (!error) return NextResponse.redirect(new URL(requestedNext, url.origin))
    }

    // Existing accounts should never be asked to choose a username again.
    // Legacy accounts that still need the 13+ confirmation get a minimal recovery screen.
    if (profile || existingState) {
      const recovery = new URL("/onboarding", url.origin)
      recovery.searchParams.set("mode", "login-recovery")
      recovery.searchParams.set("next", requestedNext)
      return NextResponse.redirect(recovery)
    }

    // Google OAuth can create an auth user even when someone clicked Log in.
    // Do not silently turn that into a sign-up flow.
    await supabase.auth.signOut()
    const error = "No existing StoryTuner account was found for that Google account. Choose Sign up if you want to create one."
    return NextResponse.redirect(new URL(`/sign-up?mode=sign-in&error=${encodeURIComponent(error)}`, url.origin))
  }

  const onboarding = new URL("/onboarding", url.origin)
  onboarding.searchParams.set("next", requestedNext)
  return NextResponse.redirect(onboarding)
}
