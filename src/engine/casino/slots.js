// Bet-mode Slots — 3 reels, one payline. Three-of-a-kind pays the symbol's value × bet;
// anything else loses. Rarer symbol = bigger pay. High-variance (≈8.7% hit rate); tuned
// to ≈93% RTP (verified by sim). Each reel is an independent weighted pick.

export const SLOT_SYMBOLS = [
  { e: '🍒', weight: 40, pay: 4 },
  { e: '🍋', weight: 25, pay: 14 },
  { e: '🔔', weight: 18, pay: 40 },
  { e: '⭐', weight: 10, pay: 130 },
  { e: '💎', weight: 5,  pay: 600 },
  { e: '7️⃣', weight: 2,  pay: 2000 },
]

const TOTAL_W = SLOT_SYMBOLS.reduce((a, s) => a + s.weight, 0)

export function pickSymbol() {
  let r = Math.random() * TOTAL_W
  for (let i = 0; i < SLOT_SYMBOLS.length; i++) { r -= SLOT_SYMBOLS[i].weight; if (r < 0) return i }
  return SLOT_SYMBOLS.length - 1
}

export function spinSlots() {
  const reels = [pickSymbol(), pickSymbol(), pickSymbol()]
  const win3 = reels[0] === reels[1] && reels[1] === reels[2]
  return { reels, mult: win3 ? SLOT_SYMBOLS[reels[0]].pay : 0, win3 }
}
