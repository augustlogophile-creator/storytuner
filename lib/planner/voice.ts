function replacement(match: string, lower: string, upper: string) {
  return /^[A-Z]/.test(match) ? upper : lower
}

export function secondPersonDirection(value: string) {
  return String(value ?? "")
    .replace(/\bI am\b/g, "You are")
    .replace(/\bI'm\b/g, "You're")
    .replace(/\bI was\b/g, "You were")
    .replace(/\bI have\b/g, "You have")
    .replace(/\bI've\b/g, "You've")
    .replace(/\bI had\b/g, "You had")
    .replace(/\bwe are\b/gi, (match) => replacement(match, "you are", "You are"))
    .replace(/\bwe're\b/gi, (match) => replacement(match, "you're", "You're"))
    .replace(/\bwe were\b/gi, (match) => replacement(match, "you were", "You were"))
    .replace(/\bwe have\b/gi, (match) => replacement(match, "you have", "You have"))
    .replace(/\bwe've\b/gi, (match) => replacement(match, "you've", "You've"))
    .replace(/\bmyself\b/gi, (match) => replacement(match, "yourself", "Yourself"))
    .replace(/\bmy\b/gi, (match) => replacement(match, "your", "Your"))
    .replace(/\bmine\b/gi, (match) => replacement(match, "yours", "Yours"))
    .replace(/\bme\b/gi, (match) => replacement(match, "you", "You"))
    .replace(/\bI\b/g, "You")
    .replace(/\bourselves\b/gi, (match) => replacement(match, "yourself", "Yourself"))
    .replace(/\bour\b/gi, (match) => replacement(match, "your", "Your"))
    .replace(/\bours\b/gi, (match) => replacement(match, "yours", "Yours"))
    .replace(/\bus\b/gi, (match) => replacement(match, "you", "You"))
    .replace(/\bwe\b/gi, (match) => replacement(match, "you", "You"))
}
