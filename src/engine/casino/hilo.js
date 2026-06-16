// Hi-Lo — a card shows; bet the next is Higher-or-same or Lower-or-same. A tie wins
// whichever side you picked. Correct = the pot compounds by that side's multiplier and a
// new card deals; bank any time; wrong = lose. With current value v (1..13):
//   P(higher-or-same) = (14−v)/13,  P(lower-or-same) = v/13
//   multiplier = RTP / P  → EV of either pick = RTP (so RTP is exact).

export const HILO_RTP = 0.97
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']  // idx 0..12 = value 1..13
export const SUITS = ['♠', '♥', '♦', '♣']

export function drawCard() {
  return { rank: Math.floor(Math.random() * 13), suit: Math.floor(Math.random() * 4) }
}

// Multipliers for the two bets given the current rank index (0..12).
export function hiloMults(idx) {
  const v = idx + 1
  const pHi = (14 - v) / 13
  const pLo = v / 13
  return {
    higher: Math.round((HILO_RTP / pHi) * 100) / 100,
    lower:  Math.round((HILO_RTP / pLo) * 100) / 100,
  }
}

// Did the guess win? Ties (draw === current) win EITHER side.
export function hiloWin(guess, curIdx, drawIdx) {
  return guess === 'higher' ? drawIdx >= curIdx : drawIdx <= curIdx
}
