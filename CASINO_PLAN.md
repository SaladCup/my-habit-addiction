# Habit Casino — Architecture & Game Plan

**Status:** plan (2026-06-15). Locked decisions with Lauren: **same coins** as the
betting currency, **full-send** risk (no floor — you can lose everything you bet),
**Casino replaces the Beads tab**. Bead-viewing moves onto Home.

## Concept / the loop
An OPTIONAL casino where you bet the coins you earned from habits. House edge slowly
drains your balance, so losing pushes you back to your habits to earn more → gamble
more. No real money anywhere; coins are play-money (but redeemable in-app for guilt-free
$/time, which is exactly what makes betting them feel like real stakes).

## Research note (2026-06-15, updated)
A deep-research run + a targeted follow-up. (The first run's "all claims refuted" was a
false alarm — the verifier agents *abstained* on a usage limit, 0-0 votes, not genuine
refutations.) Follow-up search **confirmed** the game identity + math and added exact tables;
the 8-row Plinko Low table below math-checks to 99.0% RTP, so the sources are sound. Key finds:
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

**Recommendation for THIS app: ~95% RTP (5% house edge) default, with HIGH variance on
the exciting games.** The research clarified something important: **variance, not the edge,
is what actually busts a balance.** A player who goes all-in chasing a 5× crash busts ~80%
of the time whether the edge is 1% or 7% — so the motivational "I lost it, go earn more"
moment comes from *greed + variance*, not from a punishing payout table. That means I can
keep RTP fairly **high (feels fair, "winnable," self-blame not "rigged")** and let the
player's own all-in behavior (full-send) create the busts. The modest 5% edge just stops the
coin supply from inflating over the long run. Real crypto-casinos sit at 96–99%; I'd go a
touch lower (90–96% band, tunable per game) since coins are scarcer here. Edge = anti-inflation;
variance + greed = the habit driver.

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
- **Math (VERIFIED standard):** survival function `P(bust ≥ m) = R / m`. Generate a round with
  `bust = max(1.00, R / (1 − random()))`, `random()` in [0,1). Cashing out at any target `t`
  yields EV `= (R/t)·t = R` → RTP is `R` regardless of target (the multiplier cancels). Real
  operators bake the edge in by multiplying every bust by `(1−edge)`: Stake/BC.Game/Roobet ≈1%
  (99% RTP), Aviator 3%, Spaceman 4%, F777 5%. Bustabit's classic variant uses an instant-bust
  (~1-in-101 rounds bust at 1.00×) to carry the edge instead.
- Variance: very high (heavy-tailed). At ~1% edge: ~50% of rounds bust below 2×, ~10% exceed
  10×, median ≈ 1.98×. Knob: `R` (and/or instant-bust %).
- **Hook:** the live rising counter + cash-out-button tension is the single stickiest mechanic
  in modern gambling. Auto-bet + "1 more round."

### 3. Penguin Cross  *(your reference game — build after Crash; shares its engine)*
- A penguin crosses lanes one tap at a time. Each lane survived raises the multiplier; cash
  out anytime; get hit = lose it all. Difficulty (Easy/Med/Hard) sets the danger.
- **Math (cumulative survival, VALIDATED vs "Chicken Road"):** per-lane survival prob `s`.
  Multiplier after `k` lanes `m_k = R / s^k`; each lane survives if `random() < s`. Chicken
  Road (the canonical version, 98% RTP) uses Easy 24 lanes / 4% hazard (`s=.96`), Medium 22 /
  12% (`s=.88`), Hard 20 / 20% (`s=.80`), Hardcore 18 / higher. Check: Easy step-1 `= .98/.96 =`
  **1.02×**, matching the real game exactly. For our app I'd **cap the lane count** (their Hard
  tops out at 52,000×, absurd for us) — e.g. 8–12 lanes so the top multiplier stays in the
  ~5×–50× range while keeping the per-lane hazard.
- Variance: tunable by difficulty (hazard + lane count). Hard = few survive but multipliers rocket.
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
  `Σ P(k)·v_k = R`. Risk modes reshape `v_k`: High = huge outer / near-zero center; Low = gentle.
- **VERIFIED tables** (Stake, ~99% RTP — center-out, mirror the other half; the 8-row Low array
  math-checks to exactly 99.0%):
  - **8 rows** — Low `[5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6]`; Med `[13, 3, 1.3, 0.7, 0.4, …]`;
    High `[29, 4, 1.5, 0.3, 0.2, …]`
  - **12 rows** — Low `[10, 3, 1.6, 1.4, 1.1, 1, 0.5, …]`; Med `[33, 11, 4, 2, 1.1, 0.6, 0.3, …]`;
    High `[170, 24, 8.1, 2, 0.7, 0.2, 0.2, …]`
  - **16 rows** — Low `[16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, …]`; Med `[110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, …]`;
    High `[1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, …]`
  - (To retune to a lower app RTP, scale every value by `targetRTP/0.99`.)
- **Hook:** mesmerizing physical drop; high-risk mode is a slot-machine-grade dopamine engine.
- Build: medium; reuse the 3D bead/physics work for the drop (the token *is* a bead).

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

## ENGINE DIRECTION — make the games look pro (research-backed, 2026-06-15)
Deep-research (25 verified claims) on how real slot/casino software is built. Verdict: **keep the React
habit-tracker app; render the GAMES with real engines embedded inside it. You already have BOTH engines
in this app.** Reuse the existing `src/engine/casino/*` logic (renderer-agnostic) under any new visuals.
- **2D slot/card/wheel games → PixiJS via `@pixi/react` v8.** PixiJS is THE standard for web-based slot
  rendering (GPU/WebGL; official slot example; `pixi-reels` MIT lib has `setAnticipation()`/`slamStop()` —
  the exact "juice"). `@pixi/react` v8 ("the best way to write PixiJS in React", supports React 19 + Pixi
  v8) drops a Pixi canvas inside a React component — habit tracker untouched. Use for Slots, Wheel, Hi-Lo,
  Blackjack, Coin Flip, etc.
- **3D physics games (Plinko, and "lots of parts" Lauren wants) → React-Three-Fiber + rapier.** ALREADY in
  this app (the bead jar `BeadJar3D.jsx` uses it). 3D Plinko with real ball-through-pegs physics = the same
  R3F+rapier stack as the jar. No new engine needed.
- **NOT Unity/Godot** — overkill, fragments the stack, worse web integration. Phaser is fine but Pixi is the
  slot standard.
- **Assets:** generate with local SDXL/Flux → sprite sheets (TexturePacker) → premium animation via **Spine**
  2D skeletal (ships PixiJS/R3F runtimes) for win celebrations, or simpler code tweens / Lottie. (AI
  auto-animation/sprite-sheet gen is still research-grade — generate static art, animate with code/Spine.)
- **Juice that sells it (from the research):** slow the final reel (anticipation), near-miss framing,
  backout easing (overshoot+settle), velocity-driven motion blur, coin showers, screen shake, tight
  audio-sync. `pixi-reels` gives several of these out of the box.
- **Phones later → Capacitor** wraps the same React/Vite app to native iOS/Android + PWA, no rewrite.
  **Heads-up:** Apple rates simulated-gambling apps **17+ even with no real money** — fine, just expect the
  mature rating if it ever ships to the App Store.
- **Recommended first move:** flagship ONE game in the new approach to prove the pipeline — either **3D
  Plinko (R3F+rapier, real physics — Lauren explicitly asked)** or **Slots (PixiJS, max slot-software feel)**.

## Open calls for Lauren
1. **RTP aggressiveness** — recommend ~95% / 5% edge default (high variance on Crash/Plinko/Mines);
   variance + your own all-in greed do the busting, so it feels fair instead of rigged. Want it
   gentler (96–97%, fairer) or more punishing (~90%, faster grind)?
2. **v1 scope to greenlight** — recommend P0 + P1 (skeleton + Coin Flip + Crash) as the first
   shippable slice, then iterate.
3. New **Casino nav icon** art (you generate to spec, like the other icons).
