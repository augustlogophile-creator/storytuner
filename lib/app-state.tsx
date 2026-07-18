"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { curriculum, lessonId, stageXp, type LessonStage } from "@/lib/curriculum"
import { clearMedia, deleteMedia } from "@/lib/media-store"
import { deleteCloudRecording, deleteCloudRecordings } from "@/lib/recording-cloud"

export type ArenaScores = { hook: number; development: number; landing: number }

export type Recording = {
  id: string
  createdAt: string
  title: string
  context: string
  prompt: string
  duration: number
  transcript: string
  scores: ArenaScores
  overall: number
  praise: string
  strengths?: string[]
  weakest?: "hook" | "development" | "landing"
  weakness?: string
  improvements?: string[]
  levelUp?: string
  revisedStory?: string
  fix: string
  nextTake: string
  mediaKind: "video" | "audio" | "none"
  mimeType: string
  cloudRecordingId?: string
  cloudStoragePath?: string
  shared: boolean
}

export type CommunityPost = {
  id: string
  recordingId?: string
  author: string
  context: string
  createdAt: string
  text: string
  mediaKind: "video" | "audio" | "none"
  hearts: number
  comments: { id: string; author: string; text: string; createdAt: string }[]
  mine?: boolean
}

export type WeaverColor = {
  id: string
  name: string
  cost: number
  image: string
  description: string
  featured?: "gold" | "goat"
}

export const weaverColors: WeaverColor[] = [
  { id: "classic", name: "Classic Black", cost: 0, image: "/weaver.png", description: "Weaver's original look." },
  { id: "brown", name: "Walnut", cost: 50, image: "/weaver-brown.png", description: "Warm cocoa brown with bronze highlights." },
  { id: "slate", name: "Cobalt", cost: 180, image: "/weaver-cobalt.png", description: "Electric blue with deep sapphire shading." },
  { id: "red", name: "Crimson", cost: 260, image: "/weaver-red.png", description: "A bold ruby red with darker edges." },
  { id: "moss", name: "Emerald", cost: 320, image: "/weaver-emerald.png", description: "Bright jewel green with rich depth." },
  { id: "plum", name: "Violet", cost: 520, image: "/weaver-violet.png", description: "A vivid royal purple with glossy highlights." },
  { id: "amber", name: "Sunset", cost: 800, image: "/weaver-sunset.png", description: "Burnished orange with a warm golden glow." },
  { id: "gold", name: "Crowned Gold", cost: 1000, image: "/weaver-gold.png", description: "Polished gold, finished with a crown.", featured: "gold" },
  { id: "goat", name: "G.O.A.T. Weaver", cost: 2000, image: "/weaver-goat.png", description: "The rarest Weaver, with horns, ears, and a beard.", featured: "goat" },
]

export type CoachMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string }

export type AppState = {
  version: 5
  profile: { name: string; joinedAt: string }
  sessions: number
  lastOpen: string | null
  activityDates: string[]
  arenaUses: Record<string, number>
  arenaTotal: number
  completed: string[]
  responses: Record<string, string>
  quizScores: Record<string, number>
  xpLifetime: number
  xpBalance: number
  streak: number
  longestStreak: number
  ownedWeavers: string[]
  activeWeaver: string
  recordings: Recording[]
  community: CommunityPost[]
  likedPosts: string[]
  coach: { date: string; sent: number; messages: CoachMessage[] }
  settings: {
    tone: "warm" | "minimal"
    frequency: "daily" | "weekdays" | "off"
    aiOptIn: boolean
  }
  premium: boolean
  onboardingComplete: boolean
}

const STORAGE_KEY = "storytuner-state-v5"

function seedCommunityPosts(): CommunityPost[] {
  return [
    { id: "seed-1", author: "Nora", context: "Personal story", createdAt: "2026-07-09T16:00:00.000Z", text: "I kept rehearsing an apology in my head, but when I finally reached her door, she apologized first. The story I had prepared was suddenly not the story I needed to tell.", mediaKind: "none", hearts: 18, comments: [{ id: "seed-c1", author: "Eli", text: "The reversal in the last sentence really lands.", createdAt: "2026-07-09T17:10:00.000Z" }] },
    { id: "seed-2", author: "Malik", context: "Interview", createdAt: "2026-07-08T19:30:00.000Z", text: "The third prototype failed during the demonstration. I wanted to hide it, but I explained exactly what broke and what I would test next. That answer became the part of the interview they remembered.", mediaKind: "none", hearts: 26, comments: [] },
    { id: "seed-3", author: "June", context: "Toast or tribute", createdAt: "2026-07-07T13:20:00.000Z", text: "My grandmother never said she was proud directly. She cut fruit, put it beside my homework, and pretended she had made too much. It took me years to understand that this was the sentence she kept saying.", mediaKind: "none", hearts: 41, comments: [{ id: "seed-c2", author: "Sam", text: "The fruit detail says everything without explaining too much.", createdAt: "2026-07-07T14:00:00.000Z" }] },
  ]
}

function todayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function daysBetween(a: string, b: string) {
  const [aYear, aMonth, aDay] = a.split("-").map(Number)
  const [bYear, bMonth, bDay] = b.split("-").map(Number)
  return Math.round((Date.UTC(bYear, bMonth - 1, bDay) - Date.UTC(aYear, aMonth - 1, aDay)) / 86400000)
}

function freshState(): AppState {
  return {
    version: 5,
    profile: { name: "Storyteller", joinedAt: new Date().toISOString() },
    sessions: 0,
    lastOpen: null,
    activityDates: [],
    arenaUses: {},
    arenaTotal: 0,
    completed: [],
    responses: {},
    quizScores: {},
    xpLifetime: 0,
    xpBalance: 0,
    streak: 0,
    longestStreak: 0,
    ownedWeavers: ["classic"],
    activeWeaver: "classic",
    recordings: [],
    community: seedCommunityPosts(),
    likedPosts: [],
    coach: { date: todayKey(), sent: 0, messages: [] },
    settings: { tone: "warm", frequency: "daily", aiOptIn: false },
    premium: false,
    onboardingComplete: false,
  }
}

function normalize(raw: unknown): AppState {
  const base = freshState()
  if (!raw || typeof raw !== "object") return base
  const value = raw as Partial<AppState>
  return {
    ...base,
    ...value,
    version: 5,
    profile: { ...base.profile, ...(value.profile ?? {}) },
    settings: { ...base.settings, ...(value.settings ?? {}) },
    completed: Array.isArray(value.completed) ? value.completed : [],
    activityDates: Array.isArray(value.activityDates) ? value.activityDates : [],
    arenaUses: value.arenaUses && typeof value.arenaUses === "object" ? value.arenaUses : {},
    arenaTotal: typeof value.arenaTotal === "number" ? value.arenaTotal : Object.values(value.arenaUses ?? {}).reduce((sum, count) => sum + (typeof count === "number" ? count : 0), 0),
    ownedWeavers: Array.isArray(value.ownedWeavers) && value.ownedWeavers.length ? value.ownedWeavers : ["classic"],
    recordings: Array.isArray(value.recordings) ? value.recordings : [],
    community: Array.isArray(value.community) ? [...seedCommunityPosts().filter((seed) => !value.community?.some((post) => post.id === seed.id)), ...value.community] : seedCommunityPosts(),
    likedPosts: Array.isArray(value.likedPosts) ? value.likedPosts : [],
    coach: value.coach && typeof value.coach === "object"
      ? {
          date: typeof value.coach.date === "string" ? value.coach.date : todayKey(),
          sent: typeof value.coach.sent === "number" ? value.coach.sent : 0,
          messages: Array.isArray(value.coach.messages) ? value.coach.messages : [],
        }
      : base.coach,
    responses: value.responses ?? {},
    quizScores: value.quizScores ?? {},
    premium: false,
  }
}

function applyActivity(state: AppState) {
  const today = todayKey()
  if (state.activityDates.includes(today)) return state
  const dates = [...state.activityDates, today].slice(-180)
  const sorted = [...dates].sort()
  const prior = sorted.at(-2)
  const streak = prior && daysBetween(prior, today) === 1 ? state.streak + 1 : 1
  return {
    ...state,
    activityDates: dates,
    streak,
    longestStreak: Math.max(state.longestStreak, streak),
  }
}

type AppContextValue = {
  state: AppState
  ready: boolean
  completeStage: (unitId: string, stage: LessonStage, response?: string, quizScore?: number) => void
  saveResponse: (key: string, value: string) => void
  addRecording: (recording: Recording) => void
  deleteRecording: (id: string) => Promise<void>
  shareRecording: (id: string) => void
  removePost: (id: string) => void
  toggleHeart: (id: string) => void
  addComment: (id: string, text: string) => void
  purchaseWeaver: (id: string) => { ok: boolean; message: string }
  equipWeaver: (id: string) => void
  updateSettings: (patch: Partial<AppState["settings"]>) => void
  updateProfileName: (name: string) => void
  setPremium: (value: boolean) => void
  completeOnboarding: (name?: string) => void
  deleteAllRecordings: () => Promise<void>
  resetAll: () => Promise<void>
  addCoachExchange: (user: string, assistant: string) => void
  clearCoach: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(freshState)
  const [ready, setReady] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    let next = freshState()
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("storytuner-state-v4") ?? localStorage.getItem("storytuner-state-v3")
      if (raw) next = normalize(JSON.parse(raw))
    } catch {}
    const sessionSeen = sessionStorage.getItem("storytuner-session")
    if (!sessionSeen) {
      sessionStorage.setItem("storytuner-session", "1")
      next.sessions += 1
    }
    next.lastOpen = new Date().toISOString()
    setState(next)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [ready, state])

  const completeStage = useCallback((unitId: string, stage: LessonStage, response?: string, quizScore?: number) => {
    const key = lessonId(unitId, stage)
    setState((current) => {
      const unit = curriculum.find((item) => item.id === unitId)
      if (unit && !hasUnitPlanAccess(current, unit.index)) return current
      const alreadyDone = current.completed.includes(key)
      let next = { ...current }
      if (response !== undefined) next.responses = { ...next.responses, [key]: response }
      if (quizScore !== undefined) next.quizScores = { ...next.quizScores, [unitId]: quizScore }
      if (!alreadyDone) {
        const earned = stageXp[stage]
        next.completed = [...next.completed, key]
        next.xpLifetime += earned
        next.xpBalance += earned
      }
      return applyActivity(next)
    })
  }, [])

  const saveResponse = useCallback((key: string, value: string) => {
    setState((current) => ({ ...current, responses: { ...current.responses, [key]: value } }))
  }, [])

  const addRecording = useCallback((recording: Recording) => {
    setState((current) => {
      const isNew = !current.recordings.some((item) => item.id === recording.id)
      const today = todayKey()
      const next = applyActivity({
        ...current,
        recordings: [recording, ...current.recordings.filter((item) => item.id !== recording.id)],
        arenaUses: isNew ? { ...current.arenaUses, [today]: (current.arenaUses[today] ?? 0) + 1 } : current.arenaUses,
        arenaTotal: current.arenaTotal + (isNew ? 1 : 0),
        xpLifetime: current.xpLifetime + (isNew ? 15 : 0),
        xpBalance: current.xpBalance + (isNew ? 15 : 0),
      })
      return next
    })
  }, [])

  const deleteRecording = useCallback(async (id: string) => {
    const recording = state.recordings.find((item) => item.id === id)
    await deleteMedia(id).catch(() => undefined)
    if (recording?.cloudRecordingId && recording.cloudStoragePath) {
      await deleteCloudRecording({
        id: recording.cloudRecordingId,
        storagePath: recording.cloudStoragePath,
      }).catch(() => undefined)
    }
    setState((current) => ({
      ...current,
      recordings: current.recordings.filter((item) => item.id !== id),
      community: current.community.filter((post) => post.recordingId !== id),
    }))
  }, [state.recordings])

  const shareRecording = useCallback((id: string) => {
    setState((current) => {
      const recording = current.recordings.find((item) => item.id === id)
      if (!current.premium || !recording || recording.shared) return current
      const post: CommunityPost = {
        id: `post-${id}`,
        recordingId: id,
        author: current.profile.name,
        context: recording.context,
        createdAt: new Date().toISOString(),
        text: recording.transcript || recording.prompt,
        mediaKind: current.premium ? recording.mediaKind : "none",
        hearts: 0,
        comments: [],
        mine: true,
      }
      return {
        ...current,
        recordings: current.recordings.map((item) => (item.id === id ? { ...item, shared: true } : item)),
        community: [post, ...current.community.filter((item) => item.id !== post.id)],
      }
    })
  }, [])

  const removePost = useCallback((id: string) => {
    setState((current) => {
      const post = current.community.find((item) => item.id === id)
      return {
        ...current,
        community: current.community.filter((item) => item.id !== id),
        recordings: post?.recordingId
          ? current.recordings.map((item) => (item.id === post.recordingId ? { ...item, shared: false } : item))
          : current.recordings,
      }
    })
  }, [])

  const toggleHeart = useCallback((id: string) => {
    setState((current) => {
      if (!current.premium) return current
      const liked = current.likedPosts.includes(id)
      return {
        ...current,
        likedPosts: liked ? current.likedPosts.filter((item) => item !== id) : [...current.likedPosts, id],
        community: current.community.map((post) =>
          post.id === id ? { ...post, hearts: Math.max(0, post.hearts + (liked ? -1 : 1)) } : post,
        ),
      }
    })
  }, [])

  const addComment = useCallback((id: string, text: string) => {
    const clean = text.trim()
    if (!clean) return
    setState((current) => {
      if (!current.premium) return current
      return {
      ...current,
      community: current.community.map((post) =>
        post.id === id
          ? {
              ...post,
              comments: [
                ...post.comments,
                { id: crypto.randomUUID(), author: current.profile.name, text: clean, createdAt: new Date().toISOString() },
              ],
            }
          : post,
      ),
      }
    })
  }, [])

  const purchaseWeaver = useCallback((id: string) => {
    const color = weaverColors.find((item) => item.id === id)
    if (!color) return { ok: false, message: "That color is unavailable." }
    let result = { ok: false, message: "Unable to complete the purchase." }
    setState((current) => {
      if (current.ownedWeavers.includes(id)) {
        result = { ok: true, message: `${color.name} is already yours.` }
        return { ...current, activeWeaver: id }
      }
      if (current.xpBalance < color.cost) {
        result = { ok: false, message: `You need ${color.cost - current.xpBalance} more XP.` }
        return current
      }
      result = { ok: true, message: `${color.name} unlocked.` }
      return {
        ...current,
        xpBalance: current.xpBalance - color.cost,
        ownedWeavers: [...current.ownedWeavers, id],
        activeWeaver: id,
      }
    })
    return result
  }, [])

  const equipWeaver = useCallback((id: string) => {
    setState((current) => (current.ownedWeavers.includes(id) ? { ...current, activeWeaver: id } : current))
  }, [])

  const updateSettings = useCallback((patch: Partial<AppState["settings"]>) => {
    setState((current) => ({ ...current, settings: { ...current.settings, ...patch } }))
  }, [])

  const updateProfileName = useCallback((name: string) => {
    const clean = name.trim().slice(0, 40)
    setState((current) => ({ ...current, profile: { ...current.profile, name: clean || "Storyteller" } }))
  }, [])

  const setPremium = useCallback((value: boolean) => setState((current) => ({ ...current, premium: value })), [])
  const completeOnboarding = useCallback((name?: string) => {
    const clean = name?.trim().slice(0, 40)
    setState((current) => ({
      ...current,
      profile: clean ? { ...current.profile, name: clean } : current.profile,
      onboardingComplete: true,
    }))
  }, [])

  const deleteAllRecordings = useCallback(async () => {
    const cloudRecordings = state.recordings
      .filter((recording) => recording.cloudRecordingId && recording.cloudStoragePath)
      .map((recording) => ({ id: recording.cloudRecordingId!, storagePath: recording.cloudStoragePath! }))
    await Promise.all([
      clearMedia().catch(() => undefined),
      deleteCloudRecordings(cloudRecordings).catch(() => undefined),
    ])
    setState((current) => ({ ...current, recordings: [], community: current.community.filter((post) => !post.mine) }))
  }, [state.recordings])

  const resetAll = useCallback(async () => {
    const cloudRecordings = state.recordings
      .filter((recording) => recording.cloudRecordingId && recording.cloudStoragePath)
      .map((recording) => ({ id: recording.cloudRecordingId!, storagePath: recording.cloudStoragePath! }))
    await Promise.all([
      clearMedia().catch(() => undefined),
      deleteCloudRecordings(cloudRecordings).catch(() => undefined),
    ])
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem("storytuner-state-v4")
      localStorage.removeItem("storytuner-state-v3")
    } catch {}
    setState(freshState())
  }, [state.recordings])


  const addCoachExchange = useCallback((user: string, assistant: string) => {
    const now = new Date().toISOString()
    const today = todayKey()
    setState((current) => {
      const priorMessages = current.coach.messages
      return {
        ...current,
        coach: {
          date: today,
          sent: current.coach.sent + 1,
          messages: [
            ...priorMessages,
            { id: crypto.randomUUID(), role: "user" as const, content: user, createdAt: now },
            { id: crypto.randomUUID(), role: "assistant" as const, content: assistant, createdAt: now },
          ].slice(-30),
        },
      }
    })
  }, [])

  const clearCoach = useCallback(() => {
    setState((current) => ({ ...current, coach: { ...current.coach, messages: [] } }))
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      ready,
      completeStage,
      saveResponse,
      addRecording,
      deleteRecording,
      shareRecording,
      removePost,
      toggleHeart,
      addComment,
      purchaseWeaver,
      equipWeaver,
      updateSettings,
      updateProfileName,
      setPremium,
      completeOnboarding,
      deleteAllRecordings,
      resetAll,
      addCoachExchange,
      clearCoach,
    }),
    [
      state,
      ready,
      completeStage,
      saveResponse,
      addRecording,
      deleteRecording,
      shareRecording,
      removePost,
      toggleHeart,
      addComment,
      purchaseWeaver,
      equipWeaver,
      updateSettings,
      updateProfileName,
      setPremium,
      completeOnboarding,
      deleteAllRecordings,
      resetAll,
      addCoachExchange,
      clearCoach,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error("useApp must be used inside AppProvider")
  return context
}

export function unitProgress(state: AppState, unitId: string) {
  const stages = (["read", "drill", "quiz"] as LessonStage[]).filter((stage) =>
    state.completed.includes(lessonId(unitId, stage)),
  )
  return { done: stages.length, total: 3, percent: Math.round((stages.length / 3) * 100) }
}

export function courseProgress(state: AppState) {
  const total = curriculum.length * 3
  const done = state.completed.filter((id) => id.includes("--")).length
  return { done, total, percent: Math.round((done / total) * 100) }
}

export const FREE_UNIT_LIMIT = 5
export const FREE_ARENA_LIMIT = 2
export const FREE_COACH_LIMIT = 5
export const FOUNDING_PRICE = "$11.99"
export const FUTURE_PRICE = "$24.99"

export function hasUnitPlanAccess(state: AppState, index: number) {
  return state.premium || index <= FREE_UNIT_LIMIT
}

export function isUnitUnlocked(state: AppState, index: number) {
  if (!hasUnitPlanAccess(state, index)) return false
  if (index <= 1) return true
  const previous = curriculum.find((unit) => unit.index === index - 1)
  return previous ? unitProgress(state, previous.id).done === 3 : false
}

export function nextLesson(state: AppState) {
  for (const unit of curriculum) {
    if (!hasUnitPlanAccess(state, unit.index)) break
    if (!isUnitUnlocked(state, unit.index)) break
    for (const stage of ["read", "drill", "quiz"] as LessonStage[]) {
      if (!state.completed.includes(lessonId(unit.id, stage))) return { unit, stage, id: lessonId(unit.id, stage) }
    }
  }
  return null
}

export function freeLessonLimitReached(state: AppState) {
  if (state.premium) return false
  return curriculum
    .filter((unit) => unit.index <= FREE_UNIT_LIMIT)
    .every((unit) => unitProgress(state, unit.id).done === 3)
}

export function arenaUsesToday(state: AppState) {
  return state.arenaUses[todayKey()] ?? 0
}

export function freeArenaRemaining(state: AppState) {
  return state.premium ? Number.POSITIVE_INFINITY : Math.max(0, FREE_ARENA_LIMIT - state.arenaTotal)
}

export function canRecordInArena(state: AppState) {
  return state.premium || state.arenaTotal < FREE_ARENA_LIMIT
}

