/**
 * MY HABIT ADDICTION — Game Logic Engine
 * Pure functions only. No React, no Zustand, no side effects.
 * All randomness is seeded through these functions so probabilities
 * are consistent between the wheel and slot machine.
 */

import { randomBetween, randomInt } from './probability.js'
import { SLOT_SYMBOLS, resolveSlotSpin, buildSpecialGrid } from './slotEngine'

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

  // Rainbow beads are WILD: each one extends the largest matching group by 1
  // (rainbows alone also match each other — 3 rainbows = 3 matching).
  const rainbows = cashedBeads.filter(b => b.isRainbow).length

  // Count non-wild beads by slot number (NOT color — color is just display)
  const slotCounts = {}
  cashedBeads.forEach(b => {
    if (b.slot != null && !b.isRainbow) slotCounts[b.slot] = (slotCounts[b.slot] || 0) + 1
  })
  const max = Math.max(0, ...Object.values(slotCounts)) + rainbows

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

  // Rainbow beads are WILD — they can complete any slot's group
  const rainbows = wallet.filter(b => !b.isGold && b.isRainbow)

  // Group non-gold, non-wild by slot
  const bySlot = {}
  wallet.filter(b => !b.isGold && !b.isRainbow).forEach(b => {
    if (!bySlot[b.slot]) bySlot[b.slot] = []
    bySlot[b.slot].push(b)
  })

  // group = real matching beads; pad with rainbows only as needed
  const groupOption = (beads, tier, need) => {
    const real = beads.slice(0, Math.min(need, beads.length))
    const wilds = rainbows.slice(0, need - real.length)
    if (real.length + wilds.length < need) return null
    const label = wilds.length === 0
      ? `${need} matching → Tier ${tier}`
      : real.length === 0
        ? `${wilds.length}× 🌈 → Tier ${tier}`
        : `${real.length} + ${wilds.length}× 🌈 → Tier ${tier}`
    return { beads: [...real, ...wilds], tier, label, wildsUsed: wilds.length }
  }

  Object.values(bySlot).forEach(beads => {
    const t3 = groupOption(beads, 3, 3)
    if (t3) options.push(t3)
    const t2 = groupOption(beads, 2, 2)
    if (t2) options.push(t2)
  })
  // rainbows also match each other (a pure-wild group)
  const r3 = groupOption([], 3, 3)
  if (r3) options.push(r3)
  const r2 = groupOption([], 2, 2)
  if (r2) options.push(r2)

  // Sort: highest tier first; among equals, spend the fewest wild cards
  options.sort((a, b) => (b.tier - a.tier) || ((a.wildsUsed || 0) - (b.wildsUsed || 0)))

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

/**
 * The cash-in group for a freshly EARNED bead: the bead itself + its same-slot
 * matches + rainbow wilds, padded to the best tier (max 3). So earning a pink
 * bead always cashes in YOUR pink beads — not some other higher-tier group you
 * happen to hold (which is what `isCashable().bestOption` returns globally).
 * @returns {{ beads: Array, tier: 1|2|3 }}
 */
export function cashInGroupForBead(bead, wallet) {
  if (!bead) return { beads: [], tier: 1 }
  if (bead.isGold) {
    const gold = wallet.find(b => b.isGold) || bead
    return { beads: [gold], tier: 3 }
  }
  const wilds = wallet.filter(b => !b.isGold && b.isRainbow && b.id !== bead.id)
  let real
  if (bead.isRainbow) {
    // earned a wild — pair it with the largest real same-slot group
    const bySlot = {}
    wallet.forEach(b => { if (!b.isGold && !b.isRainbow) (bySlot[b.slot] = bySlot[b.slot] || []).push(b) })
    real = Object.values(bySlot).sort((a, b) => b.length - a.length)[0] || []
  } else {
    real = wallet.filter(b => !b.isGold && !b.isRainbow && b.slot === bead.slot && b.id !== bead.id)
  }
  const beads = [bead, ...real, ...wilds].slice(0, 3)
  return { beads, tier: Math.min(beads.length, 3) }
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
  // Stop within the CENTRAL band of the wedge (0.30–0.70): wedges are only 9°
  // wide, and the end-of-spin overshoot+settle travels ~1.5° — landing nearer
  // an edge made the pointer visibly tick into the neighbouring wedge and then
  // slide back (read as "it left BONUS but still paid BONUS" — misleading).
  const segAngle = targetSeg.startAngle + randomBetween(0.30, 0.70) * (targetSeg.endAngle - targetSeg.startAngle)
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
// The reward-flow slot is now a true-RNG, 243-ways video slot. Its symbols, reel
// strips, paytable, ways evaluation, and per-spin/special resolvers all live in
// slotEngine.js — re-exported here so existing importers keep working.
export { SLOT_SYMBOLS, resolveSlotSpin }

// Unlocked tier → number of slot spins you get to play. Each spin is small; the
// tier decides HOW MANY pulls, not how big each one is. Per-spin EV ≈ 42 coins,
// so totals average T1≈125 / T2≈250 / T3≈375 ($1.25 / $2.50 / $3.75).
export const SPINS_PER_TIER = { 1: 3, 2: 6, 3: 9 }


// ═════════════════════════════════════════════════════════════════════════
// ADAPTIVE ENGAGEMENT ENGINE — reshapes the TIMING & FEEL of wins, never the total
// ═════════════════════════════════════════════════════════════════════════
//
// Grounded in the gambling-psychology literature (see ROADMAP "Engagement
// engine"). The load-bearing, fact-checked findings this engine is built on:
//
//   • The two levers that move engagement WITHOUT changing total payout are the
//     TIMING (when/where a win lands) and CADENCE of wins — they interact, and
//     this is the single most directly actionable finding for a fixed-odds game.
//     (James, O'Malley & Tunney 2016, Frontiers in Psych; Clark & Zack 2023,
//     Addictive Behaviors.)
//   • Front-loaded "warm-up" generosity drives in-session engagement
//     (acquisition); a strong finish exploits the peak–end rule. New/low-
//     engagement users benefit most; experienced users tolerate leaner schedules
//     (Horsley et al. 2012) — so warm-up strength scales DOWN with engagement.
//   • Near-misses raise motivation to continue — but ONLY as HONEST 0-coin
//     losses ("so close!"), never as wins (Clark et al. 2009, Neuron).
//
// DESIGN STANCE: this app MAXIMIZES engagement on purpose. The compulsive spin
// loop is gated behind completing a real habit, so the harder it pulls, the more
// habits get done — and no real money is ever staked or lost, so the gambling-harm
// red lines don't apply. Run the engagement levers as hot as they go. Only two
// FUNCTIONAL invariants remain, and neither limits engagement:
//   1. Displayed coins == awarded coins — ONLY because coins redeem for real
//      money/time (the Spend tab), so a fake number would break redemption. There
//      is no losing BET to disguise here, so honest numbers cost nothing — we make
//      the FEEL huge (hot near-misses + juice) while the number stays real.
//   2. Long-run redeemable total per tier stays at the product spec (~125/250/375)
//      until deliberately retuned — a product choice, not ethics. The reshape is a
//      pure PERMUTATION (+ special on a uniformly-random spin), so this holds for free.
// Within those two, everything is fair game: hot near-misses, suspense, escalation,
// no session caps.

function clamp01(x) { return Math.max(0, Math.min(1, x || 0)) }

/**
 * Real-time quit-risk (0..1) inferred from learned per-user signals. Used only
 * to decide WHERE a win lands (earlier when the user is likely to stop), so the
 * most-probably-final interaction is rewarding — never to trap or chase.
 */
export function computeQuitRisk(profile = {}) {
  const {
    curSessionPlays = 0, sessionPlayCountEMA = 0, lossStreak = 0,
    lastGap = 0, interSpinGapEMA = 0,
  } = profile
  let risk = 0
  // (a) at/over their typical session length → likely to stop soon
  if (sessionPlayCountEMA > 0)
    risk += clamp01((curSessionPlays - sessionPlayCountEMA) / Math.max(2, sessionPlayCountEMA)) * 0.5
  // (b) cold-streak fatigue
  risk += clamp01(lossStreak / 6) * 0.3
  // (c) slowing rhythm — this gap noticeably longer than their norm
  if (interSpinGapEMA > 0 && lastGap > 0)
    risk += clamp01((lastGap - interSpinGapEMA) / (interSpinGapEMA * 2)) * 0.2
  return clamp01(risk)
}

/**
 * Map a learned engagement profile → concrete reshape parameters. Outputs only
 * affect spin ORDER and honest near-miss framing — never coin totals.
 * @param {{phase?:string, quitRisk?:number}} profile
 */
export function getSlotEngineParams(profile = {}) {
  const phase = profile.phase || 'new'
  const quitRisk = clamp01(profile.quitRisk)
  const newish = phase === 'new'
  return {
    warmUp: true,                                   // open on a win when one exists (the hook)
    peakEnd: true,                                  // finish on a win/special (peak–end rule)
    // 0 → biggest win lands at the END; 1 → right after the warm-up. Bias the peak
    // EARLIER when the user is new or likely to drift, to re-hook before they put
    // the phone down.
    peakBias: clamp01((newish ? 0.45 : 0.25) + 0.45 * quitRisk),
    // Run near-misses HOT — the strongest per-spin "keep going" lever (Clark 2009).
    // Most 0-coin spins read as "so close!"; even denser when quit-risk is high.
    nearMissDensity: clamp01(0.55 + 0.30 * quitRisk),   // ≈ 0.55–0.85
  }
}

/**
 * Reorder a session's spins for better FEEL (warm-up win, spread so zeros never
 * bunch into a dead run, biggest win at the personalised "peak" slot, strong
 * finish). Pure permutation → the multiset of coin values (and the total) is
 * identical to the input.
 */
function reshapeSessionOrder(spins, params) {
  const n = spins.length
  if (n < 3) return spins.slice()
  const wins = spins.filter(s => s.coins > 0).sort((a, b) => a.coins - b.coins)  // ascending
  const losses = spins.filter(s => s.coins === 0)
  const k = wins.length
  if (k === 0 || k === n) return spins.slice()      // all-loss / all-win: nothing to arrange

  // 1) Spread k win-slots roughly evenly across the session (no long zero runs).
  const used = new Set()
  const winSlots = []
  for (let i = 0; i < k; i++) {
    let s = Math.max(0, Math.min(n - 1, Math.round((i + 0.5) * n / k)))
    while (used.has(s)) s = (s + 1) % n
    used.add(s); winSlots.push(s)
  }
  // 2) Guarantee warm-up (slot 0) and, with ≥2 wins, peak-end (slot n-1).
  const forceWinSlot = (target) => {
    if (used.has(target)) return
    let bi = 0, bd = Infinity
    winSlots.forEach((s, idx) => { const d = Math.abs(s - target); if (d < bd) { bd = d; bi = idx } })
    used.delete(winSlots[bi]); used.add(target); winSlots[bi] = target
  }
  if (params.warmUp) forceWinSlot(0)
  if (params.peakEnd && k >= 2) forceWinSlot(n - 1)

  // 3) Pick the peak slot (gets the biggest win) by peakBias: 0→last, 1→first.
  const sorted = winSlots.slice().sort((a, b) => a - b)
  const peakSlot = sorted[Math.max(0, Math.min(sorted.length - 1,
    Math.round((1 - (params.peakBias ?? 0)) * (sorted.length - 1))))]

  // 4) Biggest win → peak; remaining wins (desc) → nearest-to-peak slots; losses fill the rest.
  const out = new Array(n).fill(null)
  const winsDesc = wins.slice().reverse()
  out[peakSlot] = winsDesc.shift()
  sorted.filter(s => s !== peakSlot)
    .sort((a, b) => Math.abs(a - peakSlot) - Math.abs(b - peakSlot))
    .forEach(s => { out[s] = winsDesc.shift() })
  let li = 0
  for (let i = 0; i < n; i++) if (!out[i]) out[i] = losses[li++]
  return out
}

/**
 * Resolve a full slots SESSION = a sequence of spins (count set by tier).
 * One bonus/jackpot is rolled for the whole session (so a bonus is exactly as
 * likely per cash-in as on the wheel), revealed as an EXTRA final spin. The
 * adaptive engine reshapes the ORDER/FEEL of the paying spins for this user
 * (warm-up, peak placement, honest near-misses) — a pure permutation, so
 * `baseCoins` is unchanged in expectation and the long-run economy stays anchored.
 * @param {1|2|3} activeTier
 * @param {object} luck     pity/warm-up/jackpot-due inputs (bonus & jackpot rates)
 * @param {object} profile  learned engagement profile (phase, quitRisk, …)
 * @returns {{ spinCount, spins:[{grid,winningLines,coins,nearMiss?,isJackpot?,isBonus?}], baseCoins, isJackpot, isBonus, awardedResult, engineParams }}
 */
export function resolveSlotSession(activeTier = 1, luck = {}, profile = {}) {
  const tier = Math.max(1, Math.min(activeTier, 3))
  const spinCount = SPINS_PER_TIER[tier]

  // Bonus/jackpot are pre-rolled ONCE per session (same rates the wheel uses), so
  // their odds and the long-run economy stay anchored while each spin is true RNG.
  const aw = getAdjustedWeights(luck)
  const awTotal = aw.reduce((s, o) => s + o.weight, 0)
  const bonusChance = aw.find(o => o.value === 'bonus').weight / awTotal
  const jackpotChance = 0.006 * (1 + Math.min(luck.spinsSinceJackpot || 0, 90) / 20)
  const isJackpot = Math.random() < jackpotChance
  const isBonus = !isJackpot && Math.random() < bonusChance

  // The session's true-RNG 243-ways spins. The session TOTAL now genuinely varies
  // (high variance — the gamble); only the long-run average is anchored (~125/250/375).
  let spins = []
  for (let i = 0; i < spinCount; i++) spins.push(resolveSlotSpin())

  const params = getSlotEngineParams(profile)
  spins = reshapeSessionOrder(spins, params)   // peak-end reorder (pure permutation)

  // The special is an EXTRA final reveal (pays 0 itself; bonus = a free bead,
  // jackpot = the accumulated pool on top), so a special never changes baseCoins.
  if (isJackpot) spins.push({ ...buildSpecialGrid('jackpot'), coins: 0, isJackpot: true })
  else if (isBonus) spins.push({ ...buildSpecialGrid('bonus'), coins: 0, isBonus: true })

  const baseCoins = spins.reduce((s, sp) => s + sp.coins, 0)
  const awardedResult = isJackpot ? 'jackpot' : isBonus ? 'bonus' : (baseCoins > 0 ? `t${tier}` : 'nothing')
  return { spinCount: spins.length, spins, baseCoins, isJackpot, isBonus, awardedResult, engineParams: params }
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
// label = the DISCOUNT the player sees (= 100 − effort), so the BIG number is the
// WIN (matches slot psychology). value = the internal effort tier the user pre-wrote
// a task for: '75' = "do the MOST" = only 25% off; '25' = "do a little" = 75% off.
export const BONUS_WHEEL_SEGMENTS = [
  { value: '75',   label: '25%',      weight: 33, color: '#FBC0D4' },
  { value: 'free', label: 'FREE 🎁', weight: 13, color: '#BCE8D2' },
  { value: '50',   label: '50%',      weight: 19, color: '#D3C0EC' },
  { value: '25',   label: '75%',      weight: 22, color: '#FBDFA8' },
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

// ── Per-habit bonus tiers ────────────────────────────────────────────────
// The user pre-writes a "little / some / most" version of a quick bonus for each
// habit (in plain words — no percentage math at play time). The wheel lands on a
// tier and shows their own words back. Keyed by the internal effort value so a
// wheel result maps straight to a tier. Ordered most-discount-first for the form.
export const BONUS_TIERS = [
  { key: '25', word: 'A little', discount: 75 },
  { key: '50', word: 'Some',     discount: 50 },
  { key: '75', word: 'Most',     discount: 25 },
]

/** The discount % shown to the player for a wheel result (null for the free bead). */
export function bonusDiscount(bonusResult) {
  if (bonusResult === 'free') return null
  const p = parseInt(bonusResult, 10)
  return Number.isFinite(p) ? 100 - p : null
}

/**
 * Resolve the bonus task TEXT for a result: the habit's own tier if set, else the
 * global default tier, else a legacy single activity, else a gentle fallback. There
 * is no percentage math — the user already wrote what each tier means.
 * @param {string} bonusResult  '75'|'50'|'25'|'free'
 * @returns {string|null}  null for the free-bead result (no task)
 */
export function resolveBonusTask(bonusResult, habit, settings) {
  if (bonusResult === 'free') return null
  const own = habit?.rewards?.bonusTiers?.[bonusResult]
  const dflt = settings?.bonusTiers?.[bonusResult]
  const legacy = settings?.bonusActivity
  return (own && own.trim()) || (dflt && dflt.trim()) || (legacy && legacy.trim()) || 'your quick bonus'
}
