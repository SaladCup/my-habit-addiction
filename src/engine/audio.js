// File-based SFX player (Web Audio). Decodes the mp3s in public/sounds and plays
// them as one-shots or loops, respecting the app's mute/volume settings. The
// synthesized fallbacks live in sounds.js — this only handles real audio files.
//
// To re-map a sound, just point a key at a different file in MANIFEST below.
// Drop a new mp3 in public/sounds/ and reference it here — that's the only edit.
const MANIFEST = {
  wheelTick:       'wheel-tick.mp3',    // ONE click; the wheel triggers it per segment → cadence + slowdown emerge
  coin:            'coin.mp3',          // single clink, per coin
  coinsLoop:       'coins-loop.mp3',    // "lots of coins" — looped under the reward cascade
  coinsDispensing: 'coins-dispensing.mp3',
  winSmall:        'win-small.mp3',         // Tier 1 — quick chime (1.6s), common wins
  winMedium:       'win-medium-chimes.wav', // Tier 2 — winning chimes (2.6s)
  winLarge:        'win-large-casino.wav',  // Tier 3 — casino reward (4.4s), big wins
  jackpot:         'jackpot.mp3',           // Tier 4 — crowd cheering (5.5s), rare jackpots only
  bonus:           'bonus.mp3',
  streak:          'streak.mp3',
  streakBreak:     'streak-break.mp3',  // descending arcade "game over" — a broken streak
  createHabit:     'create-habit.mp3',
  rewardOpen:      'reward-open.mp3',
  beadDraw:        'bead-draw.mp3',     // kawaii fairy sparkle — earning a normal bead (the core reward)
  beadGold:        'bead-gold.mp3',     // gold-coin prize jingle — gold bead
  beadRainbow:     'bead-rainbow.mp3',  // magic-wand sparkle — the rainbow wild-card bead
  reelStop:        'reel-stop.mp3',     // crisp mechanical click — a slot reel landing
  buttonTap:       'button-tap.wav',    // kawaii fairy-sparkle "ting" — every button press
  uiHover:         'ui-hover.wav',      // soft magic blip — hovering a nav icon
  uiSwoosh:        'ui-pop.mp3',        // soft "pop" — clicking a nav icon (the pop Lauren liked)
}

let ctx = null
let preloaded = false
const buffers = new Map()   // key -> AudioBuffer
const loading = new Map()   // key -> Promise<AudioBuffer|null>
const loops = new Map()     // key -> { src, g }
const lastAt = new Map()    // key -> ms (throttle)

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { return null }
  }
  if (ctx.state === 'suspended') ctx.resume()
  if (!preloaded) { preloaded = true; preloadAll() }
  return ctx
}

function getSettings() {
  try {
    const raw = localStorage.getItem('my-habit-addiction')
    if (raw) { const s = JSON.parse(raw)?.state?.settings; return { muted: s?.muted ?? false, volume: s?.volume ?? 0.6 } }
  } catch { /* unreadable storage */ }
  return { muted: false, volume: 0.6 }
}

function load(key) {
  if (buffers.has(key)) return Promise.resolve(buffers.get(key))
  if (loading.has(key)) return loading.get(key)
  const file = MANIFEST[key]
  const c = getCtx()
  if (!file || !c) return Promise.resolve(null)
  const p = fetch(`/sounds/${file}`)
    .then(r => r.arrayBuffer())
    .then(a => c.decodeAudioData(a))
    .then(buf => { buffers.set(key, buf); loading.delete(key); return buf })
    .catch(() => { loading.delete(key); return null })
  loading.set(key, p)
  return p
}

export function preloadAll() { Object.keys(MANIFEST).forEach(k => load(k)) }

export function hasSound(key) { return !!MANIFEST[key] }

// One-shot. Returns true if a real file fired (so sounds.js knows not to also
// play its synth fallback). A not-yet-decoded buffer returns false this once.
export function playSfx(key, gainMul = 1) {
  const { muted, volume } = getSettings()
  if (muted || !MANIFEST[key]) return false
  const c = getCtx(); if (!c) return false
  const buf = buffers.get(key)
  if (!buf) { load(key); return false }
  try {
    const src = c.createBufferSource(); src.buffer = buf
    const g = c.createGain(); g.gain.value = volume * gainMul
    src.connect(g); g.connect(c.destination)
    src.start()
  } catch { return false }
  return true
}

// Rapid repeats (per-coin) — swallow calls closer than minGapMs apart.
export function playThrottled(key, minGapMs = 70, gainMul = 1) {
  const c = getCtx(); if (!c) return
  const now = c.currentTime * 1000
  if (now - (lastAt.get(key) ?? -1e9) < minGapMs) return
  lastAt.set(key, now)
  playSfx(key, gainMul)
}

export function startLoop(key, gainMul = 1, fadeIn = 0.15) {
  if (getSettings().muted || !MANIFEST[key] || loops.has(key)) return
  const c = getCtx(); if (!c) return
  const begin = (buf) => {
    if (!buf || loops.has(key) || getSettings().muted) return
    try {
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true
      const g = c.createGain()
      const target = getSettings().volume * gainMul
      g.gain.setValueAtTime(0.0001, c.currentTime)
      g.gain.linearRampToValueAtTime(target, c.currentTime + fadeIn)
      src.connect(g); g.connect(c.destination)
      src.start()
      loops.set(key, { src, g })
    } catch { /* */ }
  }
  const buf = buffers.get(key)
  if (buf) begin(buf); else load(key).then(begin)
}

export function stopLoop(key, fadeOut = 0.3) {
  const c = getCtx()
  const L = loops.get(key)
  loops.delete(key)
  if (!L || !c) return
  try {
    L.g.gain.cancelScheduledValues(c.currentTime)
    L.g.gain.setValueAtTime(L.g.gain.value, c.currentTime)
    L.g.gain.linearRampToValueAtTime(0.0001, c.currentTime + fadeOut)
    L.src.stop(c.currentTime + fadeOut + 0.03)
  } catch { /* */ }
}
