// Plinko — drop a ball through 12 rows of pegs; it lands in one of 13 buckets with
// binomial probability P(bucket k) = C(12,k)/2^12. Multipliers are the verified Stake
// tables (center-out, mirrored), ≈99% RTP. Risk reshapes the payouts: High = huge edges,
// near-zero center; Low = gentle.

export const PLINKO_ROWS    = 12
export const PLINKO_BUCKETS = PLINKO_ROWS + 1   // 13

export const PLINKO_TABLES = {
  low:    [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
  medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
  high:   [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
}

export const PLINKO_RISKS = [
  { key: 'low',    label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high',   label: 'High' },
]

// Drop a ball: each peg row is a fair L/R bounce. Returns the bounce path (0=L,1=R)
// and the landing bucket (= number of rights).
export function dropBall() {
  const path = []
  let bucket = 0
  for (let i = 0; i < PLINKO_ROWS; i++) { const r = Math.random() < 0.5 ? 0 : 1; path.push(r); bucket += r }
  return { path, bucket }
}

export function plinkoMultiplier(risk, bucket) {
  return PLINKO_TABLES[risk][bucket]
}
