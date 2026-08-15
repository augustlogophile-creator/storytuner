const blockedFragments = [
  "assman", "assguy", "assboy", "assgirl", "assface", "asshead", "assmaster",
  "dickguy", "dickboy", "dickgirl", "dickhead", "dickface", "dickmaster",
  "cockboy", "cockgirl", "cockhead", "cockface", "poop", "penis", "vagina",
  "pussy", "dildo", "porn", "porno", "nude", "nudes", "semen", "sperm",
  "ejaculate", "orgasm", "masturbat", "blowjob", "handjob", "fuck", "fuk",
  "phuck", "shit", "bitch", "asshole", "motherfucker", "cocksucker", "nazi",
  "kkk", "heilhitler", "hitler", "suicidebait", "killurself", "killyourself",
  "onlyfans", "sexworker", "rapeme", "molest", "pedophile", "bestial",
  "incest", "cumslut", "cumdump", "boobies", "titties", "horny", "thot",
]

const blockedExact = new Set([
  "ass", "cock", "dick", "cum", "tits", "tit", "boobs", "boob", "anus",
  "whore", "slut", "bastard", "sex", "rape", "rapist", "stfu", "nigger",
  "nigga", "faggot", "retard", "cunt", "twat", "wanker", "pedo", "nonce",
])

const suspiciousCombination = /(?:ass|dick|cock|penis|cum|sex|boob|tit|pussy|fuck|shit|bitch|slut|whore)(?:man|guy|boy|girl|kid|king|queen|lord|master|lover|face|head|69|420)$/

const suggestionSuffixes = [
  "tells",
  "weaves",
  "storycraft",
  "pages",
  "narrates",
  "moments",
  "drafts",
  "voices",
  "threads",
]

function leetNormalize(value: string) {
  return value
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5|\$/g, "s")
    .replace(/[7+]/g, "t")
    .replace(/8/g, "b")
    .replace(/@/g, "a")
}

function publicNameParts(value: string) {
  return leetNormalize(value)
    .replace(/[^a-z0-9_\s-]/g, " ")
    .split(/[\s_-]+/)
    .filter(Boolean)
}

export function isPublicNameAppropriate(value: string) {
  const parts = publicNameParts(value)
  const collapsed = parts.join("")
  const squeezed = collapsed.replace(/(.)\1+/g, "$1")

  if (parts.some((part) => blockedExact.has(part))) return false
  if (blockedFragments.some((fragment) => collapsed.includes(fragment) || squeezed.includes(fragment))) return false
  return !suspiciousCombination.test(collapsed)
}

export function validateUsername(value: string) {
  const clean = value.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9_]{2,23}$/.test(clean)) {
    return "Use 3 to 24 lowercase letters, numbers, or underscores. Start with a letter or number."
  }
  if (!isPublicNameAppropriate(clean)) {
    return "Choose a different username. Vulgar, sexual, hateful, or harassing terms are not allowed."
  }
  return ""
}

export function validateDisplayName(value: string) {
  const clean = value.trim()
  if (!clean) return "Enter a display name."
  if (clean.length > 15) return "Display names can be no longer than 15 characters."
  if (!isPublicNameAppropriate(clean)) {
    return "Choose a different display name. Vulgar, sexual, hateful, or harassing terms are not allowed."
  }
  return ""
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0)
}

function cleanEmailStem(email: string) {
  const local = email.split("@")[0]?.toLowerCase() ?? ""
  const pieces = local
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .split(/\s+/)
    .map((piece) => piece.replace(/[^a-z0-9]/g, ""))
    .filter((piece) => piece.length >= 2 && !["mail", "email", "account", "user", "hello"].includes(piece))

  let stem = pieces.join("").slice(0, 13)
  if (stem.length < 2 || !isPublicNameAppropriate(stem)) stem = "story"
  return stem
}

function fitSuggestion(stem: string, suffix: string) {
  const room = 24 - suffix.length - 1
  const fittedStem = stem.slice(0, Math.max(2, room))
  return `${fittedStem}_${suffix}`
}

export function usernameSuggestionsFromEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const stem = cleanEmailStem(normalizedEmail)
  const hash = stableHash(normalizedEmail || stem)
  const picks = [
    suggestionSuffixes[hash % suggestionSuffixes.length],
    suggestionSuffixes[(hash + 3) % suggestionSuffixes.length],
    suggestionSuffixes[(hash + 6) % suggestionSuffixes.length],
  ]

  const suggestions = picks.map((suffix) => fitSuggestion(stem, suffix))
  const numbered = `${stem.slice(0, 18)}_${String((hash % 89) + 10)}`.slice(0, 24)
  return Array.from(new Set([...suggestions, numbered])).filter((value) => !validateUsername(value)).slice(0, 3)
}
