import { NextResponse, type NextRequest } from "next/server"
import { checkIpRateLimit } from "@/lib/security/ip-rate-limit"
import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  const rate = checkIpRateLimit(request)
  if (!rate.allowed) {
    const headers = {
      "Cache-Control": "no-store",
      "Retry-After": String(rate.retryAfterSeconds),
      "X-RateLimit-Policy": rate.label,
    }
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { code: "RATE_LIMITED", error: "Too many requests. Wait a moment and try again.", retryAfterSeconds: rate.retryAfterSeconds },
        { status: 429, headers },
      )
    }
    return new NextResponse("Too many requests. Wait a moment and try again.", { status: 429, headers })
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|webmanifest)$).*)",
  ],
}
