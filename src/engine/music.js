// Background music — a single looping HTMLAudioElement (streamed, NOT decoded
// into a Web Audio buffer like the SFX in audio.js; a multi-minute song would
// be wasteful to hold as a decoded buffer). Lives entirely separate from the
// SFX system, so music volume and SFX volume are independent.
//
// Browsers block autoplay until the user interacts, so the first play() may
// reject — we then arm a one-time gesture listener and start on the first tap.
// The React side just pushes settings in via setMusicConfig(); this module owns
// the element, the play/pause logic, and the autoplay-unlock dance.
//
// NOTE: the music plays DIRECTLY through the element — we deliberately do NOT route
// it through a Web Audio analyser. Doing so (createMediaElementSource) silenced the
// music in the packaged app: the track is served over the custom app:// protocol,
// which Web Audio treats as cross-origin and mutes. Reliable music > a beat-reactive
// rainbow (the rainbow still glows/breathes on its own).

const SRC = '/music/bg-kawaii-pop.mp3'
// Master ceiling on music loudness: the actual element volume = musicVolume *
// MUSIC_GAIN. The track itself is hot, so we scale the whole slider range down
// (e.g. the 0.2 default plays at ~0.12) — keeps the 0–100% UI but softer overall.
const MUSIC_GAIN = 0.55

let el = null
let cfg = { muted: false, musicEnabled: true, musicVolume: 0.2 }
let gestureHandler = null   // the armed first-gesture unlock listener, if any

let objUrl = null
function getEl() {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
  if (!el) {
    el = new Audio()
    el.loop = true
    el.preload = 'auto'
    el.volume = clamp(cfg.musicVolume * MUSIC_GAIN)
    // Load via a BLOB, not the app:// src directly. An <audio> element can't stream
    // from the custom app:// protocol (no Range-request support → it silently fails),
    // but fetch() works (same path the SFX use). So fetch the file → blob: URL the
    // media element CAN load. Falls back to the raw src if the fetch ever fails.
    fetch(SRC)
      .then(r => (r.ok ? r.blob() : Promise.reject(new Error('HTTP ' + r.status))))
      .then(b => { objUrl = URL.createObjectURL(b); el.src = objUrl; if (shouldPlay()) tryPlay() })
      .catch(() => { el.src = SRC })
    // Exposed (not dev-only) so a headless capture can confirm the element loaded.
    window.__musicEl = el
    window.__musicErr = null
    el.addEventListener('error', () => { window.__musicErr = el.error ? el.error.code : 'err' })
  }
  return el
}

function clamp(v) { return Math.max(0, Math.min(1, v)) }

// Should music be audibly playing right now?
function shouldPlay() {
  return cfg.musicEnabled && !cfg.muted && cfg.musicVolume > 0
}

function tryPlay() {
  const a = getEl(); if (!a) return
  const p = a.play()
  // play() returns a promise in modern browsers; a rejection = autoplay blocked.
  if (p && typeof p.then === 'function') p.catch(() => armGesture())
}

// Remove the armed first-gesture listeners (if any). Safe to call any time.
function disarmGesture() {
  if (!gestureHandler) return
  window.removeEventListener('pointerdown', gestureHandler)
  window.removeEventListener('keydown', gestureHandler)
  window.removeEventListener('touchstart', gestureHandler)
  gestureHandler = null
}

// Start playback on the first user gesture (one shot), if we still want music.
function armGesture() {
  if (gestureHandler || typeof window === 'undefined') return
  gestureHandler = () => {
    disarmGesture()
    if (shouldPlay()) tryPlay()
  }
  window.addEventListener('pointerdown', gestureHandler)
  window.addEventListener('keydown', gestureHandler)
  window.addEventListener('touchstart', gestureHandler)
}

// The single entry point the app calls (on mount and on every settings change).
// Applies volume + play/pause to match the desired state, arming the autoplay
// unlock if the browser refuses to start until a gesture.
export function setMusicConfig(next) {
  cfg = { ...cfg, ...next }
  const a = getEl(); if (!a) return
  a.volume = clamp(cfg.musicVolume * MUSIC_GAIN)
  if (shouldPlay()) {
    if (a.paused) tryPlay()
  } else {
    // No longer want music — pause and tear down any pending autoplay-unlock so
    // the listeners don't linger and a later re-enable can arm a fresh attempt.
    disarmGesture()
    if (!a.paused) a.pause()
  }
}
