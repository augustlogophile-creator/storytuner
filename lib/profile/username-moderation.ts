import "server-only"
import { moderateCommunityText } from "@/lib/community/ai-moderation"
import { backendError } from "@/lib/backend-log"
import { validateUsername } from "@/lib/profile/public-name"

export type UsernameSafetyResult =
  | { ok: true }
  | { ok: false; code: "INVALID" | "UNAVAILABLE"; message: string }

/**
 * Username safety is intentionally layered: deterministic rules catch known
 * profanity/evasion patterns first, then the existing AI moderation service
 * adds a second screen for hateful, sexual, threatening and other unsafe terms.
 */
export async function checkUsernameSafety(username: string): Promise<UsernameSafetyResult> {
  const deterministicError = validateUsername(username)
  if (deterministicError) {
    return { ok: false, code: "INVALID", message: deterministicError }
  }

  try {
    const moderation = await moderateCommunityText(`Public username: ${username}`)
    if (moderation.flagged) {
      return { ok: false, code: "INVALID", message: "That username isn't available. Try another one." }
    }
  } catch (error) {
    // Fail closed during account creation so a temporary moderation outage can
    // never become a bypass for the public-username safety layer.
    backendError("username_ai_moderation_failed", error, { usernameLength: username.length })
    return {
      ok: false,
      code: "UNAVAILABLE",
      message: "StoryTuner couldn't verify that username right now. Try again in a moment.",
    }
  }

  return { ok: true }
}
