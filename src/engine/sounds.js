// Web Audio API synthesized sounds — no external files needed.
// Reads muted/volume directly from localStorage to avoid React coupling.

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
  try { fn(c) } catch { /* audio is decoration — never let it crash gameplay */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function playBeadDraw(isGold = false) {
  play(c => {
    const t = c.currentTime
    if (isGold) {
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

export function playWin(result) {
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
  play(c => {
    const t = c.currentTime
    note(c, 180, t,       0.07, 'square', 0.16)
    note(c, 120, t+0.04,  0.09, 'square', 0.11)
  })
}

export function playBonus() {
  play(c => {
    const t = c.currentTime
    ;[[784,0],[880,.06],[1047,.13],[880,.2],[1047,.28],[1319,.38]].forEach(
      ([freq, delay]) => note(c, freq, t + delay, 0.16, 'sine', 0.22)
    )
  })
}

export function playWheelTick() {
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

// A quick coin "tick" used while tallying up the total.
export function playCoinTick(step = 0) {
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
