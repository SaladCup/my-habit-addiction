// Limbo — pick a target multiplier; a random result multiplier is rolled, and you win
// (bet × target) if result ≥ target, else lose. Same distribution as Crash:
//   P(result ≥ m) = RTP / m   →   EV at any target = (RTP/t)·t = RTP.
// Single-roll and instant (no climbing), so it plays very fast.

export const LIMBO_RTP = 0.97
export const LIMBO_MAX = 1000

// Roll the result multiplier for a round.
export function rollLimbo() {
  const u = Math.random()
  return Math.min(LIMBO_MAX, Math.max(1, Math.floor((LIMBO_RTP / (1 - u)) * 100) / 100))
}

// Win chance for a chosen target (P that the roll clears it).
export function limboWinChance(target) {
  if (!(target > 1)) return 0
  return Math.max(0, Math.min(1, LIMBO_RTP / target))
}
