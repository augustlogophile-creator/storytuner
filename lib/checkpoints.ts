export type CheckpointQuestion = {
  question: string
  options: string[]
  correct: number
  explanation: string
}

export type Checkpoint = {
  id: string
  index: number
  afterUnit: number
  title: string
  subtitle: string
  description: string
  xp: number
  questions: CheckpointQuestion[]
  writing: {
    label: string
    prompt: string
    minWords: number
    kind: "analysis" | "story"
    criteria: string[]
  }
}

export const checkpoints: Checkpoint[] = [
  {
    id: "foundations-check",
    index: 1,
    afterUnit: 3,
    title: "Foundations Check",
    subtitle: "Units 1–3",
    description: "Story shape, finding material, and stakes.",
    xp: 35,
    questions: [
      {
        question: "Which combination turns a plain event into a story in this course?",
        options: ["Shape, stakes, and change", "Dialogue, humor, and suspense", "A hero, conflict, and a moral", "Setup, twist, and resolution"],
        correct: 0,
        explanation: "The course begins with three foundations: a clear shape, specific stakes, and a meaningful change.",
      },
      {
        question: "Which is usually the strongest place to start looking for story material?",
        options: ["The biggest event of your life", "A small, specific moment that still feels vivid", "The most impressive accomplishment you can remember", "An event with as many characters as possible"],
        correct: 1,
        explanation: "Small, specific moments are easier to shape and often carry more emotional precision than huge spans of time.",
      },
      {
        question: "What makes stakes specific?",
        options: ["The event is objectively dangerous", "The audience already knows why it matters", "The narrator can name what they wanted, feared, needed, or stood to lose", "The story has a villain"],
        correct: 2,
        explanation: "Stakes are personal. They become clear when the narrator names what mattered to them in that moment.",
      },
      {
        question: "A story has a beginning, middle, and end, but the narrator cares about nothing in particular. What is most clearly missing?",
        options: ["Stakes", "Chronology", "Dialogue", "A surprise ending"],
        correct: 0,
        explanation: "Without stakes, the audience cannot tell why the events matter to the narrator.",
      },
    ],
    writing: {
      label: "Apply it",
      prompt: "Choose one ordinary memory. In a short paragraph, identify the story's shape, the specific stakes, and the change. Then explain why this small moment is worth telling.",
      minWords: 70,
      kind: "analysis",
      criteria: ["names a clear beginning-middle-end shape", "states personal and specific stakes", "identifies a meaningful change", "uses one small, specific memory rather than a huge life summary"],
    },
  },
  {
    id: "craft-check",
    index: 2,
    afterUnit: 6,
    title: "Craft Check",
    subtitle: "Units 4–6",
    description: "Arc, scene and summary, reflection, and detail.",
    xp: 40,
    questions: [
      {
        question: "What is the clearest difference between an anecdote and a story with an arc?",
        options: ["A story is always longer", "A story includes a meaningful before-and-after change", "An anecdote cannot be funny", "A story must use dialogue"],
        correct: 1,
        explanation: "An arc is the meaningful shift between who the narrator is at the beginning and who they are at the end.",
      },
      {
        question: "Which mode slows down and lets the audience experience a specific moment almost in real time?",
        options: ["Summary", "Reflection", "Scene", "Backstory"],
        correct: 2,
        explanation: "Scene plays out a specific moment with enough concrete detail for the listener to feel present inside it.",
      },
      {
        question: "What is summary for?",
        options: ["Skipping time efficiently without losing the thread", "Explaining every feeling", "Making the ending more dramatic", "Replacing all scenes"],
        correct: 0,
        explanation: "Summary compresses time so the story can move past less important material efficiently.",
      },
      {
        question: "Which detail is most likely to earn its place?",
        options: ["A vivid detail unrelated to the story's meaning", "Every date and name you can remember", "A specific detail that reveals character or supports the story's meaning", "The longest possible description of the setting"],
        correct: 2,
        explanation: "Strong details do more than decorate. They reveal character, sharpen a moment, or support the story's meaning.",
      },
    ],
    writing: {
      label: "Mini story",
      prompt: "Write a 120–200 word true mini-story. Include at least one scene, use summary only where you need to move through time, add one brief reflection, and choose two or three specific details that support the story's meaning.",
      minWords: 120,
      kind: "story",
      criteria: ["contains a real arc or before-and-after shift", "includes at least one clear scene", "uses summary purposefully rather than narrating every step", "uses brief reflection rather than over-explaining", "selects specific details that support meaning"],
    },
  },
  {
    id: "truth-structure-check",
    index: 3,
    afterUnit: 9,
    title: "Truth & Structure Check",
    subtitle: "Units 7–9",
    description: "Emotional honesty, humor, readiness, and structure.",
    xp: 40,
    questions: [
      {
        question: "What does emotional honesty usually look like on the page or out loud?",
        options: ["Naming every emotion directly", "Using specific behavior, sensation, or detail that lets the feeling come through", "Making the story more dramatic than it was", "Avoiding unflattering emotions"],
        correct: 1,
        explanation: "Specificity usually communicates emotion more powerfully than simply announcing the feeling.",
      },
      {
        question: "When might a personal story simply not be ready to tell yet?",
        options: ["When it is not funny", "When the teller cannot yet step back from the event enough to describe its meaning or resolution", "When it is less than five minutes long", "When the ending is bittersweet"],
        correct: 1,
        explanation: "Readiness requires enough distance to tell the story rather than only relive it.",
      },
      {
        question: "What is the decoration test for humor?",
        options: ["Whether the joke gets a laugh", "Whether the joke is short", "Whether the funny detail also reveals character, advances events, or builds atmosphere", "Whether every serious story contains a joke"],
        correct: 2,
        explanation: "Humor earns its place when it also serves the story instead of existing only as decoration.",
      },
      {
        question: "What is the best reason to choose a non-chronological structure?",
        options: ["It always sounds more sophisticated", "It best serves the material without confusing the listener", "Chronological stories are boring", "It lets you hide missing information"],
        correct: 1,
        explanation: "Structure is a tool. The right order is the one that best serves the story and remains easy to follow.",
      },
    ],
    writing: {
      label: "Structure test-drive",
      prompt: "Take a story you might tell. In 90–160 words, name the emotional truth you are willing to share, choose a structure for the story, and explain why that order is better than at least one alternative. If you plan to use humor, explain what else the funny moment reveals.",
      minWords: 90,
      kind: "analysis",
      criteria: ["states an emotionally honest core without forcing oversharing", "chooses a clear structure", "explains why that structure serves the material", "compares it with an alternative", "uses humor only if it serves character, events, or atmosphere"],
    },
  },
  {
    id: "performance-check",
    index: 4,
    afterUnit: 12,
    title: "Performance Check",
    subtitle: "Units 10–12",
    description: "Openings, endings, delivery, nerves, and audience awareness.",
    xp: 45,
    questions: [
      {
        question: "What is a cold open?",
        options: ["Starting with a long explanation", "Beginning mid-action in a specific moment", "Beginning with the lesson the story teaches", "Starting with a joke"],
        correct: 1,
        explanation: "A cold open starts inside a specific moment with no preamble.",
      },
      {
        question: "What should happen immediately after your strongest final line?",
        options: ["Explain the lesson", "Add one more sentence just in case", "Stop and allow silence", "Repeat the opening"],
        correct: 2,
        explanation: "Once the ending lands, stopping cleanly gives it more weight than an extra trailing explanation.",
      },
      {
        question: "Why is familiarization usually safer than word-for-word memorization?",
        options: ["It lets the wording move while the story's shape and key lines stay secure", "It removes the need to rehearse", "It makes every telling identical", "It guarantees you will never feel nervous"],
        correct: 0,
        explanation: "Familiarization makes the story flexible. Losing one exact word does not derail the whole telling.",
      },
      {
        question: "What is a bridging phrase for?",
        options: ["Adding another scene", "Giving unfamiliar listeners just enough context to follow without stopping the story for a lecture", "Explaining the moral", "Replacing the ending"],
        correct: 1,
        explanation: "A bridging phrase supplies the minimum context an audience needs while preserving momentum.",
      },
    ],
    writing: {
      label: "Spoken-story draft",
      prompt: "Write a 150–240 word story you could tell aloud. Open with either a cold open or a single-frame opening, build toward a clear landing, and end on a concrete line or image rather than a stated lesson. After the story, add one short sentence naming where you would pause when telling it.",
      minWords: 150,
      kind: "story",
      criteria: ["opens immediately and specifically", "has a clear spoken-story shape", "ends with a concrete earned landing instead of an explained moral", "sounds natural enough to tell rather than recite", "identifies one useful deliberate pause"],
    },
  },
  {
    id: "course-check",
    index: 5,
    afterUnit: 15,
    title: "Final Course Check",
    subtitle: "Units 13–15",
    description: "Adaptation, listening, and bringing the full craft together.",
    xp: 50,
    questions: [
      {
        question: "When adapting the same story for an interview instead of a five-minute stage telling, what changes most?",
        options: ["The underlying truth of the story", "Length, formality, and how much context the audience needs", "The narrator's point of view", "Whether the story needs stakes"],
        correct: 1,
        explanation: "The same craft still applies. What changes is the format: length, formality, and audience context.",
      },
      {
        question: "Why is a story often stronger evidence than saying 'I am resilient'?",
        options: ["It is always longer", "It demonstrates the quality through a specific event instead of merely claiming it", "It avoids any need for detail", "It guarantees the audience agrees"],
        correct: 1,
        explanation: "A concrete story lets the audience see the quality in action rather than being asked to accept a label.",
      },
      {
        question: "What is one way listening makes you a better storyteller?",
        options: ["It teaches you to interrupt at the right moment", "It lets you notice craft choices such as pauses, wording, and endings in other people's stories", "It gives you stories to copy", "It removes the need to practice"],
        correct: 1,
        explanation: "Attentive listening trains your ear for choices that work and why they work.",
      },
      {
        question: "Which capstone habit best protects the story from becoming a collection of disconnected techniques?",
        options: ["Checking every craft choice against the story's meaning and the audience's ability to follow", "Using every structure you learned", "Adding as many details as possible", "Making every section the same length"],
        correct: 0,
        explanation: "The tools should serve one coherent story. They are not a checklist of decorations to force into every telling.",
      },
    ],
    writing: {
      label: "Final story",
      prompt: "Write a 220–360 word true story for a real situation: an interview, essay, toast, family story, or cause you care about. Apply the course naturally: clear stakes and change, selected details, a deliberate structure, an effective opening and ending, and language that fits the audience. Do not force every technique in just to prove you know it.",
      minWords: 220,
      kind: "story",
      criteria: ["has clear shape, stakes, and change", "selects details that support meaning", "uses a deliberate and understandable structure", "has an effective opening and ending", "fits the chosen real-world audience and purpose", "feels coherent rather than overloaded with techniques"],
    },
  },
]

export function checkpointKey(id: string) {
  return `checkpoint:${id}`
}

export function getCheckpoint(id: string) {
  return checkpoints.find((checkpoint) => checkpoint.id === id)
}

export function getCheckpointAfterUnit(unitIndex: number) {
  return checkpoints.find((checkpoint) => checkpoint.afterUnit === unitIndex)
}

export function getCheckpointBeforeUnit(unitIndex: number) {
  return checkpoints.find((checkpoint) => checkpoint.afterUnit === unitIndex - 1)
}
