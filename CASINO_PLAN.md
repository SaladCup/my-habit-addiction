# Habit Casino — Architecture & Game Plan

**Status:** plan (2026-06-15). Locked decisions with Lauren: **same coins** as the
betting currency, **full-send** risk (no floor — you can lose everything you bet),
**Casino replaces the Beads tab**. Bead-viewing moves onto Home.

## Concept / the loop
An OPTIONAL casino where you bet the coins you earned from habits. House edge slowly
drains your balance, so losing pushes you back to your habits to earn more → gamble
more. No real money anywhere; coins are play-money (but redeemable in-app for guilt-free
$/time, which is exactly what makes betting them feel like real stakes).

## Research note (2026-06-15)
Deep-research run; the adversarial-verify phase was cut short by a usage limit, so the
specifics below are **cross-checked against established gambling math** rather than fully
independently verified. Key finds:
- **"Gamble With Your Friends"** = a **Steam co-op multiplayer casino** game (not Roblox).
  Floor progression (Floors 1–4), shared bank, daily quota, usable items (Taser, Golden
  Chip, Holy Statue, Drink, Insurance), 55 achievements.
- **Minigame roster** (inspiration): F1 — Roulette, Duck Race, Wheel of Fortune, Street
  Craps, Blackjack, Slots; F2 — **Penguin Cross**, Keno, **Crash**, Plinko, HiLo, Money
  Wheel; F3 — Dragon Tower, 1P Poker, Mine Sweeper.
- **The "penguin jump" game = "Penguin Cross"** — a crossing/"Chicken Road"-style
  rising-multiplier game. Same cumulative-survival engine as Crash & Mines.
- The co-op/floors/items are multiplayer-specific → not for our single-player app. BUT the
  **items idea** (e.g. Insurance = refund part of a loss; Golden Chip = guaranteed win)
  is a nice optional future power-up layer, possibly bought with coins or earned from
  milestones.

## The one dial: RTP / house edge
**Universal rule:** `RTP = win_probability × payout_multiplier`. To hit a target RTP `R`
at win-probability `p`, set the win payout `m = R / p`. House edge = `1 − R`.

**Recommendation for THIS app: ~93% RTP (7% house edge) as the default, with HIGH
variance on the exciting games.** Reasoning: real crypto-casinos run 96–99% because players
make *thousands* of bets — a bigger edge would bankrupt them fast. Here coins are *scarce*
(earned slowly from habits), so a steep edge would vaporize a balance in one sitting and
feel punishing → kills motivation (the opposite of the goal). A **modest edge drains
slowly across many sessions** (the habit driver) while **high variance supplies the thrill**
(big swings session to session). Edge is the feature; variance is the fun. Tune per game.

## Games — specs + math

Each: rule → math → RTP knob → variance → hook → build cost.

### 1. Coin Flip  *(simplest — build first / tutorial game)*
- Pick Heads/Tails, bet, flip. Win pays **1.90×** (`m = 0.95/0.5`) → ~95% RTP. (Plain default.)
- *Optional kawaii flavor:* true **2×** wins, but ~5% of flips land on the **edge** 🪙 and the
  house takes it (same edge, built-in near-miss). Toggleable.
- **Hook — "Let It Ride":** after a win, flip again with the whole pot riding; compounds
  per win, one loss wipes it, bank anytime. A 2-outcome mini-Crash.
- Build: tiny. One spinning-coin animation; reuse coin art + win/coin sounds.

### 2. Crash  *(headliner — build alongside Coin Flip)*
- Multiplier climbs from 1.00×; tap **CASH OUT** before it busts. Optional auto-cashout target.
- **Math:** bust point `b = max(1.00, R / (1 − random()))`, `random()` in [0,1). This gives
  `P(reach t) = R/t`, so cashing out at any target `t` yields EV `= (R/t)·t = R` → RTP is `R`
  no matter the target. Add a small instant-bust chance for extra edge if wanted.
- Variance: very high (heavy-tailed; median bust ≈ 2×, rare 50×+). Knob: `R` (and instant-bust %).
- **Hook:** the live rising counter + cash-out-button tension is the single stickiest mechanic
  in modern gambling. Auto-bet + "1 more round."

### 3. Penguin Cross  *(your reference game — build after Crash; shares its engine)*
- A penguin crosses lanes one tap at a time. Each lane survived raises the multiplier; cash
  out anytime; get hit = lose it all. Difficulty (Easy/Med/Hard) sets the danger.
- **Math (cumulative survival):** per-lane survival prob `s` (Easy .90 / Med .80 / Hard .65).
  Multiplier after `k` lanes `m_k = R / s^k`. Each lane: survive if `random() < s`.
- Variance: tunable by difficulty. Hard = few lanes survive but multipliers rocket.
- **Hook:** visible "one more lane" greed; the penguin animation makes the bust *hurt* (cute).
- Build: medium; same survival engine reused for Mines & Dragon Tower later.

### 4. Mines
- 5×5 grid, choose `M` mines (1–24). Reveal gems to raise the multiplier; hit a mine = lose.
- **Math:** after `k` safe reveals with `M` mines, `m_k = R · Π_{i=0..k-1}(25−i)/(25−M−i)`
  = `R · C(25,k)/C(25−M,k)`. Each reveal: safe with prob `(25−M−revealed)/(25−tilesOpened)`.
- Variance: `M` is the knob (more mines = higher variance, fatter multipliers).
- **Hook:** escalating "do I cash out or reveal one more?" — pure loss-aversion tension.

### 5. Plinko
- Drop a token (a bead!) through `n` rows of pegs into bucket `k` (0..n).
- **Math:** `P(bucket k) = C(n,k) / 2^n` (binomial). Pick bucket multipliers `v_k` so
  `Σ P(k)·v_k = R`. Risk modes (Low/Med/High) reshape `v_k`: High = huge outer (e.g. 100×–
  1000×), near-zero center (0.2×); Low = gentle 0.5×–5×. Rows 8–16.
- **Hook:** mesmerizing physical drop; high-risk mode is a slot-machine-grade dopamine engine.
- Build: medium; reuse the 3D bead/physics work for the drop.

### 6. Dice / Limbo
- Pick a target multiplier (or roll-under number); win if the roll clears it.
- **Math:** for target multiplier `m`, win prob `p = R/m`; win if `random() < p`. (Equivalently
  "roll under `R/m·100` on a 0–100 die.") Slider lets the player trade win-chance for payout.
- **Hook:** instant, infinitely repeatable; the slider gives an illusion of control.
- Build: small (no animation-heavy needs).

### 7. Hi-Lo
- A card shows; bet the next is Higher or Lower (ties = push or configurable). Correct = continue
  with a rising streak multiplier; bank anytime; wrong = lose.
- **Math:** with current rank, `p = (favorable ranks)/13`; step multiplier `= R/p`. Streak multiplies.
- **Hook:** streak-banking tension (lose it all vs. lock in); fast.
- Build: small–medium; reuse a card-flip animation (also feeds Blackjack).

### 8. Blackjack  *(deepest — build later)*
- Standard hit/stand/double (+ optional split), vs a kawaii dealer. RTP ≈ 99.5% with basic
  strategy — emerges from the rules, not a payout knob (we can nudge via rules: dealer hits
  soft 17, 3:2 vs 6:5 blackjack).
- **Hook:** "one more hand," decisions feel skillful.
- Build: large (hand logic, dealer AI, split/double states).

### 9. Slots (bet mode)  &  10. Fortune Wheel (bet mode)
- Reuse the existing `SlotMachine.jsx` / `Wheel.jsx` visuals + new sounds. Difference from
  today: these are *earn* mechanics (free, tier-based) → casino versions are *bet* mechanics
  (wager coins, paytable tuned to target RTP ~90–93%).
- Slots: design the paytable so `Σ P(combo)·payout = R`; pick hit-frequency vs jackpot size.
- Wheel: bet on a segment / on the landed tier; segment payouts set RTP.
- Build: medium (mostly economy wiring; visuals exist).

### 11. Scratch card / lucky dip  *(optional quick win)*
- Buy a card for X coins, scratch to reveal symbols, match 3 → prize. Instant. RTP via prize table.
- **Hook:** tactile reveal; cheap impulse plays between bigger games.

## Architecture

### Nav & routes
- Remove the Beads tab (`WalletScreen`) from nav; add **Casino**. New icon needed (kawaii slot
  cabinet / dice / cards). Verify nothing unique lives in WalletScreen before deleting — bead
  cash-in already happens at the Home reveal, and "YOUR NEXT SPIN" is informational; fold any
  needed bead summary onto Home.
- `/casino` = lobby (grid of game tiles, each showing min bet + a teaser). Per-game routes:
  `/casino/coinflip`, `/casino/crash`, `/casino/penguin`, `/casino/mines`, `/casino/plinko`,
  `/casino/dice`, `/casino/hilo`, `/casino/blackjack`, `/casino/slots`, `/casino/wheel`.
  Add all to `HIDDEN_NAV_ROUTES` so the bottom nav hides inside a game (full-screen play).

### Store / economy
- One coin balance (existing `coinTotals {earned, spent}`). Add gambling actions:
  - `placeBet(amount)` → guards `amount > 0 && amount <= balance`; deducts; logs `{type:'bet'}`.
  - `settleBet(payout)` → adds `payout` (0 on loss); logs `{type:'win'}` when `payout>0`.
  - Or a single atomic `resolveGamble(bet, payout, game)` that logs both legs.
- **Keep gambling separate in the ledger**: new coinLog types `bet` / `win` (distinct from
  habit `earned` and reward `spent`). So Stats can show "earned X from habits · net Y at the
  casino" honestly, and the house-edge drain is visible. Extend `coinTotals` with
  `{wagered, won}` (or a `gambling` sub-tally) for O(1) stats.
- Full-send: no floor. Optional `settings.safetyReserve` (default **0** = off) — if set, you
  can't bet below that reserve. Off by default per Lauren's "full send."
- Persist: bump version, migrate to add the new tally fields (default 0). Add to `partialize`.

### Engine (pure, testable — mirror gameLogic.js)
- `src/engine/casino/` modules per game returning outcomes from a seedable RNG:
  `coinflip.js`, `crash.js`, `cross.js` (penguin), `mines.js`, `plinko.js`, `dice.js`,
  `hilo.js`, `blackjack.js`, `slotsBet.js`, `wheelBet.js`, `scratch.js`.
- Shared `rtp.js`: `payoutFor(p, R)`, `survivalMultiplier(...)`, the universal `R = p·m` helper,
  and a provably-fair-style RNG wrapper (so we can show a "fair" seed/hash if wanted).
- Each module ships a stress-test (like the existing 40k-iteration econ sim) asserting the
  realized RTP matches target within tolerance — DO THIS so the math can't silently drift.

### Shared UI
- `CasinoLayout` — sticky balance header + a **BetBar** (bet amount stepper, ½ / 2× / MAX,
  quick chips, the primary action button). Every game embeds it.
- Reuse: `CoinCascade3D` for payouts, `BeadJar3D`/bead art for Plinko tokens, `SlotMachine`/
  `Wheel` for the bet-mode versions, the new win/coin/jackpot sounds, `KawaiiButton`/`PixelPanel`.

### Guardrails (even in full-send)
- Hard: can't bet > balance, can't bet ≤ 0, confirm dialog on an all-in (>80% of balance).
- Optional & default-off: safety reserve; a per-day session-loss notice ("rough run — maybe go
  earn a few?"); these exist but never block, respecting the full-send choice.

## Build phases
- **P0 — Skeleton:** nav swap (Beads→Casino), lobby shell, economy (`placeBet`/`settleBet` +
  ledger types + stats tally + migration), `CasinoLayout` + `BetBar`, `rtp.js` helper.
- **P1 — Prove the loop:** **Coin Flip** + **Crash** end-to-end (bet → play → win/lose →
  balance updates → stats). The two simplest, stickiest games.
- **P2 — Survival family:** **Penguin Cross** + **Mines** (share the cumulative-survival engine).
- **P3 — Quick-luck:** **Plinko** + **Dice/Limbo** + **Hi-Lo**.
- **P4 — Reuse engines:** **Slots** + **Fortune Wheel** bet-mode.
- **P5 — Depth & polish:** **Blackjack** + **Scratch**, Stats casino section, win celebrations,
  RTP tuning pass, optional power-up items.

## Open calls for Lauren
1. **RTP aggressiveness** — recommend ~93% / 7% edge default (high variance on Crash/Plinko/Mines).
   How hard should it bite? (Higher edge = faster drain = more habit pressure, but more "feels bad.")
2. **v1 scope to greenlight** — recommend P0 + P1 (skeleton + Coin Flip + Crash) as the first
   shippable slice, then iterate.
3. New **Casino nav icon** art (you generate to spec, like the other icons).
