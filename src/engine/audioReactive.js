// Audio-reactive level for the rainbow edge glow ("audiolink"). Taps the
// background-music element via a Web Audio analyser so the rainbow dances to the
// music. SAFE: set up lazily, only resumed on a user gesture (same moment music
// unlocks), and the element's own volume/mute still apply (MediaElementSource
// taps the element AFTER its volume). getLevel() returns 0..1, or 0 if unavailable
// (the ring then falls back to a gentle idle pulse).
let ctx = null
let analyser = null
let data = null
let connected = false

export function setupMusicAnalyser(el) {
  if (typeof window === 'undefined' || !el) return
  if (connected) { ctx?.resume?.().catch(() => {}); return }   // already wired — just (re)resume
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  try {
    ctx = new AC()
    const src = ctx.createMediaElementSource(el)   // captures the element
    analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.82
    src.connect(analyser)
    analyser.connect(ctx.destination)              // music now flows out through the graph
    data = new Uint8Array(analyser.frequencyBinCount)
    connected = true
  } catch {
    ctx = null; analyser = null; data = null; connected = false
  }
  ctx?.resume?.().catch(() => {})
}

// Resume the context if the OS suspended it. CRUCIAL: the music is routed through
// this graph (createMediaElementSource), so a suspended context = silent music. The
// OS suspends it when the window loses focus / is covered (e.g. the RotBlock cover),
// and it doesn't auto-recover — so we nudge it back whenever we can.
export function resumeAnalyser() {
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
}
if (typeof window !== 'undefined') {
  window.addEventListener('focus', resumeAnalyser)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resumeAnalyser() })
}

// Dev-only probe for verifying the analyser + context state in the preview.
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__audioReactive = { getLevel: () => getLevel(), state: () => ctx?.state, connected: () => connected }
}

export function getLevel() {
  if (!analyser || !data) return 0
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})   // self-heal every frame
  try {
    analyser.getByteFrequencyData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    const avg = sum / data.length / 255            // 0..1 average magnitude
    return Math.min(1, avg * 2.4)                  // boost so typical music reaches a lively range
  } catch {
    return 0
  }
}
