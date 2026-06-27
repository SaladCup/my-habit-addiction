// ─────────────────────────────────────────────────────────────────────────────
// REWARD-FLOW SLOT ENGINE — true-RNG, 5-reel × 3-row, 243 "ways to win".
// ─────────────────────────────────────────────────────────────────────────────
// Unlike the old pre-determined 3×3 model, this is a REAL slot: each spin rolls
// the reels from weighted strips and we EVALUATE the wins. A symbol pays when it
// lands on consecutive reels from the LEFT, in any row (243 ways = 3^5). No fixed
// paylines. Wild substitutes (reels 2–4 only — keeps the ways-math clean, per the
// slot-design literature) and DOUBLES any win it completes. Pay = base × ways
// (ways = product of the symbol's per-reel counts).
//
// The paytable + reel weights are Monte-Carlo-tuned so the per-spin EV ≈ 42 coins
// → sessions of 3/6/9 spins average ≈ 125/250/375 (matching the wheel), but with
// HIGH variance: most sessions pay less than the wheel, with a real shot at 2–5×
// and a rare "holy cow" tail. Bonus + jackpot are pre-rolled per session (see
// resolveSlotSession) so their rates and the economy stay anchored.

// id ↔ image ↔ role. `bonus` appears only on the pre-rolled bonus reveal; every
// other symbol is in the regular reel pool. (Art lives in public/slots/.)
export const SLOT_SYMBOLS = [
  { id: 'cherry',    emoji: '🍒', img: '/slots/cherry.png',    role: 'low' },
  { id: 'sakura',    emoji: '🌸', img: '/slots/sakura.png',    role: 'low' },
  { id: 'cute1',     emoji: '🍬', img: '/slots/cute1.png',     role: 'low' },
  { id: 'cute2',     emoji: '🧁', img: '/slots/cute2.png',     role: 'low' },
  { id: 'star',      emoji: '⭐', img: '/slots/star.png',      role: 'mid' },
  { id: 'butterfly', emoji: '🦋', img: '/slots/butterfly.png', role: 'mid' },
  { id: 'cute3',     emoji: '🍡', img: '/slots/cute3.png',     role: 'mid' },
  { id: 'bow',       emoji: '🎀', img: '/slots/bow.png',       role: 'high' },
  { id: 'moon',      emoji: '🌙', img: '/slots/moon.png',      role: 'high' },
  { id: 'crown',     emoji: '👑', img: '/slots/crown.png',     role: 'high' },
  { id: 'seven',     emoji: '7️⃣', img: '/slots/seven.png',     role: 'top' },
  { id: 'wild',      emoji: '🃏', img: '/slots/wild.png',      role: 'wild' },
  { id: 'bonus',     emoji: '🎰', img: '/slots/bonus.png',     role: 'scatter' },
]
const SYM = Object.fromEntries(SLOT_SYMBOLS.map(s => [s.id, s]))
const NAME = {
  cherry: 'Cherry', sakura: 'Sakura', cute1: 'Candy', cute2: 'Cupcake',
  star: 'Star', butterfly: 'Butterfly', cute3: 'Dango', bow: 'Bow',
  moon: 'Moon', crown: 'Crown', seven: 'Lucky 7', wild: 'Wild', bonus: 'Bonus',
}

// Per-reel symbol frequencies (the "reel strip" — what controls the odds).
// `wild` is dropped on reels 0 and 4 (handled in reelRoll). Tuned by simulation.
export const REEL_WEIGHTS = {
  cherry: 24, sakura: 22, cute1: 18, cute2: 16,
  star: 13, butterfly: 11, cute3: 9,
  bow: 7, moon: 6, crown: 5,
  seven: 5, wild: 5,
}
// Pay by run length (consecutive reels from the left). min: low pays from 2, the
// rest from 3. `seven` 5-of-a-kind is the in-spin "mega". Tuned to EV ≈ 42/spin.
const PAYTABLE = {
  cherry: { 2: 3, 3: 10, 4: 30, 5: 77 }, sakura: { 2: 3, 3: 10, 4: 30, 5: 77 },
  cute1:  { 2: 3, 3: 9,  4: 26, 5: 68 }, cute2:  { 2: 3, 3: 9,  4: 26, 5: 68 },
  star:      { 3: 19, 4: 61, 5: 166 }, butterfly: { 3: 19, 4: 61, 5: 166 }, cute3: { 3: 17, 4: 55, 5: 149 },
  bow:       { 3: 44, 4: 153, 5: 417 }, moon:      { 3: 48, 4: 166, 5: 459 }, crown: { 3: 51, 4: 183, 5: 510 },
  seven:     { 3: 136, 4: 442, 5: 1700 },
}
const MIN_RUN = id => (SYM[id].role === 'low' ? 2 : 3)
const WILD_MULT = 2
const PAY_IDS = Object.keys(PAYTABLE)
const POOL = SLOT_SYMBOLS.filter(s => s.id !== 'bonus').map(s => s.id)   // regular reel pool
const POOL_NO_WILD = POOL.filter(id => id !== 'wild')

function reelRoll(reel) {
  const ids = (reel === 0 || reel === 4) ? POOL_NO_WILD : POOL
  let total = 0
  for (const id of ids) total += REEL_WEIGHTS[id]
  let r = Math.random() * total
  for (const id of ids) { r -= REEL_WEIGHTS[id]; if (r < 0) return id }
  return ids[ids.length - 1]
}
function rollGrid() {
  const g = [[], [], []]
  for (let row = 0; row < 3; row++) for (let c = 0; c < 5; c++) g[row][c] = SYM[reelRoll(c)]
  return g
}

// Evaluate every pay symbol's left-to-right run. Wild substitutes + doubles.
function evaluate(grid) {
  let coins = 0
  const wins = []
  for (const id of PAY_IDS) {
    const cnt = [], wildOn = []
    for (let c = 0; c < 5; c++) {
      let k = 0, w = false
      for (let r = 0; r < 3; r++) { const g = grid[r][c].id; if (g === id) k++; else if (g === 'wild') { k++; w = true } }
      cnt.push(k); wildOn.push(w)
    }
    let run = 0, ways = 1, hasWild = false
    for (let c = 0; c < 5; c++) { if (cnt[c] > 0) { run++; ways *= cnt[c]; if (wildOn[c]) hasWild = true } else break }
    if (run < MIN_RUN(id) || PAYTABLE[id][run] == null) continue
    const pay = PAYTABLE[id][run] * ways * (hasWild ? WILD_MULT : 1)
    const cells = []
    for (let c = 0; c < run; c++) for (let r = 0; r < 3; r++) { const g = grid[r][c].id; if (g === id || g === 'wild') cells.push([r, c]) }
    coins += pay
    wins.push({ symbolId: id, symbol: SYM[id], run, ways, coins: pay, cells, hasWild, label: `${run}× ${NAME[id]}` })
  }
  // best win first (drives the spotlight + summary)
  wins.sort((a, b) => b.coins - a.coins)
  return { coins, wins }
}

function spinSummary(wins, coins) {
  if (!wins.length) return 'So close — keep spinning! 💕'
  const top = wins[0]
  if (wins.length === 1) return `${top.label}${top.hasWild ? ' + WILD ×2' : ''} — +${top.coins}! ✨`
  return `${wins.length} wins — +${coins} coins! ✨`
}

/** Resolve ONE true-RNG spin. → { grid:[3][5] of symbol objects, wins, coins, summary } */
export function resolveSlotSpin() {
  const grid = rollGrid()
  const { coins, wins } = evaluate(grid)
  return { grid, wins, coins, summary: spinSummary(wins, coins) }
}

/**
 * The pre-rolled bonus/jackpot reveal grid (an EXTRA final spin that pays 0 itself —
 * bonus = a free bead, jackpot = the accumulated pool on top). Jackpot shows five
 * 7s across the middle; bonus shows three bonus scatters.
 */
export function buildSpecialGrid(kind) {
  const grid = [[], [], []]
  for (let row = 0; row < 3; row++) for (let c = 0; c < 5; c++) grid[row][c] = SYM[reelRoll(c)]
  let wins
  if (kind === 'jackpot') {
    const cells = []
    for (let c = 0; c < 5; c++) { grid[1][c] = SYM.seven; cells.push([1, c]) }
    wins = [{ symbolId: 'seven', symbol: SYM.seven, run: 5, ways: 1, coins: 0, cells, hasWild: false, special: 'jackpot', label: 'FIVE Lucky 7s' }]
  } else {
    const spots = [[0, 0], [1, 2], [2, 4]]
    spots.forEach(([r, c]) => { grid[r][c] = SYM.bonus })
    wins = [{ symbolId: 'bonus', symbol: SYM.bonus, ways: 1, coins: 0, cells: spots, hasWild: false, special: 'bonus', label: 'Triple Bonus' }]
  }
  return {
    grid, wins, coins: 0, special: kind,
    summary: kind === 'jackpot' ? '💎 FIVE Lucky 7s — JACKPOT! The whole pool is yours!' : '🎰 Triple Bonus — spin for a free bead!',
  }
}
