export const ONBOARDING_PREFERENCES_KEY = "storytuner-onboarding-preferences-v1"

export type StoryGoal = "everyday" | "speaking" | "writing" | "confidence" | "everything" | ""
export type StoryGoalChoice = Exclude<StoryGoal, "" | "everything">
export type StoryBlocker = "ramble" | "start" | "boring" | "details" | "nervous" | "confident" | ""

export type OnboardingPreferences = {
  // `goal` stays for backwards compatibility with the rest of StoryTuner.
  // New onboarding versions also save every selected goal in `goals`.
  goal: StoryGoal
  goals?: StoryGoalChoice[]
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
  if (typeof window === "undefined") return { goal: "", goals: [], blocker: "" }
  try {
    const raw = window.localStorage.getItem(ONBOARDING_PREFERENCES_KEY)
    if (!raw) return { goal: "", goals: [], blocker: "" }
    const parsed = JSON.parse(raw) as Partial<OnboardingPreferences>

    const savedGoals = Array.isArray(parsed.goals)
      ? parsed.goals.filter(isGoalChoice)
      : []

    const legacyGoal = isGoal(parsed.goal) ? parsed.goal : ""
    const goals = savedGoals.length > 0
      ? Array.from(new Set(savedGoals))
      : isGoalChoice(legacyGoal)
        ? [legacyGoal]
        : []

    return {
      goal: goals[0] ?? (legacyGoal === "everything" ? "" : legacyGoal),
      goals,
      blocker: isBlocker(parsed.blocker) ? parsed.blocker : "",
    }
  } catch {
    return { goal: "", goals: [], blocker: "" }
  }
}

export function writeOnboardingPreferences(value: OnboardingPreferences) {
  if (typeof window === "undefined") return
  try {
    const goals = Array.isArray(value.goals) ? value.goals.filter(isGoalChoice) : []
    const normalized: OnboardingPreferences = {
      ...value,
      goals,
      goal: goals[0] ?? (isGoal(value.goal) && value.goal !== "everything" ? value.goal : ""),
    }
    window.localStorage.setItem(ONBOARDING_PREFERENCES_KEY, JSON.stringify(normalized))
  } catch {}
}

function isGoal(value: unknown): value is StoryGoal {
  return ["", "everyday", "speaking", "writing", "confidence", "everything"].includes(String(value))
}

function isGoalChoice(value: unknown): value is StoryGoalChoice {
  return ["everyday", "speaking", "writing", "confidence"].includes(String(value))
}

function isBlocker(value: unknown): value is StoryBlocker {
  return ["", "ramble", "start", "boring", "details", "nervous", "confident"].includes(String(value))
}
