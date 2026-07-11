import curriculumData from "@/lib/curriculum.json"

export type Accent = "brand" | "ink" | "streak"

export type CurriculumQuestion = {
  question: string
  options: string[]
  correct: number
  explanation: string
}

export type CurriculumSection = {
  heading: string
  body: string
}

export type CurriculumUnit = {
  id: string
  index: number
  kind: "unit" | "capstone"
  title: string
  skill: string
  description: string
  accent: Accent
  xp: number
  readSections: CurriculumSection[]
  drill: {
    title: string
    prompt: string
    steps: string[]
  }
  quiz: CurriculumQuestion[]
}

export type LessonStage = "read" | "drill" | "quiz"

export const curriculum = curriculumData as CurriculumUnit[]

export const stageLabels: Record<LessonStage, string> = {
  read: "Learn",
  drill: "Practice",
  quiz: "Check",
}

export const stageXp: Record<LessonStage, number> = {
  read: 10,
  drill: 15,
  quiz: 20,
}

export function getUnit(unitId: string) {
  return curriculum.find((unit) => unit.id === unitId)
}

export function getUnitByIndex(index: number) {
  return curriculum.find((unit) => unit.index === index)
}

export function lessonId(unitId: string, stage: LessonStage) {
  return `${unitId}--${stage}`
}

export function parseLessonId(id: string): { unit: CurriculumUnit; stage: LessonStage } | null {
  const [unitId, stage] = id.split("--")
  if (!unitId || !["read", "drill", "quiz"].includes(stage)) return null
  const unit = getUnit(unitId)
  if (!unit) return null
  return { unit, stage: stage as LessonStage }
}

export function allLessonIds() {
  return curriculum.flatMap((unit) =>
    (["read", "drill", "quiz"] as LessonStage[]).map((stage) => lessonId(unit.id, stage)),
  )
}
