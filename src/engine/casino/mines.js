// Mines — a 5×5 grid with M hidden mines. Reveal gems to raise the multiplier; hit a
// mine and lose it all; cash out any time. Multiplier after k safe reveals:
//   m_k = R · C(25,k) / C(25-M, k) = R · Π_{i=0..k-1} (25-i)/(25-M-i)
// EV of revealing k then cashing = P(k safe) · m_k = R → RTP is exactly R.

export const MINES_RTP   = 0.97
export const MINES_TILES = 25

export const MINES_PRESETS = [
  { mines: 3,  label: 'Chill' },
  { mines: 5,  label: 'Classic' },
  { mines: 10, label: 'Spicy' },
]

// Multiplier after `k` safe reveals (k ≥ 1) with `m` mines.
export function minesMultiplier(m, k) {
  let mult = MINES_RTP
  for (let i = 0; i < k; i++) mult *= (MINES_TILES - i) / (MINES_TILES - m - i)
  return Math.round(mult * 100) / 100
}

// Randomly place `m` mines → a Set of tile indices (0..24). Partial Fisher–Yates.
export function placeMines(m) {
  const idx = [...Array(MINES_TILES).keys()]
  for (let i = 0; i < m; i++) {
    const j = i + Math.floor(Math.random() * (MINES_TILES - i))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return new Set(idx.slice(0, m))
}
