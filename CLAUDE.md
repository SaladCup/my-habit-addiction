# My Habit Addiction — project guide

Kawaii casino-psychology habit tracker: complete a habit → earn a bead → spin a
slot machine / wheel → win coins (redeemable as guilt-free spending money & time).
Weaponizes casino dopamine loops toward *positive* habits.

**Companion docs:** [`ROADMAP.md`](./ROADMAP.md) (status + phased plan) · [`ASSETS.md`](./ASSETS.md) (exact asset dimensions — source of truth).

---

## Tech stack
- **React 19 + Vite** (this repo lives in `app/`).
- **Zustand** with `persist` (localStorage key `my-habit-addiction`, version 5 + migrations).
- **React Router** (BrowserRouter), 8 routes.
- Plain **inline-style CSS** (no CSS modules). Design tokens in `src/styles/tokens.css`, globals in `src/styles/global.css`.
- **Fonts:** Fredoka (display/headings/labels) + Mulish (body) via Google Fonts `<link>` in `index.html`. Tokens: `--font-pixel` (=Fredoka), `--font-body` (=Mulish). _Bunny Snaps + Nunito were removed._
- **Recharts** (stats), **canvas-confetti** (wins).
- Run: `npm run dev` (port 5173 via the launcher, 5175 in Claude Preview). `npm run build` to verify.

## File map (src/)
- `App.jsx` — router shell + bottom nav (5 PNG icons; active = glow only, no scale).
- `store/useStore.js` — all state + actions (habits, categories, wallet, jarBeads, coinLog, milestones, jackpotPool, spinStats, daily, settings) and the engagement engine helpers.
- `engine/gameLogic.js` — pure game math: outcome weights, `getAdjustedWeights` (luck/pity/warmup/jackpot-due), slots (`resolveSlotSession`/`resolveSlotSpin`), wheel, bonus wheel, paylines, coin tables.
- `engine/sounds.js` — SFX hooks. `engine/probability.js` — RNG helpers.
- `screens/` — HomeScreen, SpinScreen, BonusScreen, RewardScreen, WalletScreen, StatsScreen, EditorScreen, SettingsScreen.
- `components/` — SlotMachine, Wheel, BonusWheel, ui/ (KawaiiButton, BeadDisplay, PixelPanel, TierBadge, TimerDisplay, WarningSplash, FloatingDecor, NearMissOverlay).

## Art / asset pipeline
- Source art → `~/Desktop/My Habit Addiciton Assets/` (note the typo "Addiciton" in the folder name).
- Raw masters copied to `public/ui/_src_*.png`; web-sized working copies are the non-`_src` files in `public/ui/`.
- Prep = PIL (Python): edge flood-fill to drop white bg (preserving interior whites), trim, LANCZOS resize. Slot/cabinet coords measured via dark-pixel projection.
- **Every asset size is defined in `ASSETS.md`. Generate to spec, then wire once.**
- Framed popups use the art at **native aspect** (`aspectRatio` + `background:url(...) center/100% 100%`), content in an absolute padded interior — **never** stretch frames via border-image (distorts the edge decoration). Exception: `habit_card` uses border-image (flat middle, fixed rose end-caps).
- Cache-bust nav icon `<img src>` with `?v=N` (bump `ICON_V` in App.jsx) when re-exporting — public files keep their names so browsers cache them.

## Core game flow
1. Tap a habit → `drawBead` (1/7 gold; else slot 1–6) → bead drops into wallet.
2. **CashPrompt:** _Cash In & Spin — Tier N_ (spend matching beads → higher tier) **or** _Keep Beads & Spin (Tier 1)_ (keep beads, still play). Both always lead to a spin. Gold bead → auto Tier-3 celebration.
3. **SpinScreen:** pick Wheel (1 spin) or Slots (3/6/9 spins by tier). Daily login streak bonus on mount.
4. Win coins → RewardScreen (count-up + confetti). Bonus result → BonusScreen (bonus wheel + challenge → bead). Cashed beads move to the jar (toward milestones).
- Coin economy: 1 coin = $0.01 = 2 sec. `COIN_SCALE=25`.

## Conventions / gotchas
- Inside a `<form>`, raw `<button>` needs `type="button"` (KawaiiButton forwards `type`) — else it submits.
- Bead PNGs are `bead-1..6` + `bead-gold` (NO `bead-0`); slots are 1-indexed.
- Don't let `claimDailyBonus` (runs on SpinScreen mount, adds to `session.coinsEarned`) inflate a spin's reward — set `coinsEarned` explicitly on the spin result.
- Popups must render above the bottom nav: don't give `.screen` a z-index/stacking context that traps `position:fixed` children below the nav.

## ⚠️ Workflow rules (learned the hard way)
1. **Spec art first** (`ASSETS.md`), generate to spec, wire once — don't iterate sizes live.
2. **Commit a working git checkpoint before big changes** (repo is here in `app/`).
3. **Don't revert the PNG asset integrations.** Parallel autonomous sessions once rewrote HomeScreen back to CSS/SVG/text — if a screen looks "plain," check git history and re-wire from the assets in `public/ui/` (they're never deleted).
