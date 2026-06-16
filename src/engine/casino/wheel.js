// Bet-mode Fortune Wheel — spin lands on one segment (uniform), you win bet × that
// segment's multiplier. RTP = the mean of the segments (no per-segment weighting), so
// it's trivially exact and easy to retune. 0× segments = a total loss for that spin.

// 12 segments, interleaved so wins are spread around the wheel. Mean ≈ 0.958.
export const WHEEL_SEGMENTS = [0, 0.5, 0, 1.5, 0, 2, 0, 0.5, 5, 0, 1.5, 0.5]
export const WHEEL_RTP = WHEEL_SEGMENTS.reduce((a, b) => a + b, 0) / WHEEL_SEGMENTS.length

export function spinWheel() {
  const index = Math.floor(Math.random() * WHEEL_SEGMENTS.length)
  return { index, mult: WHEEL_SEGMENTS[index] }
}
