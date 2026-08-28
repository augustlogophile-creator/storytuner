export type IntroFeedbackTone = "selection" | "action" | "page" | "back" | "typing" | "reveal"

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext
  __tellwiseIntroAudioContext?: AudioContext
}

function getIntroAudioContext(create = true) {
  if (typeof window === "undefined") return null
  const audioWindow = window as AudioWindow
  if (audioWindow.__tellwiseIntroAudioContext) return audioWindow.__tellwiseIntroAudioContext
  if (!create) return null

  const AudioContextConstructor = window.AudioContext || audioWindow.webkitAudioContext
  if (!AudioContextConstructor) return null

  try {
    audioWindow.__tellwiseIntroAudioContext = new AudioContextConstructor()
    return audioWindow.__tellwiseIntroAudioContext
  } catch {
    return null
  }
}

export function isIntroAudioUnlocked() {
  return getIntroAudioContext(false)?.state === "running"
}

export async function unlockIntroAudio() {
  const context = getIntroAudioContext(true)
  if (!context) return false
  if (context.state === "running") return true

  try {
    await context.resume()
    return context.state === "running"
  } catch {
    return false
  }
}

export function playIntroFeedbackTone(kind: IntroFeedbackTone) {
  try {
    const requestedAt = performance.now()
    const context = getIntroAudioContext(true)
    if (!context) return

    const play = () => {
      if (context.state !== "running") return
      const now = context.currentTime
      const gain = context.createGain()
      const oscillator = context.createOscillator()

      if (kind === "typing") {
        oscillator.type = "triangle"
        oscillator.frequency.setValueAtTime(690, now)
        gain.gain.setValueAtTime(.0001, now)
        gain.gain.exponentialRampToValueAtTime(.0065, now + .003)
        gain.gain.exponentialRampToValueAtTime(.0001, now + .018)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(now)
        oscillator.stop(now + .022)
        return
      }

      if (kind === "reveal") {
        oscillator.type = "triangle"
        oscillator.frequency.setValueAtTime(465, now)
        oscillator.frequency.exponentialRampToValueAtTime(520, now + .034)
        gain.gain.setValueAtTime(.0001, now)
        gain.gain.exponentialRampToValueAtTime(.012, now + .004)
        gain.gain.exponentialRampToValueAtTime(.0001, now + .045)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(now)
        oscillator.stop(now + .052)
        return
      }

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(kind === "selection" ? 520 : kind === "back" ? 405 : 585, now)
      if (kind === "page" || kind === "action") {
        oscillator.frequency.exponentialRampToValueAtTime(kind === "page" ? 720 : 790, now + .052)
      }
      gain.gain.setValueAtTime(.0001, now)
      gain.gain.exponentialRampToValueAtTime(kind === "selection" ? .022 : .028, now + .006)
      gain.gain.exponentialRampToValueAtTime(.0001, now + (kind === "selection" ? .052 : .082))
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + .09)
    }

    if (context.state === "suspended") {
      void context.resume().then(() => {
        if (kind === "typing" && performance.now() - requestedAt > 140) return
        play()
      }).catch(() => {})
      return
    }

    play()
  } catch {}
}
