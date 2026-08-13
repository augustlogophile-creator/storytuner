export const ONBOARDING_PREFERENCES_KEY = "storytuner-onboarding-preferences-v1"

export type StoryGoal = "everyday" | "speaking" | "writing" | "confidence" | "everything" | ""
export type StoryBlocker = "ramble" | "start" | "boring" | "details" | "nervous" | "confident" | ""

export type OnboardingPreferences = {
  goal: StoryGoal
  blocker: StoryBlocker
}

export const goalLabels: Record<Exclude<StoryGoal, "">, string> = {
  everyday: "Everyday stories",
  speaking: "Interviews & speaking",
  writing: "Writing",
  confidence: "Confidence",
  everything: "Everything",
}

export const blockerLabels: Record<Exclude<StoryBlocker, "">, string> = {
  ramble: "I ramble",
  start: "I don’t know where to start",
  boring: "My stories feel boring",
  details: "I leave out important details",
  nervous: "I get nervous",
  confident: "I’m already pretty confident",
}

export function readOnboardingPreferences(): OnboardingPreferences {
  if (typeof window === "undefined") return { goal: "", blocker: "" }
  try {
    const raw = window.localStorage.getItem(ONBOARDING_PREFERENCES_KEY)
    if (!raw) return { goal: "", blocker: "" }
    const parsed = JSON.parse(raw) as Partial<OnboardingPreferences>
    return {
      goal: isGoal(parsed.goal) ? parsed.goal : "",
      blocker: isBlocker(parsed.blocker) ? parsed.blocker : "",
    }
  } catch {
    return { goal: "", blocker: "" }
  }
}

export function writeOnboardingPreferences(value: OnboardingPreferences) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(ONBOARDING_PREFERENCES_KEY, JSON.stringify(value))
  } catch {}
}

function isGoal(value: unknown): value is StoryGoal {
  return ["", "everyday", "speaking", "writing", "confidence", "everything"].includes(String(value))
}

function isBlocker(value: unknown): value is StoryBlocker {
  return ["", "ramble", "start", "boring", "details", "nervous", "confident"].includes(String(value))
}
