import { backendLog } from "@/lib/backend-log"
import { runStoryTunerMaintenance } from "@/lib/maintenance"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const authorization = request.headers.get("authorization") ?? ""

  // Vercel sends CRON_SECRET as a Bearer token for scheduled cron requests.
  // Refuse to run destructive maintenance if the deployment has no secret.
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!secret || !timingSafeEqual(secret, supplied)) {
    backendLog("warn", "maintenance_rejected", {
      hasConfiguredSecret: Boolean(secret),
      hasAuthorization: Boolean(authorization),
    })
    return Response.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } })
  }

  const result = await runStoryTunerMaintenance()
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } })
}

function timingSafeEqual(a: string, b: string) {
  const encoder = new TextEncoder()
  const left = encoder.encode(a)
  const right = encoder.encode(b)
  const max = Math.max(left.length, right.length)
  let diff = left.length ^ right.length
  for (let index = 0; index < max; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return diff === 0
}
