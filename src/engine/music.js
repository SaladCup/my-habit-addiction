// Background music — played through Web Audio as a looping decoded buffer, the SAME
// path the SFX use (fetch → decodeAudioData → AudioBufferSourceNode → gain →
// destination). We do NOT use an <audio> element: in the packaged app it can't load
// the track over the custom app:// protocol (MediaError 4 — not even from a blob:
// URL), while fetch()+decodeAudioData works (the SFX prove it). Plays straight to
// destination (no createMediaElementSource, which would mute it cross-origin).
//
// Cost: the decoded track is held in memory (a few tens of MB). Worth it for music
// that actually plays. Browsers block audio until a gesture, so we resume + start on
// the first tap. The React side just pushes settings via setMusicConfig().
const SRC = '/music/bg-kawaii-pop.mp3'
// Master ceiling on loudness: actual gain = musicVolume * MUSIC_GAIN. The track is
// hot, so we scale the whole slider down (0.2 default → ~0.11) — keeps the 0–100% UI.
const MUSIC_GAIN = 0.55

let cfg = { muted: false, musicEnabled: true, musicVolume: 0.2 }
let ctx = null
let gainNode = null
let buffer = null
let bufferPromise = null
let source = null            // the currently-playing looping source, or null
let gestureHandler = null

function clamp(v) { return Math.max(0, Math.min(1, v)) }
function shouldPlay() { return cfg.musicEnabled && !cfg.muted && cfg.musicVolume > 0 }
function targetGain() { return shouldPlay() ? clamp(cfg.musicVolume * MUSIC_GAIN) : 0 }

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { return null }
    gainNode = ctx.createGain()
    gainNode.gain.value = targetGain()
    gainNode.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// Decode the track once (cached). Resolves to the AudioBuffer or null.
function ensureBuffer() {
  if (buffer) return Promise.resolve(buffer)
  if (bufferPromise) return bufferPromise
  const c = getCtx(); if (!c) return Promise.resolve(null)
  bufferPromise = fetch(SRC)
    .then(r => r.arrayBuffer())
    .then(a => c.decodeAudioData(a))
    .then(buf => { buffer = buf; return buf })
    .catch(() => { bufferPromise = null; return null })
  return bufferPromise
}

function startSource() {
  const c = getCtx()
  if (!c || !buffer || source) return
  source = c.createBufferSource()
  source.buffer = buffer
  source.loop = true
  source.connect(gainNode)
  source.start(0)
}

function stopSource() {
  if (source) {
    try { source.stop() } catch { /* */ }
    try { source.disconnect() } catch { /* */ }
    source = null
  }
}

function disarmGesture() {
  if (!gestureHandler) return
  window.removeEventListener('pointerdown', gestureHandler)
  window.removeEventListener('keydown', gestureHandler)
  window.removeEventListener('touchstart', gestureHandler)
  gestureHandler = null
}

// Start on the first user gesture (the AudioContext can't run until then).
function armGesture() {
  if (gestureHandler || typeof window === 'undefined') return
  gestureHandler = () => {
    disarmGesture()
    const c = getCtx(); if (!c) return
    c.resume().catch(() => {})
    ensureBuffer().then(buf => { if (buf && shouldPlay()) startSource() })
  }
  window.addEventListener('pointerdown', gestureHandler)
  window.addEventListener('keydown', gestureHandler)
  window.addEventListener('touchstart', gestureHandler)
}

// Exposed so a headless capture can confirm the music is loaded/playing.
if (typeof window !== 'undefined') {
  window.__musicState = () => ({
    ctx: ctx ? ctx.state : 'none', hasBuffer: !!buffer, playing: !!source,
    gain: gainNode ? +gainNode.gain.value.toFixed(3) : null,
  })
}

// The single entry point the app calls (on mount + on every settings change).
export function setMusicConfig(next) {
  cfg = { ...cfg, ...next }
  const c = getCtx()
  if (gainNode) gainNode.gain.value = targetGain()
  if (!c) return
  if (shouldPlay()) {
    if (c.state === 'running') {
      ensureBuffer().then(buf => { if (buf && shouldPlay()) startSource() })
    } else {
      ensureBuffer()      // pre-decode now; the gesture will resume + start
      armGesture()
    }
  } else {
    stopSource()
    disarmGesture()
  }
}
