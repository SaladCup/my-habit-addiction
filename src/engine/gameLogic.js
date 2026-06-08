/**
 * MY HABIT ADDICTION — Game Logic Engine
 * Pure functions only. No React, no Zustand, no side effects.
 * All randomness is seeded through these functions so probabilities
 * are consistent between the wheel and slot machine.
 */

import { weightedRandom, randomBetween, randomInt } from './probability.js'

// ── Probability table (shared by wheel AND slots) ──
// Weights mirror the 40-segment wheel layout (equal segments → odds = count).
// t1=15, t2=11, t3=7, bonus=6, jackpot=1  →  37.5 / 27.5 / 17.5 / 15 / 2.5 %
export const OUTCOME_WEIGHTS = [
  { value: 't1',      weight: 15 },
  { value: 't2',      weight: 11 },
  { value: 't3',      weight: 7  },
  { value: 'bonus',   weight: 6  },
  { value: 'jackpot', weight: 1  },
]

// Display-coin scale: wins show ×this many coins for a satisfying "big number"
// feel. Real-world value is preserved by dividing it back out in the
// time/money conversion rates (see settings). Bump this to rescale everything.
export const COIN_SCALE = 25
export const TIER_COINS = {
  t1: 5 * COIN_SCALE, t2: 10 * COIN_SCALE, t3: 15 * COIN_SCALE,
  jackpot: 30 * COIN_SCALE, bonus: 0,
}

// ── Engagement / luck engine ──
// A "good" outcome (the dopamine hits) = t3, bonus, or jackpot.
const GOOD_RESULTS = ['t3', 'bonus', 'jackpot']
export const isGoodResult = (r) => GOOD_RESULTS.includes(r)

// Hard pity: after this many dry spins, force a guaranteed big win.
export const PITY_LIMIT = 9

/**
 * Dynamically re-weight outcomes based on the player's recent history.
 * This is the core "win/lose progression" engine:
 *   • pity timer    — the longer since a good result, the more t3/bonus are boosted
 *   • session warmup — the first couple spins of a session skew lucky
 *   • jackpot "due"  — jackpot odds creep up the longer since the last jackpot
 * @param {{sessionSpins?:number, spinsSinceGood?:number, spinsSinceJackpot?:number}} luck
 */
export function getAdjustedWeights(luck = {}) {
  const { sessionSpins = 99, spinsSinceGood = 0, spinsSinceJackpot = 0 } = luck
  const w = {}
  OUTCOME_WEIGHTS.forEach(o => { w[o.value] = o.weight })

  // Pity timer — ramp top tiers with the dry streak (caps ~4.5x at 10 dry spins)
  const drought = Math.min(spinsSinceGood, 10)
  const boost = 1 + drought * 0.35
  w.t3 *= boost
  w.bonus *= boost

  // Session warm-up — first 2 spins of a session are generous (the hook)
  if (sessionSpins < 2) {
    w.t3 *= 2
    w.bonus *= 1.6
    w.t1 *= 0.6
  }

  // Jackpot "due" — odds creep up the longer it's been (gambler's-fallacy pull)
  w.jackpot *= 1 + Math.min(spinsSinceJackpot, 60) / 15

  return Object.entries(w).map(([value, weight]) => ({ value, weight }))
}

// Priority order for comparing results (higher index = better)
const RESULT_PRIORITY = ['nothing', 't1', 't2', 'bonus', 't3', 'jackpot']
const resultScore = (r) => RESULT_PRIORITY.indexOf(r)

// ─────────────────────────────────────────────
// TIER DETERMINATION
// ─────────────────────────────────────────────

/**
 * Given cashed beads, determine the highest tier the player has unlocked.
 * @param {Array<{slot: number|null, isGold: boolean}>} cashedBeads
 * @returns {{ activeTier: 1|2|3, isGoldShortcut: boolean }}
 */
export function determineTier(cashedBeads) {
  if (!cashedBeads || cashedBeads.length === 0) return { activeTier: 1, isGoldShortcut: false }

  const hasGold = cashedBeads.some(b => b.isGold)
  if (hasGold) return { activeTier: 3, isGoldShortcut: true }

  // Count by slot number (NOT color — color is just display)
  const slotCounts = {}
  cashedBeads.forEach(b => {
    if (b.slot != null) slotCounts[b.slot] = (slotCounts[b.slot] || 0) + 1
  })
  const max = Math.max(0, ...Object.values(slotCounts))

  if (max >= 3) return { activeTier: 3, isGoldShortcut: false }
  if (max >= 2) return { activeTier: 2, isGoldShortcut: false }
  return { activeTier: 1, isGoldShortcut: false }
}

/**
 * Returns which beads from the wallet can be cashed in, and at what tier.
 * @param {Array<{slot: number|null, isGold: boolean}>} wallet
 * @returns {{ canCash: boolean, bestOption: {beads, tier}|null, hasGold: boolean, options: Array }}
 */
export function isCashable(wallet) {
  if (!wallet || wallet.length === 0) return { canCash: false, bestOption: null, hasGold: false, options: [] }

  const goldBeads = wallet.filter(b => b.isGold)
  const hasGold = goldBeads.length > 0
  const options = []

  // Gold option
  if (hasGold) {
    options.push({ beads: [goldBeads[0]], tier: 3, label: '1 Gold Bead → Tier 3 ⚡' })
  }

  // Group non-gold by slot
  const bySlot = {}
  wallet.filter(b => !b.isGold).forEach(b => {
    if (!bySlot[b.slot]) bySlot[b.slot] = []
    bySlot[b.slot].push(b)
  })

  Object.entries(bySlot).forEach(([slot, beads]) => {
    if (beads.length >= 3) {
      options.push({ beads: beads.slice(0, 3), tier: 3, label: `3 matching → Tier 3` })
    }
    if (beads.length >= 2) {
      options.push({ beads: beads.slice(0, 2), tier: 2, label: `2 matching → Tier 2` })
    }
  })

  // Sort by tier descending
  options.sort((a, b) => b.tier - a.tier)

  // Always allow spinning — any single bead = Tier 1 fallback
  if (options.length === 0) {
    const anyBead = wallet[wallet.length - 1]
    options.push({ beads: [anyBead], tier: 1, label: '1 bead → Tier 1' })
  }

  return {
    canCash: true,
    bestOption: options[0] || null,
    hasGold,
    options,
  }
}

// ─────────────────────────────────────────────
// MAIN SPIN (shared probability engine)
// ─────────────────────────────────────────────

/**
 * Determine the raw outcome of a spin using shared probability table.
 * Applies near-miss logic: if raw outcome > activeTier, award activeTier instead.
 *
 * @param {1|2|3} activeTier
 * @returns {{
 *   rawResult: string,
 *   awardedResult: string,
 *   isNearMiss: boolean,
 *   coinsAwarded: number
 * }}
 */
export function resolveSpinOutcome(activeTier, luck = {}) {
  // Hard pity timer — force a guaranteed big win after a long drought
  let raw
  if ((luck.spinsSinceGood || 0) >= PITY_LIMIT) {
    raw = weightedRandom([
      { value: 't3', weight: 6 }, { value: 'bonus', weight: 3 }, { value: 'jackpot', weight: 1 },
    ])
  } else {
    raw = weightedRandom(getAdjustedWeights(luck))
  }

  // Jackpot and bonus always award regardless of tier
  if (raw === 'jackpot' || raw === 'bonus') {
    return {
      rawResult: raw,
      awardedResult: raw,
      isNearMiss: false,
      coinsAwarded: TIER_COINS[raw],
    }
  }

  // Convert tier string to number for comparison
  const tierNum = { t1: 1, t2: 2, t3: 3 }
  const rawTierNum = tierNum[raw] || 1
  let isNearMiss = rawTierNum > activeTier
  let awardedResult = isNearMiss ? `t${activeTier}` : raw

  // Near-miss injection — during a cold streak, dramatize a clean low win as a
  // "drift past the better prize" near miss (visual only; payout unchanged).
  if (!isNearMiss && (luck.lossStreak || 0) >= 2 &&
      (awardedResult === 't1' || awardedResult === 't2') && Math.random() < 0.5) {
    const higher = awardedResult === 't1' ? 't2' : 't3'
    return { rawResult: higher, awardedResult, isNearMiss: true, coinsAwarded: TIER_COINS[awardedResult] }
  }

  return {
    rawResult: raw,
    awardedResult,
    isNearMiss,
    coinsAwarded: TIER_COINS[awardedResult] || 0,
  }
}

// ─────────────────────────────────────────────
// WHEEL
// ─────────────────────────────────────────────

/**
 * Fixed 50-slot wheel ring (slot 0 = top / 12 o'clock, going clockwise).
 * Bonus (×8) and Jackpot (×1) sit at FIXED, intentionally-uneven positions
 * (matched to the reference art) and never move or resize. The 't1'/'t2'/'t3'
 * slots are prize slots that fill the gaps. Counts: 41 tier + 8 bonus + 1 jackpot.
 * Bonus clock positions ≈ 1, 3, 5, 6, 7:30, 9, 10, 11 o'clock; jackpot ≈ 2 o'clock.
 */
export const WHEEL_RING = [
  /* 0*/ 't2','t1','t3','t2',
  /* 4*/ 'bonus',            // ~1 o'clock
  /* 5*/ 't1','t3','t2',
  /* 8*/ 'jackpot',          // ~2 o'clock
  /* 9*/ 't1','t3','t2',
  /*12*/ 'bonus',            // ~3 o'clock (by the pointer)
  /*13*/ 't1','t3','t2','t1','t3','t2','t1','t3',
  /*21*/ 'bonus',            // ~5 o'clock
  /*22*/ 't2','t1','t3',
  /*25*/ 'bonus',            // ~6 o'clock (bottom)
  /*26*/ 't2','t1','t3','t2','t1',
  /*31*/ 'bonus',            // ~7:30
  /*32*/ 't3','t2','t1','t3','t2',
  /*37*/ 'bonus',            // ~9 o'clock
  /*38*/ 't1','t3','t2','t1',
  /*42*/ 'bonus',            // ~10 o'clock
  /*43*/ 't3','t2','t1',
  /*46*/ 'bonus',            // ~11 o'clock
  /*47*/ 't3','t2','t1',
]
export const WHEEL_SLOTS = WHEEL_RING.length   // 50
const TIER_VALUE = { t1: 1, t2: 2, t3: 3 }

/**
 * Remap the ring for a given unlocked tier: any prize slot above `activeTier`
 * is converted down to an unlocked tier (alternating to keep T1/T2 balanced),
 * so locked tiers visually fold into the ones you can actually win.
 */
function ringForTier(activeTier) {
  let toggle = 0
  return WHEEL_RING.map((type) => {
    if (type === 'bonus' || type === 'jackpot') return type
    const tv = TIER_VALUE[type]
    if (tv <= activeTier) return type
    if (activeTier === 1) return 't1'
    return (toggle++ % 2 === 0) ? 't2' : 't1'   // tier 2: split former-T3 between T1/T2
  })
}

/**
 * Build the wheel's wedges for the active tier. Adjacent prize slots of the
 * same value MERGE into one bigger wedge (bonus/jackpot never merge and act as
 * separators) — so a Tier-1 wheel shows a few big T1 wedges, a Tier-3 wheel
 * shows many small interleaved ones. Each wedge carries its coin value.
 * @param {number} activeTier 1..3
 */
export function buildWheelSegments(activeTier = 3) {
  const ring = ringForTier(Math.max(1, Math.min(activeTier, 3)))
  const n = ring.length
  const degPer = 360 / n

  // Group consecutive equal prize slots into wedges; bonus/jackpot stay single.
  const wedges = []
  let i = 0
  while (i < n) {
    const type = ring[i]
    let k = 1
    if (type !== 'bonus' && type !== 'jackpot') {
      while (i + k < n && ring[i + k] === type) k++
    }
    wedges.push({ type, slots: k, startSlot: i })
    i += k
  }
  // Wrap-around merge: if the first and last wedges are the same prize type and
  // touch across slot 0, fold the last into the first (so the top isn't split).
  if (wedges.length > 1) {
    const first = wedges[0], last = wedges[wedges.length - 1]
    const prize = first.type !== 'bonus' && first.type !== 'jackpot'
    if (prize && first.type === last.type) {
      first.slots += last.slots
      first.startSlot = last.startSlot - n   // start "before" 0 so angles stay monotonic
      wedges.pop()
    }
  }

  return wedges.map((w, idx) => {
    const startAngle = w.startSlot * degPer
    const endAngle = (w.startSlot + w.slots) * degPer
    const tier = TIER_VALUE[w.type] || null
    return {
      type: w.type,
      index: idx,
      tier,
      slots: w.slots,
      coins: tier ? TIER_COINS[w.type] : (w.type === 'jackpot' ? TIER_COINS.jackpot : 0),
      startAngle,
      endAngle,
      midAngle: (startAngle + endAngle) / 2,
    }
  })
}

/**
 * Given a resolved spin result, return the rotation angle (degrees) for the wheel to stop at.
 * For near-misses: the wheel visually drifts PAST a higher-tier segment before snapping back.
 *
 * @param {string} awardedResult  - what the player actually wins
 * @param {string} rawResult      - what was originally rolled (may be higher tier)
 * @param {boolean} isNearMiss
 * @param {Array} segments        - from buildWheelSegments()
 * @returns {{ stopAngle: number, nearMissAngle: number|null }}
 */
export function getWheelStopAngle(awardedResult, rawResult, isNearMiss, segments) {
  // Find all segments matching the awarded result
  const awardedSegs = segments.filter(s => s.type === awardedResult)
  const targetSeg = awardedSegs[randomInt(0, awardedSegs.length - 1)]

  // The segment sits at angle θ on the wheel. To bring it under the fixed pointer
  // at the top, the wheel must rotate by (360 − θ) degrees clockwise.
  const segAngle = targetSeg.startAngle + randomBetween(0.15, 0.55) * (targetSeg.endAngle - targetSeg.startAngle)
  const stopAngle = (360 - segAngle + 360) % 360

  let nearMissAngle = null
  if (isNearMiss) {
    const rawSegs = segments.filter(s => s.type === rawResult)
    if (rawSegs.length > 0) {
      const nearSeg = rawSegs.reduce((closest, seg) => {
        const d1 = Math.abs(seg.midAngle - segAngle)
        const d2 = Math.abs(closest.midAngle - segAngle)
        return d1 < d2 ? seg : closest
      }, rawSegs[0])
      const nearRaw = nearSeg.midAngle + randomBetween(-2, 2)
      nearMissAngle = (360 - nearRaw + 360) % 360
    }
  }

  const fullSpins = randomInt(8, 12) * 360   // more rotations for the longer, slower spin
  return {
    stopAngle: fullSpins + stopAngle,
    nearMissAngle: nearMissAngle !== null ? fullSpins + nearMissAngle : null,
  }
}

// ─────────────────────────────────────────────
// SLOT MACHINE
// ─────────────────────────────────────────────

/**
 * Slot symbols with tier mappings.
 * The slot machine uses the SAME probability engine — outcome is pre-determined,
 * then reel symbols are chosen to match/show that outcome.
 */
export const SLOT_SYMBOLS = [
  { id: 'sakura',   emoji: '🌸', tier: 't1',      weight: 30, coins: 25 },
  { id: 'heart',    emoji: '💗', tier: 't1',      weight: 25, coins: 30 },
  { id: 'star',     emoji: '⭐', tier: 't2',      weight: 20, coins: 40 },
  { id: 'butterfly',emoji: '🦋', tier: 't2',      weight: 15, coins: 50 },
  { id: 'ribbon',   emoji: '🎀', tier: 't3',      weight: 8,  coins: 70 },
  { id: 'moon',     emoji: '🌙', tier: 't3',      weight: 6,  coins: 90 },
  { id: 'bonus',    emoji: '🎰', tier: 'bonus',   weight: 4,  coins: 0  },
  { id: 'gold',     emoji: '✨', tier: 'jackpot', weight: 1,  coins: 0  },
]

// Human names for win-explanation copy.
const SYMBOL_NAME = {
  sakura: 'Sakura', heart: 'Heart', star: 'Star', butterfly: 'Butterfly',
  ribbon: 'Ribbon', moon: 'Moon', bonus: 'Bonus', gold: 'Gold Sparkle',
}
const LINE_LABEL = {
  row0: 'Top Row', row1: 'Middle Row', row2: 'Bottom Row',
  col0: 'Left Column', col1: 'Middle Column', col2: 'Right Column',
  diagTLBR: 'Diagonal ↘', diagBLTR: 'Diagonal ↗',
}

const SYMBOLS_BY_TIER = {
  t1:      SLOT_SYMBOLS.filter(s => s.tier === 't1'),
  t2:      SLOT_SYMBOLS.filter(s => s.tier === 't2'),
  t3:      SLOT_SYMBOLS.filter(s => s.tier === 't3'),
  bonus:   SLOT_SYMBOLS.filter(s => s.tier === 'bonus'),
  jackpot: SLOT_SYMBOLS.filter(s => s.tier === 'jackpot'),
}

function pickSymbolForTier(tier) {
  const candidates = SYMBOLS_BY_TIER[tier] || SYMBOLS_BY_TIER.t1
  return weightedRandom(candidates.map(s => ({ value: s, weight: s.weight })))
}

function randomNonMatchingSymbol(exclude) {
  const others = SLOT_SYMBOLS.filter(s => s.id !== exclude.id && s.tier !== exclude.tier)
  return others[randomInt(0, others.length - 1)]
}

/**
 * Resolve a single slot machine pull.
 * Uses the shared probability engine, then assigns reel symbols.
 *
 * @param {1|2|3} activeTier
 * @returns {{
 *   reelSymbols: [{emoji, id, tier}, {emoji, id, tier}, {emoji, id, tier}],
 *   awardedResult: string,
 *   rawResult: string,
 *   isNearMiss: boolean,
 *   coinsAwarded: number
 * }}
 */
export function resolveSlotPull(activeTier, luck = {}) {
  const outcome = resolveSpinOutcome(activeTier, luck)
  const { awardedResult, rawResult, isNearMiss } = outcome

  let reelSymbols

  if (awardedResult === 'jackpot') {
    const sym = SYMBOLS_BY_TIER.jackpot[0]
    reelSymbols = [sym, sym, sym]
  } else if (awardedResult === 'bonus') {
    const sym = SYMBOLS_BY_TIER.bonus[0]
    reelSymbols = [sym, sym, sym]
  } else if (isNearMiss) {
    // Show 2 of the higher (raw) tier, with 3rd reel being different
    const higherSym = pickSymbolForTier(rawResult)
    const wrongSym = randomNonMatchingSymbol(higherSym)
    // Shuffle so the miss isn't always on reel 3
    const missPos = randomInt(0, 2)
    reelSymbols = [higherSym, higherSym, higherSym]
    reelSymbols[missPos] = wrongSym
  } else {
    // Clean match on awarded tier
    const sym = pickSymbolForTier(awardedResult)
    reelSymbols = [sym, sym, sym]
  }

  return { ...outcome, reelSymbols }
}

/**
 * Get the best result across multiple slot pulls.
 * @param {Array<{awardedResult: string}>} pulls
 * @returns {string} best result
 */
export function getBestSlotResult(pulls) {
  return pulls.reduce((best, pull) => {
    return resultScore(pull.awardedResult) > resultScore(best)
      ? pull.awardedResult
      : best
  }, 'nothing')
}

// ─────────────────────────────────────────────
// VIDEO SLOTS (3×3 grid, 5 paylines)
// ─────────────────────────────────────────────

// Paylines as [row, col] cell triples: 3 rows + 2 true diagonals.
export const SLOT_PAYLINES = [
  { id: 'row0',     cells: [[0, 0], [0, 1], [0, 2]] },
  { id: 'row1',     cells: [[1, 0], [1, 1], [1, 2]] },
  { id: 'row2',     cells: [[2, 0], [2, 1], [2, 2]] },
  { id: 'col0',     cells: [[0, 0], [1, 0], [2, 0]] },
  { id: 'col1',     cells: [[0, 1], [1, 1], [2, 1]] },
  { id: 'col2',     cells: [[0, 2], [1, 2], [2, 2]] },
  { id: 'diagTLBR', cells: [[0, 0], [1, 1], [2, 2]] },
  { id: 'diagBLTR', cells: [[2, 0], [1, 1], [0, 2]] },
]

const FILLERS = SLOT_SYMBOLS.filter(s => ['t1', 't2', 't3'].includes(s.tier))

// Unlocked tier → number of slot spins you get to play. Each spin is small; the
// tier decides HOW MANY pulls, not how big each one is. Per-spin EV ≈ 42 coins,
// so totals average T1≈125 / T2≈250 / T3≈375 ($1.25 / $2.50 / $3.75).
export const SPINS_PER_TIER = { 1: 3, 2: 6, 3: 9 }

// ── Paytable-driven slot model ──
// Each symbol pays its fixed value; a payline pays its symbol's value; a spin's
// coins = SUM of matching lines. Monte-Carlo-tuned to reproduce the prior
// distribution (per-tier avg ≈ 122/251/381, bonus ~15%, jackpot ~1.2%) within ~1.5%.
const WIN_SYMBOL_WEIGHTS = [   // how likely each symbol is to be THE winning one
  { id: 'sakura', weight: 26 }, { id: 'heart', weight: 24 }, { id: 'star', weight: 19 },
  { id: 'butterfly', weight: 14 }, { id: 'ribbon', weight: 11 }, { id: 'moon', weight: 6 },
]
const LINE_COUNT_DIST = [       // winning lines per spin: 16% none, 64% one, 20% two
  { value: 0, weight: 16 }, { value: 1, weight: 64 }, { value: 2, weight: 20 },
]
const PAY_BY_ID = Object.fromEntries(SLOT_SYMBOLS.map(s => [s.id, s]))
const ROW_LINES = SLOT_PAYLINES.filter(l => l.id.startsWith('row'))
const COL_LINES = SLOT_PAYLINES.filter(l => l.id.startsWith('col'))
const pickWinSymbol = () =>
  weightedRandom(WIN_SYMBOL_WEIGHTS.map(x => ({ value: PAY_BY_ID[x.id], weight: x.weight })))

// Build the per-line explanation object (used by both wins and bonus/jackpot specials).
function makeWinningLine(line, sym, special) {
  const label = LINE_LABEL[line.id] || line.id
  const tail = special === 'jackpot' ? 'JACKPOT!' : special === 'bonus' ? 'BONUS!' : `+${sym.coins}`
  return {
    lineId: line.id, index: SLOT_PAYLINES.indexOf(line), cells: line.cells,
    symbol: sym, coins: special ? 0 : sym.coins, label, special: special || null,
    tagText: `${label} ${sym.emoji}${sym.emoji}${sym.emoji} ${tail}`,
  }
}
// One-line "why you won this" summary.
function buildSpinSummary(winningLines) {
  if (!winningLines.length) return 'So close — keep spinning! 💕'
  const sp = winningLines[0].special
  if (sp === 'jackpot') return '💎 THREE Gold Sparkles — JACKPOT! The whole pool is yours!'
  if (sp === 'bonus') return '🎰 Triple Bonus — spin the bonus wheel for a free bead!'
  if (winningLines.length === 1) {
    const w = winningLines[0]
    return `3 ${SYMBOL_NAME[w.symbol.id]}s on the ${w.label} — +${w.coins} coins!`
  }
  return `${winningLines.length} lines paid out — +${winningLines.reduce((s, w) => s + w.coins, 0)} coins! ✨`
}

function shuffled(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Would placing `sym` at (r,c) complete any payline into 3-of-a-kind?
function wouldCompleteLine(grid, r, c, sym) {
  return SLOT_PAYLINES.some(line => {
    if (!line.cells.some(([rr, cc]) => rr === r && cc === c)) return false
    return line.cells
      .filter(([rr, cc]) => !(rr === r && cc === c))
      .every(([rr, cc]) => grid[rr][cc] && grid[rr][cc].id === sym.id)
  })
}

function fillBlanks(grid) {
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid[r][c]) continue
      let sym = FILLERS[randomInt(0, FILLERS.length - 1)]
      for (let t = 0; t < 24 && wouldCompleteLine(grid, r, c, sym); t++) {
        sym = FILLERS[randomInt(0, FILLERS.length - 1)]
      }
      grid[r][c] = sym
    }
  }
}

function specialLine(symbol, kind) {
  const grid = [[null, null, null], [null, null, null], [null, null, null]]
  const line = SLOT_PAYLINES[randomInt(0, SLOT_PAYLINES.length - 1)]
  line.cells.forEach(([r, c]) => { grid[r][c] = symbol })
  fillBlanks(grid)
  const winningLines = [makeWinningLine(line, symbol, kind)]
  return { grid, winningLines, summary: buildSpinSummary(winningLines) }
}

/**
 * Resolve ONE small slot spin (no specials — those are rolled per session).
 * Honest paytable: 0/1/2 winning lines (weighted), each placed as real 3-of-a-kind
 * of a weighted symbol; coins = SUM of those lines' symbol values. The grid is then
 * filled with non-completing fillers, so what you SEE is exactly what paid.
 * @returns {{ grid, winningLines, coins, summary }}
 */
export function resolveSlotSpin() {
  const grid = [[null, null, null], [null, null, null], [null, null, null]]
  const nLines = weightedRandom(LINE_COUNT_DIST.map(x => ({ value: x.value, weight: x.weight })))

  let lines = []
  if (nLines === 1) lines = [SLOT_PAYLINES[randomInt(0, SLOT_PAYLINES.length - 1)]]  // any of 8: 3 rows, 3 cols, 2 diagonals
  else if (nLines === 2) {
    // two PARALLEL lines (2 rows or 2 columns) so they never cross / share a cell
    const group = Math.random() < 0.5 ? ROW_LINES : COL_LINES
    lines = shuffled(group).slice(0, 2)
  }

  const winningLines = lines.map(line => {
    const sym = pickWinSymbol()
    line.cells.forEach(([r, c]) => { grid[r][c] = sym })
    return makeWinningLine(line, sym)
  })
  fillBlanks(grid)
  const coins = winningLines.reduce((s, w) => s + w.coins, 0)
  return { grid, winningLines, coins, summary: buildSpinSummary(winningLines) }
}

/**
 * Resolve a full slots SESSION = a sequence of spins (count set by tier).
 * One bonus/jackpot is rolled for the whole session (so a bonus is exactly as
 * likely per cash-in as on the wheel), revealed on the final spin.
 * @returns {{ spinCount, spins:[{grid,winningLines,coins,isJackpot?,isBonus?}], baseCoins, isJackpot, isBonus, awardedResult }}
 */
export function resolveSlotSession(activeTier = 1, luck = {}) {
  const tier = Math.max(1, Math.min(activeTier, 3))
  const spinCount = SPINS_PER_TIER[tier]

  // Session special — same rates the wheel uses, rolled once.
  const aw = getAdjustedWeights(luck)
  const awTotal = aw.reduce((s, o) => s + o.weight, 0)
  const bonusChance = aw.find(o => o.value === 'bonus').weight / awTotal
  const jackpotChance = 0.012 * (1 + Math.min(luck.spinsSinceJackpot || 0, 60) / 15)
  const isJackpot = Math.random() < jackpotChance
  const isBonus = !isJackpot && Math.random() < bonusChance

  const spins = []
  for (let i = 0; i < spinCount; i++) spins.push(resolveSlotSpin())

  // The special reveals on the last spin.
  if (isJackpot) spins[spinCount - 1] = { ...specialLine(SYMBOLS_BY_TIER.jackpot[0], 'jackpot'), coins: 0, isJackpot: true }
  else if (isBonus) spins[spinCount - 1] = { ...specialLine(SYMBOLS_BY_TIER.bonus[0], 'bonus'), coins: 0, isBonus: true }

  const baseCoins = spins.reduce((s, sp) => s + sp.coins, 0)
  const awardedResult = isJackpot ? 'jackpot' : isBonus ? 'bonus' : (baseCoins > 0 ? 't1' : 'nothing')
  return { spinCount, spins, baseCoins, isJackpot, isBonus, awardedResult }
}

/**
 * Resolve a WHEEL spin. Bonus / jackpot stay on the luck engine (the dopamine
 * hits). A regular win now lands on a prize wedge BY AREA among the wedges that
 * exist at this tier, and pays that wedge's value — so higher tiers put bigger
 * amounts on the wheel and raise your average win, while Tier 1 (only T1 wedges)
 * still always pays the full T1 value.
 * @returns {{ awardedResult, rawResult, isNearMiss, coinsAwarded }}
 */
export function resolveWheelSpin(activeTier = 1, luck = {}) {
  const tier = Math.max(1, Math.min(activeTier, 3))
  const aw = getAdjustedWeights(luck)
  const total = aw.reduce((s, o) => s + o.weight, 0)
  let r = Math.random() * total
  let pick = 'tier'
  for (const o of aw) {
    r -= o.weight
    if (r <= 0) { pick = (o.value === 'jackpot' || o.value === 'bonus') ? o.value : 'tier'; break }
  }
  if (pick === 'jackpot') return { awardedResult: 'jackpot', rawResult: 'jackpot', isNearMiss: false, coinsAwarded: TIER_COINS.jackpot }
  // Bonus collects the highest unlocked tier's coins, THEN sends you to the bonus wheel.
  if (pick === 'bonus') return { awardedResult: 'bonus', rawResult: 'bonus', isNearMiss: false, coinsAwarded: TIER_COINS[`t${tier}`] }

  // Regular win — pick a prize wedge weighted by its size (area = probability).
  const prizeWedges = buildWheelSegments(tier).filter(s => s.tier)
  const slotTotal = prizeWedges.reduce((s, w) => s + w.slots, 0)
  let rr = Math.random() * slotTotal
  let chosen = prizeWedges[0]
  for (const w of prizeWedges) { rr -= w.slots; if (rr <= 0) { chosen = w; break } }
  const res = `t${chosen.tier}`
  return { awardedResult: res, rawResult: res, isNearMiss: false, coinsAwarded: TIER_COINS[res] }
}

// ─────────────────────────────────────────────
// BONUS WHEEL
// ─────────────────────────────────────────────

// 5 segments matching the reference proportions (unequal wedges).
// Two FREE bead slots replace the old FREE + Extra Spin, placed
// non-adjacent so the wheel reads like the reference.
//   75%≈33%  25%≈22%  50%≈19%  +  two FREE ≈13% each
export const BONUS_WHEEL_SEGMENTS = [
  { value: '75',   label: '75%',      weight: 33, color: '#FBC0D4' },
  { value: 'free', label: 'FREE 🎁', weight: 13, color: '#BCE8D2' },
  { value: '50',   label: '50%',      weight: 19, color: '#D3C0EC' },
  { value: '25',   label: '25%',      weight: 22, color: '#FBDFA8' },
  { value: 'free', label: 'FREE 🎁', weight: 13, color: '#C9ECDA' },
]

/**
 * Build the bonus wheel as proportional wedges (angles scale with weight).
 * @returns {Array<{value,label,color,weight,index,startAngle,endAngle,midAngle}>}
 */
export function buildBonusSegments() {
  const total = BONUS_WHEEL_SEGMENTS.reduce((s, x) => s + x.weight, 0)
  let acc = 0
  return BONUS_WHEEL_SEGMENTS.map((seg, i) => {
    const startAngle = (acc / total) * 360
    acc += seg.weight
    const endAngle = (acc / total) * 360
    return { ...seg, index: i, startAngle, endAngle, midAngle: (startAngle + endAngle) / 2 }
  })
}

// Land somewhere comfortably inside a wedge, then add full spins.
function bonusStopAngle(seg) {
  const span = seg.endAngle - seg.startAngle
  const segAngle = seg.startAngle + randomBetween(0.2, 0.8) * span
  const rotationToTop = (360 - segAngle + 360) % 360
  return randomInt(7, 10) * 360 + rotationToTop   // more rotations for the longer, slower bonus spin
}

/**
 * Compute a stop angle that lands on a wedge matching `result`.
 * Used when the result was pre-rolled (e.g. on the spin screen).
 */
export function getBonusStopAngle(result) {
  const segs = buildBonusSegments()
  const matching = segs.filter(s => s.value === result)
  const seg = matching[randomInt(0, matching.length - 1)] || segs[0]
  return bonusStopAngle(seg)
}

/**
 * Spin the bonus wheel.
 * @returns {{ result: string, stopAngle: number, label: string }}
 */
export function spinBonusWheel() {
  const segs = buildBonusSegments()
  const total = segs.reduce((s, x) => s + x.weight, 0)
  let r = Math.random() * total
  let chosen = segs[segs.length - 1]
  for (const seg of segs) {
    r -= seg.weight
    if (r <= 0) { chosen = seg; break }
  }
  return { result: chosen.value, label: chosen.label, stopAngle: bonusStopAngle(chosen) }
}

/**
 * Format the bonus challenge description.
 * @param {string} bonusResult  - '75'|'50'|'25'|'free'
 * @param {object} habit        - habit object with description
 * @returns {string}
 */
export function formatBonusChallenge(bonusResult, habit) {
  if (bonusResult === 'free')  return 'Free bead! No habit needed 🎁'
  const activity = habit?.rewards?.bonusActivity || habit?.description || 'your habit'
  const pct = parseInt(bonusResult)
  return `Do ${pct}% of: "${activity}" within 10 minutes`
}

/**
 * Get coins awarded for a given result + tier combo.
 */
export function getCoinsForResult(result, activeTier) {
  if (result === 'jackpot') return TIER_COINS.jackpot
  if (result === 'bonus')   return TIER_COINS[`t${activeTier}`] // auto-collect highest tier
  return TIER_COINS[result] || 0
}
