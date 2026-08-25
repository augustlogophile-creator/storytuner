export function recordingTranscriptLooksHeavilyEdited(durationSeconds: number, transcript: string) {
  const duration = Math.max(0, Number.isFinite(durationSeconds) ? durationSeconds : 0)
  const words = transcript.trim().split(/\s+/).filter(Boolean).length

  // Spoken English is normally far below this ceiling. The generous buffer is
  // intentional so normal cleanup never disables audio sharing. It only catches
  // obvious cases such as a one-second clip followed by a manually written story.
  const generousMaximumWords = Math.ceil(duration * 4.25 + 8)
  return words >= 12 && words > generousMaximumWords
}
