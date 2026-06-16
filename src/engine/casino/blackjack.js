// Blackjack vs a dealer. Infinite-deck draws (each card random & independent — standard
// for casual play-money). Dealer stands on all 17 (incl. soft 17, player-friendly). A
// natural blackjack pays 3:2. With basic strategy this sits near ~99.5% RTP — it emerges
// from the rules, not a tunable payout knob.

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']  // idx 0..12
export const SUITS = ['♠', '♥', '♦', '♣']
export const BJ_PAYOUT = 2.5   // natural blackjack → 3:2 (stake ×2.5 back)

export function drawCard() {
  return { rank: Math.floor(Math.random() * 13), suit: Math.floor(Math.random() * 4) }
}

// Card point value (Ace = 11 here; reduced to 1 in handValue when needed).
export function cardValue(rank) {
  if (rank === 0) return 11        // Ace
  if (rank >= 9) return 10         // 10, J, Q, K
  return rank + 1                  // 2..9
}

// Total for a hand, soft-reducing aces from 11→1 to avoid busting.
export function handValue(cards) {
  let total = 0, aces = 0
  for (const c of cards) { total += cardValue(c.rank); if (c.rank === 0) aces++ }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return { total, soft: aces > 0 && total <= 21 }
}

export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21
}

// Dealer draws until reaching 17+ (stands on all 17).
export function dealerPlay(cards) {
  const hand = [...cards]
  while (handValue(hand).total < 17) hand.push(drawCard())
  return hand
}

// Settle a finished hand → stake multiplier returned to the player.
//   2.5 = blackjack win, 2 = normal win, 1 = push, 0 = loss.
export function settleHand(player, dealer, playerHadBJ) {
  const p = handValue(player).total
  const d = handValue(dealer).total
  const dealerBJ = isBlackjack(dealer)
  if (playerHadBJ) return dealerBJ ? 1 : BJ_PAYOUT
  if (dealerBJ) return 0
  if (p > 21) return 0
  if (d > 21) return 2
  if (p > d) return 2
  if (p === d) return 1
  return 0
}
