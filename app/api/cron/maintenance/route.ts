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
  if (!secret || authorization !== `Bearer ${secret}`) {
    backendLog("warn", "maintenance_rejected", {
      hasConfiguredSecret: Boolean(secret),
      hasAuthorization: Boolean(authorization),
    })
    return Response.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } })
  }

  const result = await runStoryTunerMaintenance()
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } })
}
