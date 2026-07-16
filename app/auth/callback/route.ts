import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { safeInternalPath } from "@/lib/auth/redirects"
import { createClient } from "@/lib/supabase/server"

const otpTypes = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"])

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const tokenHash = url.searchParams.get("token_hash")
  const rawType = url.searchParams.get("type")
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
    return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent("The authentication link is invalid or expired.")}`, url.origin))
  }

  if (authError) {
    return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent("We could not finish signing you in. Request a new link and try again.")}`, url.origin))
  }

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return NextResponse.redirect(new URL("/sign-in", url.origin))

  if (requestedNext === "/reset-password") {
    return NextResponse.redirect(new URL("/reset-password", url.origin))
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userData.user.id)
    .maybeSingle<{ onboarding_completed: boolean }>()

  const destination = profile?.onboarding_completed ? requestedNext : "/onboarding"
  return NextResponse.redirect(new URL(destination, url.origin))
}
