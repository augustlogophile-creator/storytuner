import type { Recording } from "@/lib/app-state"

const SCENARIO_IDS_BY_NAME: Record<string, string> = {
  "Personal stories": "personal",
  Interviews: "interview",
  "Proving your point": "point",
  Presentations: "presentation",
  "Difficult conversations": "difficult",
  "Everyday conversation": "conversation",
}

export function recordingHasGrade(recording: Recording) {
  return Boolean(
    recording.overall > 0 ||
    recording.scores.hook > 0 ||
    recording.scores.development > 0 ||
    recording.scores.landing > 0
  )
}

export function displayRecordingContext(recording: Recording) {
  if (recording.storyMode === "free" || recording.context === "Open story") return "Unprompted story"
  if (recording.context === "Saved story" || recording.context === "Draft") return "Draft"
  return recording.context
}

export function recordingRedoHref(recording: Recording) {
  const context = displayRecordingContext(recording)
  const inferredScenarioId = SCENARIO_IDS_BY_NAME[recording.context]
  const mode = recording.storyMode ?? (inferredScenarioId ? "scenario" : "free")
  const params = new URLSearchParams({ mode })

  const scenarioId = recording.scenarioId || inferredScenarioId
  if (mode === "scenario" && scenarioId) params.set("scenario", scenarioId)
  if (typeof recording.promptIndex === "number" && recording.promptIndex >= 0) params.set("promptIndex", String(recording.promptIndex))
  if (recording.prompt) params.set("prompt", recording.prompt)
  if (recording.targetSeconds && recording.targetSeconds > 0) params.set("target", String(recording.targetSeconds))
  if (typeof recording.cameraOn === "boolean") params.set("camera", recording.cameraOn ? "1" : "0")

  // Keep legacy unprompted recordings clean even when their stored context predates the rename.
  if (mode === "free" && context === "Unprompted story") params.delete("scenario")

  return `/studio?${params.toString()}`
}

export function formatRecordingDateTime(createdAt: string) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ""
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  return `${day} · ${time}`
}
