const blockedFragments = [
  // Sexual / explicit
  "assman", "assguy", "assboy", "assgirl", "assface", "asshead", "assmaster",
  "dickguy", "dickboy", "dickgirl", "dickhead", "dickface", "dickmaster",
  "cockboy", "cockgirl", "cockhead", "cockface", "penis", "vagina", "pussy",
  "dildo", "porn", "porno", "nude", "nudes", "semen", "sperm", "ejaculate",
  "orgasm", "masturbat", "blowjob", "handjob", "onlyfans", "sexworker", "rapeme",
  "molest", "pedophile", "paedophile", "bestial", "incest", "cumslut", "cumdump",
  "boobies", "titties", "horny", "thot", "sexslave", "rapeplay",

  // General profanity / harassment
  "fuck", "fuk", "fuq", "phuck", "shit", "bitch", "asshole", "motherfucker",
  "cocksucker", "dumbass", "dipshit", "bullshit", "fuckface", "shithead",

  // Hate / extremist / targeted abuse. Severe terms are fragments on purpose so
  // separators, leetspeak and suffixes do not make them usable as public handles.
  "nigger", "nigga", "faggot", "kike", "chink", "spic", "wetback", "gook",
  "raghead", "tranny", "retard", "heilhitler", "whitepower", "whitepride88",
  "naziparty", "neonazi", "nazism", "fascist", "fascism", "whitesuprem", "supremacist",
  "aryanpride", "antisemitic", "homophobic", "racist", "racism", "sexist", "kkk", "1488",

  // Threats / self-harm bait
  "killyourself", "killurself", "suicidebait", "godie", "dieyou",
]

const blockedExact = new Set([
  "ass", "cock", "dick", "dih", "cum", "tits", "tit", "boobs", "boob", "anus",
  "whore", "slut", "bastard", "sex", "rape", "rapist", "stfu", "cunt", "twat",
  "wanker", "pedo", "nonce", "porn", "nazi", "hitler", "kkk",
  "nigger", "nigga", "faggot", "kike", "chink", "spic", "gook", "tranny", "retard",
  "fascist", "fascism", "nazism", "neonazi", "supremacist", "racist", "racism", "sexist",
  "homophobe", "homophobic", "antisemite", "antisemitic",
])

const suspiciousCombination = /(?:ass|dick|dih|cock|penis|cum|sex|boob|tit|pussy|fuck|shit|bitch|slut|whore|rape)(?:man|guy|boy|girl|kid|king|queen|lord|master|lover|face|head|69|420)$/

const reservedUsernameExact = new Set([
  "admin",
  "administrator",
  "moderator",
  "mod",
  "tellwise",
  "tell_wise",
  "tellwiseapp",
  "tellwise_admin",
  "tellwise_support",
  "tellwise_official",
  "storytuner",
  "story_tuner",
  "storytunerapp",
  "storytuner_admin",
  "support",
  "storytuner_support",
  "staff",
  "official",
  "storytuner_official",
  "security",
  "system",
  "help",
  "helpdesk",
  "parch",
])

const reservedUsernamePattern = /^(?:tellwise|storytuner|admin|administrator|moderator|support|staff|official|security|system|helpdesk|parch)/

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
    .replace(/2/g, "z")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5|\$/g, "s")
    .replace(/6/g, "g")
    .replace(/[7+]/g, "t")
    .replace(/8/g, "b")
    .replace(/9/g, "g")
    .replace(/@/g, "a")
}

function moderationForms(value: string) {
  const rawCollapsed = value.toLowerCase().replace(/[^a-z0-9]/g, "")
  const normalized = leetNormalize(value)
  const parts = normalized
    .replace(/[^a-z0-9_\s-]/g, " ")
    .split(/[\s_-]+/)
    .filter(Boolean)
  const collapsed = parts.join("")
  const squeezed = collapsed.replace(/(.)\1+/g, "$1")
  const lettersOnly = collapsed.replace(/[0-9]/g, "")
  const squeezedLettersOnly = lettersOnly.replace(/(.)\1+/g, "$1")
  return { parts, rawCollapsed, collapsed, squeezed, lettersOnly, squeezedLettersOnly }
}

export function isPublicNameAppropriate(value: string) {
  const forms = moderationForms(value)
  const candidates = [forms.rawCollapsed, forms.collapsed, forms.squeezed, forms.lettersOnly, forms.squeezedLettersOnly]

  if (forms.parts.some((part) => blockedExact.has(part))) return false
  if (candidates.some((candidate) => blockedExact.has(candidate))) return false
  if (blockedFragments.some((fragment) => candidates.some((candidate) => candidate.includes(fragment)))) return false
  return !candidates.some((candidate) => suspiciousCombination.test(candidate))
}

export function isReservedUsername(value: string) {
  const clean = value.trim().toLowerCase()
  return reservedUsernameExact.has(clean) || reservedUsernamePattern.test(clean)
}

export function validateUsername(value: string, options: { allowReserved?: boolean } = {}) {
  const clean = value.trim().toLowerCase()
  if (clean.length < 3 || clean.length > 20) {
    return "Use 3 to 20 lowercase letters, numbers, or underscores."
  }
  if (!/^[a-z0-9][a-z0-9_]*[a-z0-9]$/.test(clean) || clean.includes("__")) {
    return "Use only lowercase letters, numbers, or underscores. Do not start or end with an underscore."
  }
  if (!options.allowReserved && isReservedUsername(clean)) {
    return "That username is reserved by Tellwise. Choose another one."
  }
  if (!isPublicNameAppropriate(clean)) {
    return "Tellwise doesn't allow usernames with hateful, racist, sexual, vulgar, threatening, or harassing content."
  }
  return ""
}

export function validateDisplayName(value: string) {
  const clean = value.trim()
  if (!clean) return "Enter a display name."
  const letterCount = (clean.match(/\p{L}/gu) ?? []).length
  if (letterCount < 3) return "Display names must contain at least 3 letters."
  if (clean.length > 15) return "Display names can be no longer than 15 characters."
  if (!isPublicNameAppropriate(clean)) {
    return "Tellwise doesn't allow display names with hateful, racist, sexual, vulgar, threatening, or harassing content."
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

  let stem = pieces.join("").slice(0, 11)
  if (stem.length < 2 || !isPublicNameAppropriate(stem) || isReservedUsername(stem)) stem = "story"
  return stem
}

function fitSuggestion(stem: string, suffix: string) {
  const room = 20 - suffix.length - 1
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
  const numbered = `${stem.slice(0, 15)}_${String((hash % 89) + 10)}`.slice(0, 20)
  return Array.from(new Set([...suggestions, numbered])).filter((value) => !validateUsername(value)).slice(0, 3)
}
