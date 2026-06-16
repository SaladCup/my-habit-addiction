// Shared 3D Plinko board geometry + physics constants. Imported by BOTH the headless
// bake (scripts/bake-plinko.mjs) and the in-app R3F component (Plinko3D.jsx) so the
// measured landing distribution matches exactly what the player sees. The board is a
// classic Galton triangle; the ball drops with REAL rapier physics and the bucket it
// settles in is the payout — multipliers are tuned to the baked distribution for RTP.

export const ROWS    = 10        // peg rows
export const BUCKETS = 11        // bottom slots
export const GAP     = 0.62      // peg spacing (x and y)
export const PEG_R   = 0.085
export const BALL_R  = 0.15
export const REST    = 0.25      // restitution (low → clean L/R Galton splits, bell-shaped landing)
export const FRICTION = 0.3
export const GRAV_Y  = -16

export const TOP_PEG_Y = 0                          // first peg row; rows descend in y
export const BOTTOM_PEG_Y = TOP_PEG_Y - (ROWS - 1) * GAP
export const SPAWN_Y = TOP_PEG_Y + 1.7             // ball spawns above the top row
export const FLOOR_Y = BOTTOM_PEG_Y - 1.25         // where balls come to rest in buckets
export const HALF_W  = (BUCKETS / 2) * GAP         // half the play width at the bottom

// Peg positions (triangle): row r (0..ROWS-1) has (r+2) pegs, centered. Adjacent rows
// alternate centering by GAP/2, which is what splits the ball left/right each row.
export function pegPositions() {
  const pegs = []
  for (let r = 0; r < ROWS; r++) {
    const count = r + 2
    const y = TOP_PEG_Y - r * GAP
    const x0 = -((count - 1) / 2) * GAP
    for (let c = 0; c < count; c++) pegs.push([x0 + c * GAP, y])
  }
  return pegs
}

// Vertical divider walls between the BUCKETS bottom slots (x positions).
export function dividerXs() {
  const xs = []
  for (let i = 0; i <= BUCKETS; i++) xs.push(-HALF_W + (i / BUCKETS) * HALF_W * 2)
  return xs
}

// Map a settled ball's x to a bucket index 0..BUCKETS-1.
export function bucketForX(x) {
  const i = Math.floor(((x + HALF_W) / (HALF_W * 2)) * BUCKETS)
  return Math.max(0, Math.min(BUCKETS - 1, i))
}

// Payout multiplier per bucket — BAKED from 20k real-physics drops (scripts/bake-plinko.mjs)
// and tuned to ~95% RTP against that measured distribution. Center is common (0.5×), the
// shoulder pockets are the rare sweet spots (~2×). Re-run the bake if any geometry changes.
export const BUCKET_MULTS = [0.8, 2.1, 1.8, 1, 0.6, 0.5, 0.6, 1, 1.8, 1.9, 0.8]
export const BUCKET_RTP = 0.95
