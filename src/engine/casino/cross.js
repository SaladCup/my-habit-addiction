// Penguin Cross — the "Chicken Road" crossing genre. The penguin crosses lanes one at
// a time; each lane survived raises the multiplier; cash out any time; get hit = lose it.
// Cumulative-survival math: with per-lane survival s, the multiplier after k lanes is
//   m_k = R / s^k    (EV at any cash-out = s^k · m_k = R → RTP is exactly R)
// RTP 0.97 here so even Easy's first lane pays > 1× (needs R > s).

export const CROSS_RTP = 0.97

export const CROSS_MODES = {
  easy:   { key: 'easy',   label: 'Easy',   hazard: 0.08, lanes: 12, emoji: '🚲' },
  medium: { key: 'medium', label: 'Medium', hazard: 0.18, lanes: 10, emoji: '🚗' },
  hard:   { key: 'hard',   label: 'Hard',   hazard: 0.28, lanes: 8,  emoji: '🚚' },
}

// Multiplier for cashing out after crossing `k` lanes (k = 1..lanes) in a mode.
export function crossMultiplier(mode, k) {
  const s = 1 - CROSS_MODES[mode].hazard
  return Math.round((CROSS_RTP / Math.pow(s, k)) * 100) / 100
}

// Does the penguin survive the next lane?
export function crossSurvive(mode) {
  return Math.random() < (1 - CROSS_MODES[mode].hazard)
}
