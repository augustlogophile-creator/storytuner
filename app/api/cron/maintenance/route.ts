import { backendLog } from "@/lib/backend-log"
import { runStoryTunerMaintenance } from "@/lib/maintenance"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const EXPECTED_SCHEDULE = "17 5 * * *"

export async function GET(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? ""
  const schedule = request.headers.get("x-vercel-cron-schedule") ?? ""
  const fromVercelCron = userAgent.includes("vercel-cron/1.0") && schedule === EXPECTED_SCHEDULE
  if (!fromVercelCron) {
    backendLog("warn", "maintenance_rejected", { userAgent: userAgent.slice(0, 120), schedule })
    return Response.json({ error: "Not found." }, { status: 404 })
  }
  const result = await runStoryTunerMaintenance()
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } })
}
