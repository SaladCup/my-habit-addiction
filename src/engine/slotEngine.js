// ─────────────────────────────────────────────────────────────────────────────
// REWARD-FLOW SLOT ENGINE — true-RNG, 5-reel × 3-row, 15 PAYLINES.
// ─────────────────────────────────────────────────────────────────────────────
// A REAL slot: each spin rolls the reels from weighted strips and we EVALUATE the
// wins against 15 fixed PAYLINES (rows, diagonals, V/∧ peaks, zigzags). A symbol
// pays when matching symbols land on consecutive reels FROM THE LEFT *along a
// line* (low symbols from 2-in-a-row, the rest from 3). Wild substitutes (reels
// 2–4 only) and DOUBLES any line it completes. Each winning line carries its
// `cells` + `line` shape so the UI can draw a ring on every winning symbol and a
// colored line connecting them — you can SEE exactly how the line won.
//
// The paytable + reel weights are Monte-Carlo-tuned so the per-spin EV ≈ 41 coins
// → sessions of 3/6/9 spins average ≈ 125/250/375 (matching the wheel), with a
// ~52% hit rate (frequent small wins) but HIGH variance: the median session pays
// LESS than the wheel, with a real shot at 2–5× and a rare "holy cow" tail. Bonus
// + jackpot are pre-rolled per session (see resolveSlotSession) so their rates and
// the economy stay anchored.

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
  cherry: 'Cherry', sakura: 'Sakura', cute1: 'Cute Bar', cute2: 'Double Cute',
  star: 'Star', butterfly: 'Butterfly', cute3: 'Triple Cute', bow: 'Bow',
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
// ── Paylines ──────────────────────────────────────────────
// 15 fixed lines across the 5×3 grid. Each entry is the ROW (0=top, 1=middle,
// 2=bottom) the line passes through on each of the 5 reels. A line pays when
// matching symbols (wild substitutes) land on consecutive reels FROM THE LEFT
// along its path. The UI draws each line's color + a ring on every winning cell.
export const PAYLINES = [
  [1, 1, 1, 1, 1], //  1  middle row
  [0, 0, 0, 0, 0], //  2  top row
  [2, 2, 2, 2, 2], //  3  bottom row
  [0, 1, 2, 1, 0], //  4  V (valley)
  [2, 1, 0, 1, 2], //  5  ∧ (peak)
  [0, 0, 1, 2, 2], //  6  top → bottom slope
  [2, 2, 1, 0, 0], //  7  bottom → top slope
  [1, 0, 0, 0, 1], //  8  bump up
  [1, 2, 2, 2, 1], //  9  bump down
  [0, 1, 1, 1, 0], // 10  shallow valley
  [2, 1, 1, 1, 2], // 11  shallow peak
  [1, 0, 1, 2, 1], // 12  zigzag
  [1, 2, 1, 0, 1], // 13  zigzag
  [0, 1, 0, 1, 0], // 14  top zigzag
  [2, 1, 2, 1, 2], // 15  bottom zigzag
]

// Pay by run length (consecutive matches along a line, from the left). Low symbols
// pay from 2, the rest from 3. `seven` 5-of-a-kind is the in-spin "mega". Monte-
// Carlo-tuned to EV ≈ 41/spin at ~52% hit rate.
const PAYTABLE = {
  cherry: { 2: 11, 3: 27, 4: 81, 5: 216 }, sakura: { 2: 11, 3: 27, 4: 81, 5: 216 },
  cute1:  { 2: 15, 3: 38, 4: 114, 5: 304 }, cute2:  { 2: 20, 3: 49, 4: 147, 5: 392 },
  star:      { 3: 76, 4: 228, 5: 608 }, butterfly: { 3: 87, 4: 261, 5: 696 }, cute3: { 3: 65, 4: 195, 5: 520 },
  bow:       { 3: 125, 4: 375, 5: 1000 }, moon:      { 3: 147, 4: 441, 5: 1176 }, crown: { 3: 170, 4: 510, 5: 1360 },
  seven:     { 3: 350, 4: 1050, 5: 3850 },
}
const MIN_RUN = id => (SYM[id].role === 'low' ? 2 : 3)
const WILD_MULT = 2
const POOL = SLOT_SYMBOLS.filter(s => s.id !== 'bonus').map(s => s.id)   // regular reel pool
const POOL_NO_WILD = POOL.filter(id => id !== 'wild')

// ── In-app pay table (read by SlotPayTable.jsx) ───────────
// Ordered low → high so the ladder reads cleanly. Each row carries the display
// name, art, payouts by run length, and the min matching reels needed to pay.
export const PAYOUT_ROWS = ['cherry', 'sakura', 'cute1', 'cute2', 'cute3', 'star', 'butterfly', 'bow', 'moon', 'crown', 'seven']
  .map(id => ({ id, name: NAME[id], img: SYM[id].img, emoji: SYM[id].emoji, role: SYM[id].role, minRun: MIN_RUN(id), pays: PAYTABLE[id] }))
// Rules surfaced in the pay table (so the copy can't drift from the math).
export const SLOT_RULES = { wildMult: WILD_MULT, wildReels: [2, 3, 4], bonusCount: 3, jackpotRun: 5, lineCount: PAYLINES.length }

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

// Evaluate each payline left-to-right. Reel 0 never holds a wild, so the line's
// symbol = its reel-0 symbol; wilds on later reels substitute + double the pay.
// Each win carries `line` (the row shape) + `cells` so the UI can ring the
// winning symbols and connect them with the line's color.
function evaluate(grid) {
  const all = []
  const seen = new Set()
  for (let li = 0; li < PAYLINES.length; li++) {
    const line = PAYLINES[li]
    const id = grid[line[0]][0].id
    if (!PAYTABLE[id]) continue
    let run = 1, hasWild = false
    for (let c = 1; c < 5; c++) {
      const g = grid[line[c]][c].id
      if (g === id) run++
      else if (g === 'wild') { run++; hasWild = true }
      else break
    }
    if (run < MIN_RUN(id) || PAYTABLE[id][run] == null) continue
    // Skip overlapping paylines that win on the EXACT same cells — they'd draw a
    // duplicate ring/line. Same run-rows + symbol ⇒ identical win.
    const key = id + ':' + line.slice(0, run).join(',')
    if (seen.has(key)) continue
    seen.add(key)
    const pay = PAYTABLE[id][run] * (hasWild ? WILD_MULT : 1)
    const cells = []
    for (let c = 0; c < run; c++) cells.push([line[c], c])
    all.push({ symbolId: id, symbol: SYM[id], run, lineIndex: li, line, coins: pay, cells, hasWild, label: `${run}× ${NAME[id]}` })
  }
  // Drop "nested" wins — a shorter line whose winning cells are FULLY CONTAINED in
  // a longer win reads as double-counting ("2× AND 4× Cute Bar" on the same start).
  // Keep only the longest reach, which pays exactly what the pay table shows.
  const sets = all.map(w => new Set(w.cells.map(([r, c]) => r + ',' + c)))
  const wins = all.filter((w, i) => !all.some((o, j) =>
    j !== i && sets[j].size > sets[i].size && [...sets[i]].every(k => sets[j].has(k))
  ))
  // best win first (drives the summary + reveal order)
  wins.sort((a, b) => b.coins - a.coins)
  const coins = wins.reduce((s, w) => s + w.coins, 0)
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

// Pick `n` scatter cells on distinct reels (random row each), sorted left→right —
// so the bonus scatters land somewhere fresh every time instead of a fixed shape.
function randomScatterCells(n) {
  const cols = [0, 1, 2, 3, 4]
  for (let i = 0; i < n; i++) {            // partial Fisher–Yates over the reels
    const j = i + Math.floor(Math.random() * (cols.length - i))
    const t = cols[i]; cols[i] = cols[j]; cols[j] = t
  }
  return cols.slice(0, n).sort((a, b) => a - b).map(c => [Math.floor(Math.random() * 3), c])
}

/**
 * The pre-rolled bonus/jackpot reveal grid (an EXTRA final spin that pays 0 itself —
 * bonus = a free bead, jackpot = the accumulated pool on top). Jackpot shows five
 * 7s across the center line (the defined jackpot combo); bonus scatters three Bonus
 * symbols at random positions.
 */
export function buildSpecialGrid(kind) {
  const grid = [[], [], []]
  for (let row = 0; row < 3; row++) for (let c = 0; c < 5; c++) grid[row][c] = SYM[reelRoll(c)]
  let wins
  if (kind === 'jackpot') {
    const cells = []
    for (let c = 0; c < 5; c++) { grid[1][c] = SYM.seven; cells.push([1, c]) }
    wins = [{ symbolId: 'seven', symbol: SYM.seven, run: 5, lineIndex: 0, line: PAYLINES[0], coins: 0, cells, hasWild: false, special: 'jackpot', label: 'FIVE Lucky 7s' }]
  } else {
    const spots = randomScatterCells(3)
    spots.forEach(([r, c]) => { grid[r][c] = SYM.bonus })
    wins = [{ symbolId: 'bonus', symbol: SYM.bonus, coins: 0, cells: spots, hasWild: false, special: 'bonus', label: 'Triple Bonus' }]
  }
  return {
    grid, wins, coins: 0, special: kind,
    summary: kind === 'jackpot' ? '💎 FIVE Lucky 7s — JACKPOT! The whole pool is yours!' : '🎰 Triple Bonus — spin for a free bead!',
  }
}
