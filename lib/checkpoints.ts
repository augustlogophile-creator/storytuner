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
  estimatedMinutes: number
  questions: CheckpointQuestion[]
  writing: {
    label: string
    prompt: string
    minWords: number
    kind: "analysis" | "story"
    criteria: string[]
  }
}

export const CHECKPOINT_PASSING_SCORE = 50

export const checkpoints: Checkpoint[] = [
  {
    id: "foundations-check",
    index: 1,
    afterUnit: 3,
    title: "Foundations Check",
    subtitle: "Units 1–3",
    description: "Story shape, finding material, ownership, and specific stakes.",
    xp: 35,
    estimatedMinutes: 11,
    questions: [
      {
        question: "A memory has a clean beginning, middle, and end, but the narrator never makes clear why the event mattered to them. Which diagnosis is most accurate?",
        options: ["It has shape but weak or missing stakes", "It has stakes but no shape", "It has change but too much detail", "It needs a surprise ending"],
        correct: 0,
        explanation: "Shape alone is not enough. Without clear personal stakes, the audience cannot tell why the events matter to the narrator.",
      },
      {
        question: "Which version is strongest raw material for a short true story?",
        options: ["The entire year my family moved three times", "The five minutes I sat in the new school parking lot before deciding whether to go inside", "Everything that happened during middle school", "The complete story of my soccer career"],
        correct: 1,
        explanation: "Small, specific moments are easier to shape and usually carry sharper emotional information than huge spans of time.",
      },
      {
        question: "What is the Removal Test really trying to uncover?",
        options: ["Whether the story contains enough named characters", "Whether the story still works if the ending is removed", "Whether the meaning lives in what happened to the narrator rather than in the bare event itself", "Whether the story can be told in under two minutes"],
        correct: 2,
        explanation: "The Removal Test strips away the narrator's inner experience so you can see whether the real story is hiding in the change the event created.",
      },
      {
        question: "A narrator says, ‘I was nervous because the interview mattered.’ Which revision makes the stakes most specific?",
        options: ["I was extremely, unbelievably nervous", "The interview was for a competitive internship", "I had already told my family I had the internship locked in, and I feared having to admit I was wrong", "Interviews are stressful for everyone"],
        correct: 2,
        explanation: "Specific stakes name exactly what the narrator wanted, feared, needed, or stood to lose.",
      },
      {
        question: "Which statement about stakes is most accurate?",
        options: ["Only dangerous situations have real stakes", "Internal stakes matter less than external stakes", "Stakes are defined by what matters personally to the narrator", "A story should hide its stakes until the ending"],
        correct: 2,
        explanation: "Stakes are personal, not objective. A small event can matter enormously if something meaningful is at risk for the narrator.",
      },
      {
        question: "Which memory best passes the ownership test?",
        options: ["A sibling's private crisis told mostly through guesses about what they must have felt", "A friend's breakup reconstructed from messages you were never shown", "Your own experience sitting beside a friend after bad news, limited to what you witnessed, felt, and did", "A classmate's family conflict explained from both parents' perspectives"],
        correct: 2,
        explanation: "A story is safest when it stays anchored in what you personally witnessed, felt, and did rather than claiming access to someone else's private inner life.",
      },
      {
        question: "A story has strong stakes and a clear sequence, but the narrator ends exactly where they began emotionally and behaviorally. What will most likely feel wrong?",
        options: ["The ending may feel like the story simply stops", "The beginning will feel too specific", "The stakes will automatically disappear", "The story will become non-chronological"],
        correct: 0,
        explanation: "Shape and stakes without change create expectation without a meaningful landing, so the story often feels unfinished.",
      },
      {
        question: "Which pairing is strongest because it combines external and internal stakes?",
        options: ["Missing a train + wanting breakfast", "A deadline is approaching + fearing that asking for help will prove you are incapable", "Rain outside + disliking wet shoes", "A loud room + wanting quiet"],
        correct: 1,
        explanation: "Strong stories often combine an external pressure with an internal fear, need, or belief that makes the pressure personally meaningful.",
      },
    ],
    writing: {
      label: "Applied analysis",
      prompt: "Choose one small, ordinary memory that could become a true story. In one focused response, identify its shape, specific stakes, and change. Explain why this moment is better material than a broader life event, and briefly confirm that the story can stay anchored in what you personally witnessed, felt, and did.",
      minWords: 110,
      kind: "analysis",
      criteria: [
        "identifies a clear beginning-middle-end shape",
        "states personal and specific stakes rather than generic importance",
        "identifies a meaningful before-and-after change",
        "uses one small specific memory rather than a broad life summary",
        "shows awareness of ownership by staying with what the narrator witnessed felt and did",
      ],
    },
  },
  {
    id: "craft-check",
    index: 2,
    afterUnit: 6,
    title: "Craft Check",
    subtitle: "Units 4–6",
    description: "Arc, meaning, scene and summary, reflection, detail, and memory.",
    xp: 40,
    estimatedMinutes: 8,
    questions: [
      {
        question: "Which sentence passes the Unit 4 one-sentence test because it describes meaning rather than plot?",
        options: ["I went to a party and something embarrassing happened", "I learned that trying to be everyone's favorite person was making me dishonest", "My car broke down and a stranger stopped", "We argued, left, and later apologized"],
        correct: 1,
        explanation: "The one-sentence test asks what the story means, not merely what happened.",
      },
      {
        question: "What most clearly separates an anecdote from a story with an arc?",
        options: ["A story is longer", "A story includes dialogue", "A story produces a meaningful before-and-after change in the narrator", "A story must end seriously"],
        correct: 2,
        explanation: "An arc is the meaningful shift between who the narrator is at the beginning and who they are at the end.",
      },
      {
        question: "Which passage is functioning as scene?",
        options: ["Over the next three months, I stopped checking the mailbox", "Looking back, I think I wanted the award more than I admitted", "My hand shook so hard that I set the phone on the kitchen counter and read the email twice", "By senior year, everything had changed"],
        correct: 2,
        explanation: "Scene slows down a specific moment so the listener can experience it almost in real time.",
      },
      {
        question: "A draft narrates every drive, doorway, text message, and meal between its important moments. Which craft move would help most?",
        options: ["Add more reflection", "Use summary and jump cuts to skip unimportant transitions", "Turn every transition into dialogue", "Add more sensory detail to each transition"],
        correct: 1,
        explanation: "Summary and jump cuts move efficiently between meaningful moments without forcing the audience through every literal step.",
      },
      {
        question: "Which detail best passes the relevance test?",
        options: ["A vivid description of a poster that never matters again", "The exact date of every minor event", "The only clean shelf in a chaotic room holding one carefully dusted family photo", "A complete inventory of everything on a desk"],
        correct: 2,
        explanation: "A strong detail earns its place by revealing character, sharpening a moment, or supporting the story's one-sentence meaning.",
      },
      {
        question: "Which statement about memory is most consistent with the course?",
        options: ["Any compressed conversation is automatically dishonest", "Memory should be treated like a perfect recording", "Minor uncertainty or careful compression can be honest if the teller stays truthful about the experience and avoids inventing other people's inner thoughts", "A narrator should confidently state what everyone else was feeling"],
        correct: 2,
        explanation: "Memory is imperfect. Storytelling can acknowledge or simplify minor details while staying honest about meaning and avoiding invented certainty about others.",
      },
      {
        question: "A short story is 80% summary, then ends with a paragraph explaining what the narrator learned. What is the strongest revision?",
        options: ["Add even more reflection", "Convert the most important turning point into a scene and use reflection more sparingly", "Remove all summary", "Add more names and dates"],
        correct: 1,
        explanation: "Important turning points usually deserve scene. Reflection works best in brief, deliberate doses rather than replacing the experience itself.",
      },
      {
        question: "Which revision most effectively turns a generic character description into revealing detail?",
        options: ["My coach was extremely intense", "My coach cared a lot", "Before every game, my coach retied the same shoelace three times in the same order", "My coach was unlike anyone else"],
        correct: 2,
        explanation: "Specific behavior lets the audience infer character instead of relying on a generic adjective.",
      },
    ],
    writing: {
      label: "Mini story",
      prompt: "Write a 150–230 word true mini-story with a real arc. Build at least one important moment as a scene, use summary to move efficiently through less important time, include no more than one brief reflection, and choose only details that support the story's one-sentence meaning. Stay honest about any detail you cannot know for certain.",
      minWords: 150,
      kind: "story",
      criteria: [
        "contains a meaningful before-and-after arc",
        "has a clear one-sentence meaning beneath the plot",
        "includes at least one important moment told as scene",
        "uses summary purposefully to compress less important time",
        "uses reflection briefly rather than over-explaining",
        "selects details that support meaning and avoids invented certainty about other people's inner thoughts",
      ],
    },
  },
  {
    id: "truth-structure-check",
    index: 3,
    afterUnit: 9,
    title: "Truth & Structure Check",
    subtitle: "Units 7–9",
    description: "Emotional honesty, readiness, purposeful humor, and structure.",
    xp: 40,
    estimatedMinutes: 8,
    questions: [
      {
        question: "Which line communicates emotion most effectively through specificity?",
        options: ["I was devastated", "It was the saddest day ever", "I kept folding the same receipt into smaller squares because I could not make myself look up", "Everyone could tell I was upset"],
        correct: 2,
        explanation: "Emotional truth usually lands through specific behavior, sensation, or detail rather than announcing the emotion directly.",
      },
      {
        question: "Which is the clearest sign that a personal story may not be ready to tell yet?",
        options: ["The ending is bittersweet", "The teller cannot yet step back from the event enough to describe its meaning or resolution", "The story is not funny", "The story is under five minutes"],
        correct: 1,
        explanation: "Readiness requires enough distance to tell the story rather than only relive the event.",
      },
      {
        question: "The course describes telling from a scar rather than an open wound. What does that distinction mean?",
        options: ["Only old stories are worth telling", "The teller has enough distance to remain emotionally honest while still seeing the shape and meaning of the experience", "The teller should remove all emotion", "The story must have a positive ending"],
        correct: 1,
        explanation: "A scar still carries emotion, but the teller has enough perspective to shape and understand the experience.",
      },
      {
        question: "What is the strongest use of humor in a serious true story?",
        options: ["A joke inserted only to keep the audience entertained", "A funny detail that also reveals character, advances events, or deepens atmosphere", "A punchline that changes the facts", "A joke after every emotional moment"],
        correct: 1,
        explanation: "Humor earns its place when it serves the story rather than functioning as decoration.",
      },
      {
        question: "Which statement best describes the straight-faced build approach to humor?",
        options: ["The narrator announces that a joke is coming", "The narrator plays the situation plainly and lets the absurdity emerge without over-signaling it", "The narrator explains why each line is funny", "The narrator exaggerates every event"],
        correct: 1,
        explanation: "Straight-faced humor lets the audience discover the comedy through the situation instead of being pushed toward the laugh.",
      },
      {
        question: "When is a non-chronological structure most justified?",
        options: ["Whenever the narrator wants to sound sophisticated", "When changing the order makes the material clearer, more meaningful, or more compelling without confusing the listener", "Whenever the story has more than one scene", "When the narrator wants to hide the stakes"],
        correct: 1,
        explanation: "Structure is a tool. The best order is the one that serves the material and remains understandable.",
      },
      {
        question: "A narrator wants to open with the ending, then return to how they got there. What should they test before committing to that structure?",
        options: ["Whether the opening reveals enough to create curiosity without removing the tension that carries the story", "Whether the story contains a joke", "Whether every scene has equal length", "Whether the final scene is chronological"],
        correct: 0,
        explanation: "A structural choice should preserve the audience's reason to keep listening, not reveal so much that the remaining story loses pressure.",
      },
      {
        question: "Which revision shows emotional honesty without forcing oversharing?",
        options: ["Inventing a more dramatic emotion so the story feels important", "Choosing a truthful, specific feeling the narrator is actually comfortable naming and shaping the story around that", "Removing every vulnerable detail", "Telling a private story despite feeling unable to continue"],
        correct: 1,
        explanation: "Emotional honesty does not require maximum disclosure. It requires truthfulness about the experience within the teller's actual readiness and boundaries.",
      },
    ],
    writing: {
      label: "Structure test-drive",
      prompt: "Choose a story you might actually tell. In 120–190 words, state the emotional truth you are willing to share, explain whether the material is ready to tell, choose a structure, and defend that order against at least one alternative. If humor belongs, identify the moment and explain what it does besides getting a laugh.",
      minWords: 120,
      kind: "analysis",
      criteria: [
        "states a specific emotionally honest core without forcing oversharing",
        "shows a thoughtful readiness judgment",
        "chooses a clear structure that serves the material",
        "compares the chosen structure with at least one credible alternative",
        "uses humor only if it also serves character events or atmosphere",
      ],
    },
  },
  {
    id: "performance-check",
    index: 4,
    afterUnit: 12,
    title: "Performance Check",
    subtitle: "Units 10–12",
    description: "Openings, endings, delivery, rehearsal, nerves, and audience awareness.",
    xp: 45,
    estimatedMinutes: 9,
    questions: [
      {
        question: "Which opening is closest to a strong cold open?",
        options: ["When I was younger, a lot of things happened that shaped me", "I should probably give you some background first", "The elevator doors closed before I realized my phone was still on the desk upstairs", "This story taught me an important lesson"],
        correct: 2,
        explanation: "A cold open begins mid-action in a specific moment with no preamble.",
      },
      {
        question: "What is the difference between a cold open and a single-frame opening?",
        options: ["A single-frame opening uses exactly one necessary sentence of context before action", "A cold open is always funny", "A single-frame opening reveals the ending", "A cold open can only be used in fiction"],
        correct: 0,
        explanation: "A single-frame opening gives one sentence of necessary context, then moves directly into action.",
      },
      {
        question: "Which ending is strongest according to the course?",
        options: ["And that's when I realized home is wherever your family is", "I finally unpacked the last box, and when my sister asked for the scissors, I knew exactly which drawer", "That day taught me more than I can explain", "So, yeah, that's basically what happened"],
        correct: 1,
        explanation: "Strong endings show the change through a concrete image or action rather than stating the lesson.",
      },
      {
        question: "What should happen immediately after the strongest final line?",
        options: ["Explain the meaning", "Add a joke", "Stop and let the line land", "Repeat the opening"],
        correct: 2,
        explanation: "Once the strongest final line lands, extra explanation usually weakens it.",
      },
      {
        question: "Why is familiarization usually safer than word-for-word memorization?",
        options: ["It lets the wording move while the story's shape and key lines remain secure", "It eliminates the need to rehearse", "It guarantees zero nerves", "It makes every telling identical"],
        correct: 0,
        explanation: "Familiarization protects the story's structure without making the teller dependent on a fragile fixed sequence of words.",
      },
      {
        question: "Which delivery habit is most likely to make an important line land harder?",
        options: ["Keeping one constant pace", "A deliberate pause immediately before the line", "Adding a spoiler phrase such as 'the craziest thing happened'", "Generalizing the moment into 'you know how we all feel'"],
        correct: 1,
        explanation: "A deliberate pause gives an important line more weight and lets the audience lean toward it.",
      },
      {
        question: "What is a bridging phrase for?",
        options: ["Giving unfamiliar listeners only the context they need without stopping the story for a lecture", "Explaining every cultural reference in detail", "Replacing a scene", "Telling the audience what lesson to take"],
        correct: 0,
        explanation: "A bridging phrase preserves momentum while supplying the minimum context needed to follow.",
      },
      {
        question: "Which response to nerves best matches the course?",
        options: ["Fight every visible sign of nervousness so the audience cannot detect it", "Plant your feet, breathe slowly, have water available, and accept that some visible nerves are normal", "Memorize every word to eliminate uncertainty", "Speed up so the story ends sooner"],
        correct: 1,
        explanation: "Presence comes from grounding and acceptance, not pretending nerves do not exist.",
      },
    ],
    writing: {
      label: "Spoken-story draft",
      prompt: "Write a 180–260 word story you could genuinely tell aloud. Open with either a cold open or a single-frame opening, move toward a clear landing, and end on a concrete line or image without explaining the lesson afterward. Then add two short delivery notes: one place you would deliberately pause, and one brief bridging phrase you would use if your audience needed context.",
      minWords: 180,
      kind: "story",
      criteria: [
        "opens immediately using a cold open or disciplined single-frame setup",
        "has a clear spoken-story shape that is easy to follow",
        "ends with a concrete earned landing rather than a stated lesson",
        "sounds natural enough to tell rather than recite word for word",
        "identifies one purposeful deliberate pause",
        "uses a brief bridging phrase that adds only necessary context",
      ],
    },
  },
  {
    id: "course-check",
    index: 5,
    afterUnit: 15,
    title: "Final Course Check",
    subtitle: "Units 13–15",
    description: "Adaptation, listening, and integrating the full storytelling process.",
    xp: 50,
    estimatedMinutes: 10,
    questions: [
      {
        question: "When adapting the same underlying story from a five-minute telling to an interview answer, what should change most?",
        options: ["The truth of the story", "Length, formality, number of scenes, and amount of context", "Whether the story needs stakes", "The narrator's point of view"],
        correct: 1,
        explanation: "The core craft remains. The format changes to fit the purpose, audience, and available time.",
      },
      {
        question: "Why is a short story usually stronger evidence than saying, ‘I am resilient’?",
        options: ["It is longer", "It demonstrates the quality through a specific event instead of merely claiming it", "It avoids detail", "It guarantees the listener agrees"],
        correct: 1,
        explanation: "Story as evidence lets the audience witness the quality in action rather than being asked to accept a label.",
      },
      {
        question: "What additional element does advocacy storytelling often need?",
        options: ["A villain", "A clear call to action that tells the audience what to do with the feeling the story created", "A surprise twist", "A longer backstory"],
        correct: 1,
        explanation: "Advocacy adds a clear call to action so the emotional effect of the story can move toward a concrete response.",
      },
      {
        question: "Which question is most likely to surface a useful family story?",
        options: ["Tell me about your life", "What is the story everyone in the family always tells about you?", "What year were you born?", "What are all the places you have lived?"],
        correct: 1,
        explanation: "Concrete questions surface specific moments more reliably than broad requests for an entire life history.",
      },
      {
        question: "Which listening behavior best develops storytelling craft?",
        options: ["Waiting for a chance to tell a similar story", "Noticing pauses, wording, and endings, then asking what specifically made them work", "Interrupting whenever context is unclear", "Taking over the conversation when the teller slows down"],
        correct: 1,
        explanation: "Attentive listening turns other people's craft choices into direct, transferable learning.",
      },
      {
        question: "What does the course say about controlling a story's impact on a particular listener?",
        options: ["A skilled teller can completely control it", "It can be controlled by memorization", "The teller can shape the story carefully, but cannot fully predict or control how a particular listener will receive it", "Impact is irrelevant"],
        correct: 2,
        explanation: "A teller controls craft choices, not the complete internal response of another person.",
      },
      {
        question: "In the capstone, why do the twelve passes happen in a deliberate sequence?",
        options: ["Each later decision builds on earlier foundations such as shape, stakes, meaning, and ownership", "The order is arbitrary", "It makes the story longer", "It ensures every technique appears equally often"],
        correct: 0,
        explanation: "The process moves from foundational decisions toward structure, language, delivery, adaptation, and audience feedback so later choices rest on a coherent story.",
      },
      {
        question: "Which final revision best reflects the course as a whole?",
        options: ["Add every technique you learned so the audience can see your skill", "Keep only the techniques and details that strengthen the meaning, clarity, audience fit, and lived truth of the story", "Make every section the same length", "Replace uncertainty with confident invented detail"],
        correct: 1,
        explanation: "The full craft works as one system. Techniques are tools serving a coherent story, not decorations to force into every telling.",
      },
    ],
    writing: {
      label: "Final story",
      prompt: "Write a 240–360 word true story for one real situation: an interview, essay, toast, family story, or cause you care about. Apply the course naturally. Make the stakes and change clear, select only useful details, choose a deliberate structure, open and end with precision, and shape the language for the real audience and purpose. If the situation is advocacy, include an appropriate call to action. Do not force every technique into the story simply to prove you know it.",
      minWords: 240,
      kind: "story",
      criteria: [
        "has clear shape stakes and change",
        "stays ethically anchored in the narrator's own experience",
        "selects details that support meaning rather than clutter",
        "uses a deliberate understandable structure",
        "has an effective opening and a clean concrete ending",
        "fits the chosen real-world audience purpose length and formality",
        "feels coherent rather than overloaded with techniques",
      ],
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
