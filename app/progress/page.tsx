import { MobileShell } from "@/components/mobile-shell"
import { ProgressClient } from "@/components/profile/progress-client"
import { requireStoryTunerUser } from "@/lib/require-auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export default async function ProgressPage() {
  const user = await requireStoryTunerUser("/progress")

  // Stories shared is an account-level history stat, so read it from the
  // Community source of truth instead of the old device-local recording flag.
  // Deleted posts still count as stories the member previously shared; posts
  // held/removed by moderation do not count as completed shares.
  let sharedStoryCount: number | null = null
  try {
    const admin = createAdminClient()
    const { count, error } = await admin
      .from("community_posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id)
      .in("post_type", ["transcript", "audio", "audio_transcript"])
      .in("status", ["active", "deleted"])

    if (!error) sharedStoryCount = count ?? 0
  } catch {
    // If the Community backend is temporarily unavailable, keep Progress
    // usable and fall back to locally-known share metadata in the client.
  }

  return <MobileShell><ProgressClient sharedStoryCount={sharedStoryCount} /></MobileShell>
}
