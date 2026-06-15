// Crash — the multiplier climbs from 1.00× until it "busts". Cash out before the bust
// to win bet × (cash-out multiplier). Provably-fair-standard distribution:
//   P(bust ≥ m) = RTP / m   →   bust = max(1, RTP / (1 − u)),  u ~ Uniform[0,1)
// EV at ANY cash-out target = (RTP/t)·t = RTP. The house edge surfaces as instant
// 1.00× busts, which happen with probability (1 − RTP).

export const CRASH_RTP    = 0.95
export const CRASH_GROWTH = 0.18   // multiplier accel: ~2× at 3.9s, ~5× at 8.9s, ~10× at 12.8s

// Pre-roll the hidden bust point for a round (2-dp, floored at 1.00×).
export function rollCrashPoint(rtp = CRASH_RTP) {
  const u = Math.random()
  return Math.max(1, Math.floor((rtp / (1 - u)) * 100) / 100)
}

// Displayed multiplier `t` seconds into the round (accelerating curve).
export function crashMultiplierAt(t) {
  return Math.max(1, Math.floor(Math.exp(CRASH_GROWTH * t) * 100) / 100)
}

// Inverse of the curve: seconds at which the climb reaches `mult` (for timing the bust).
export function crashTimeFor(mult) {
  return Math.log(mult) / CRASH_GROWTH
}
