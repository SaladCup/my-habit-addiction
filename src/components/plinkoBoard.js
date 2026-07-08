// Shared 3D Plinko board geometry + physics constants. Imported by BOTH the headless
// bake (scripts/bake-plinko.mjs) and the in-app R3F component (Plinko3D.jsx) so the
// measured landing distribution matches exactly what the player sees. The board is a
// classic Galton triangle; the ball drops with REAL rapier physics and the bucket it
// settles in is the payout — multipliers are tuned to the baked distribution for RTP.

export const ROWS    = 9         // peg rows (9 → bottom row of 10 pegs lands on the bucket
                                 // WALLS, so marbles funnel through the gaps into the holes;
                                 // 10 rows put pegs dead-center over every hole = stuck marbles)
export const BUCKETS = 11        // bottom slots
export const GAP     = 0.62      // peg spacing (x and y)
export const PEG_R   = 0.085
export const BALL_R  = 0.15
export const REST    = 0.25      // restitution (low → clean L/R Galton splits, bell-shaped landing)
export const FRICTION = 0.3
export const GRAV_Y  = -16

// Bucket-divider walls (the posts between the bottom slots). These MUST be identical in the
// bake (scripts/bake-plinko.mjs) and the render (Plinko3D.jsx) — if they drift, the measured
// landing distribution (and therefore the baked RTP) no longer matches what the player sees.
export const DIVIDER_HALF_W       = 0.04   // half-width of each divider wall
export const DIVIDER_REST         = 0.2    // divider wall restitution
export const DIVIDER_CAP_R        = 0.05   // rounded ball-cap on the divider TOP — a marble can't
                                           // balance on a flat edge, it rolls off into a bucket
export const DIVIDER_CAP_REST     = 0.35
export const DIVIDER_CAP_FRICTION = 0.1

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

// Payout multiplier per bucket — tuned against the MEASURED landing distribution
// (scripts/bake-plinko.mjs, 20k real-physics drops: 11.0 3.4 4.9 8.7 14.2 16.3
// 13.6 8.8 4.6 3.8 10.9 %). Same ~97% RTP as the old table, but the SHAPE is
// friendly: 62% of drops pay ≥1× (was 34%) — near-center breaks even, shoulders
// pay 1.1–1.3×, sweet spots 2.2× — with ONE dead pocket dead-center (0.4×, ~16%
// of drops) carrying the house edge; edge losses are mild (0.7×). Re-run the
// bake + recompute Σ P·m here if the board geometry ever changes.
export const BUCKET_MULTS = [0.7, 2.2, 1.3, 1.1, 1, 0.4, 1, 1.1, 1.3, 2.2, 0.7]
export const BUCKET_RTP = 0.971
