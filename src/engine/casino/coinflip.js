// Coin Flip — a 50/50 bet. Win pays COINFLIP_PAYOUT× the stake.
//   RTP = winProb × payout = 0.5 × 1.90 = 0.95  (5% house edge)
// "Let It Ride" (double-or-nothing) lives in the screen: the won pot is re-risked on
// each flip until the player banks or busts. The engine just flips one fair coin.

export const COINFLIP_RTP    = 0.95
export const COINFLIP_PAYOUT = Math.round((COINFLIP_RTP / 0.5) * 100) / 100   // 1.90×

// One flip. `pick` is 'heads' | 'tails'. Returns the landed side + whether it won.
export function flipCoin(pick) {
  const result = Math.random() < 0.5 ? 'heads' : 'tails'
  return { result, win: result === pick, payout: COINFLIP_PAYOUT }
}
