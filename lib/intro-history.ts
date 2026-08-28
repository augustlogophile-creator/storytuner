export const INTRO_SEEN_COOKIE = "tellwise_intro_seen"
export const INTRO_SEEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 3

export function markIntroSeen() {
  if (typeof document === "undefined") return
  document.cookie = `${INTRO_SEEN_COOKIE}=1; Path=/; Max-Age=${INTRO_SEEN_MAX_AGE_SECONDS}; SameSite=Lax`
}
