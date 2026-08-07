import { getMembershipByUserId } from "@/lib/membership-server"
import { getActiveAuthenticatedUser } from "@/lib/require-auth"
import { getUsageStatus } from "@/lib/usage-server"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await getActiveAuthenticatedUser()
  if (!auth.ok) return auth.response

  try {
    const membership = await getMembershipByUserId(auth.user.id)
    const [coach, arena] = await Promise.all([
      getUsageStatus(auth.user.id, "coach_message"),
      getUsageStatus(auth.user.id, "arena_review"),
    ])

    return Response.json({
      membershipActive: membership.active,
      coach,
      arena,
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("StoryTuner usage lookup failed", error)
    return Response.json({ error: "Usage could not be verified right now." }, { status: 500 })
  }
}
