// Sound layer. Real audio files (engine/audio.js, public/sounds/) play when a
// file is mapped for an event; the synthesized tones below are the fallback
// (used only in the brief window before a file decodes, or for events with no
// chosen file yet). Reads muted/volume directly from localStorage.
import { playSfx, playThrottled, startLoop, stopLoop, preloadAll } from './audio'

let ctx = null

function getCtx() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)() }
    catch { return null }
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function getSettings() {
  try {
    const raw = localStorage.getItem('my-habit-addiction')
    if (raw) {
      const s = JSON.parse(raw)?.state?.settings
      return { muted: s?.muted ?? false, volume: s?.volume ?? 0.6 }
    }
  } catch { /* unreadable storage — fall through to defaults */ }
  return { muted: false, volume: 0.6 }
}

function note(c, freq, startTime, duration, type = 'sine', peakGain = 0.28) {
  const { volume } = getSettings()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(peakGain * volume, startTime + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.05)
}

function play(fn) {
  const { muted } = getSettings()
  if (muted) return
  const c = getCtx()
  if (!c) return
  preloadAll()   // first sound (a user gesture) warms the real audio files too
  try { fn(c) } catch { /* audio is decoration — never let it crash gameplay */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

// Earning a bead. `kind` is 'gold' | 'rainbow' | falsy (normal) → a different
// real sparkle each; synth sparkle is the pre-decode fallback.
const BEAD_FILE = { gold: 'beadGold', rainbow: 'beadRainbow' }
export function playBeadDraw(kind = null) {
  if (playSfx(BEAD_FILE[kind] || 'beadDraw', 0.9)) return
  play(c => {
    const t = c.currentTime
    if (kind === 'gold' || kind === 'rainbow') {
      note(c, 1047, t,       0.12, 'sine', 0.24)
      note(c, 1319, t+0.07,  0.12, 'sine', 0.20)
      note(c, 1568, t+0.14,  0.18, 'sine', 0.18)
      note(c, 2093, t+0.22,  0.28, 'sine', 0.14)
    } else {
      note(c, 880,  t,       0.10, 'sine', 0.22)
      note(c, 1047, t+0.09,  0.16, 'sine', 0.17)
    }
  })
}

export function playButtonTap() {
  play(c => note(c, 660, c.currentTime, 0.07, 'sine', 0.13))
}

export function playSpinStart() {
  play(c => {
    const t = c.currentTime
    const { volume } = getSettings()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain); gain.connect(c.destination)
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(110, t)
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.4)
    gain.gain.setValueAtTime(0.11 * volume, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
    osc.start(t); osc.stop(t + 0.45)
  })
}

const WIN_FILE = { t1: 'winSmall', t2: 'winMedium', t3: 'winLarge', jackpot: 'jackpot', bonus: 'bonus' }
export function playWin(result) {
  if (playSfx(WIN_FILE[result] || 'winSmall')) return
  play(c => {
    const t = c.currentTime
    const seqs = {
      jackpot: [[523,0],[659,.1],[784,.2],[1047,.32],[1319,.44],[1568,.56]],
      t3:      [[659,0],[784,.1],[1047,.22],[1319,.38]],
      t2:      [[784,0],[1047,.13],[1319,.3]],
      t1:      [[660,0],[880,.13]],
      bonus:   [[784,0],[880,.07],[1047,.14],[880,.22],[1047,.32]],
    }
    const seq = seqs[result] || seqs.t1
    seq.forEach(([freq, delay]) => note(c, freq, t + delay, 0.20, 'sine', 0.24))
  })
}

export function playNearMiss() {
  play(c => {
    const t = c.currentTime
    const { volume } = getSettings()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain); gain.connect(c.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, t)
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.38)
    gain.gain.setValueAtTime(0.16 * volume, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
    osc.start(t); osc.stop(t + 0.42)
  })
}

export function playReelStop() {
  if (playSfx('reelStop', 0.8)) return
  play(c => {
    const t = c.currentTime
    note(c, 180, t,       0.07, 'square', 0.16)
    note(c, 120, t+0.04,  0.09, 'square', 0.11)
  })
}

export function playBonus() {
  if (playSfx('bonus')) return
  play(c => {
    const t = c.currentTime
    ;[[784,0],[880,.06],[1047,.13],[880,.2],[1047,.28],[1319,.38]].forEach(
      ([freq, delay]) => note(c, freq, t + delay, 0.16, 'sine', 0.22)
    )
  })
}

export function playWheelTick() {
  // one click; the wheel calls this per segment crossing, so the ticks slow down
  // on their own as it decelerates
  if (playSfx('wheelTick', 0.9)) return
  play(c => {
    const t = c.currentTime
    note(c, 1100, t,        0.018, 'square', 0.07)
    note(c, 550,  t + 0.007, 0.014, 'square', 0.04)
  })
}

export function playReelTick() {
  play(c => {
    const t = c.currentTime
    note(c, 210, t, 0.045, 'square', 0.10)
  })
}

// A bright sparkle when a winning payline lights up. `step` rises per line.
export function playLineWin(step = 0) {
  play(c => {
    const t = c.currentTime
    const base = 660 + step * 90
    note(c, base, t, 0.12, 'triangle', 0.18)
    note(c, base * 1.5, t + 0.04, 0.12, 'sine', 0.12)
  })
}

// A quick coin "tick" used while tallying up the slot total.
export function playCoinTick(step = 0) {
  if (playSfx('coin', 0.7)) return
  play(c => {
    const t = c.currentTime
    note(c, 880 + step * 30, t, 0.05, 'square', 0.08)
  })
}

// Triumphant flourish for the final slot total.
export function playSlotWin() {
  play(c => {
    const t = c.currentTime
    ;[523, 659, 784, 1047].forEach((f, i) => note(c, f, t + i * 0.08, 0.22, 'triangle', 0.2))
  })
}

// ── File-backed event sounds (real audio — see engine/audio.js) ──
export function playReward()      { playSfx('rewardOpen') }       // reward screen opens
export function playStreak()      { playSfx('streak') }           // daily login streak
export function playCreateHabit() { playSfx('createHabit') }      // a new habit is created
export function startCoinLoop()   { startLoop('coinsLoop', 0.85) } // "lots of coins" bed under the cascade
export function stopCoinLoop()    { stopLoop('coinsLoop') }
export function playCoinDrop()    { playThrottled('coin', 55, 0.55) } // per coin in the cascade (throttled)

// Sad descending "womp womp" when a streak breaks (synth — drop a file at the
// 'streakBreak' MANIFEST key in audio.js to replace it).
export function playStreakBreak() {
  if (playSfx('streakBreak')) return
  play(c => {
    const t = c.currentTime
    const { volume } = getSettings()
    ;[392, 349, 311, 247].forEach((f, i) => {     // G F Eb B — sad descending
      const osc = c.createOscillator(), g = c.createGain()
      osc.type = 'sawtooth'; osc.connect(g); g.connect(c.destination)
      const st = t + i * 0.21
      osc.frequency.setValueAtTime(f, st)
      osc.frequency.linearRampToValueAtTime(f * 0.92, st + 0.19)   // droopy slide down
      g.gain.setValueAtTime(0.0001, st)
      g.gain.linearRampToValueAtTime(0.16 * volume, st + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.2)
      osc.start(st); osc.stop(st + 0.23)
    })
  })
}
