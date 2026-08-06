export type StoryPlanBeat = {
  label: string
  purpose: string
  suggestion: string
}

export type StoryPlanOutput = {
  title: string
  throughline: string
  opening: string
  beats: StoryPlanBeat[]
  ending: string
  keep: string[]
  clarify: string[]
  deliveryTips: string[]
  revisedPlan: string
  reassurance: string
}

export type StoryPlanRecord = {
  id: string
  audienceContext: string
  goal: string
  roughPlan: string
  mustInclude: string
  nervousAbout: string
  output: StoryPlanOutput
  createdAt: string
}
