# My Habit Addiction — project guide

Kawaii casino-psychology habit tracker: complete a habit → earn a bead → spin a
slot machine / wheel → win coins (redeemable as guilt-free spending money & time).
Weaponizes casino dopamine loops toward *positive* habits. There's also a full
**Casino tab** (10 play-money bet games) that spends/wins the same coins.

**Companion docs:** [`ROADMAP.md`](./ROADMAP.md) (status + phased plan) · [`CASINO_PLAN.md`](./CASINO_PLAN.md) (the 10-game casino: economy, RTPs, win-sound tiering, open items) · [`SOUNDS.md`](./SOUNDS.md) (sound spec + as-built win-sound tiers) · [`ASSETS.md`](./ASSETS.md) (exact asset dimensions — source of truth).

---

## Tech stack
- **React 19 + Vite** (this repo lives in `app/`).
- **Zustand** with `persist` (localStorage key `my-habit-addiction`, **version 18** + migrations).
- **React Router** (BrowserRouter); habit-loop routes + the Casino routes.
- Plain **inline-style CSS** (no CSS modules). Design tokens in `src/styles/tokens.css`, globals in `src/styles/global.css`.
- **Fonts:** Fredoka (display/headings/labels) + Mulish (body) via Google Fonts `<link>` in `index.html`. Tokens: `--font-pixel` (=Fredoka), `--font-body` (=Mulish). _Bunny Snaps + Nunito were removed._
- **Recharts** (stats), **canvas-confetti** (wins).
- **PixiJS** (`@pixi/react` v8 + `pixi.js@8`) — slot reels (`SlotsPixi.jsx`). **R3F + rapier** (`@react-three/fiber` + `@react-three/rapier`) — the 3D jar AND 3D Plinko physics. ⚠️ R3F does NOT render in a hidden/preview tab; Pixi renders its first frame in preview.
- **Run / serve:** canonical port is **5175**. For active dev/HMR use `npm run dev` (Claude Preview, or Terminal). Lauren's installed app is a **static build served by a LaunchAgent** — the Vite dev server won't run under launchd. **After ANY code change she needs to see in the installed app: `npm run build && rm -rf ~/.habit-app/dist && cp -R dist ~/.habit-app/dist`.** Full setup in project memory `project-habit-launcher`. `npm run build` also verifies; keep **eslint at 0**.

## File map (src/)
- `App.jsx` — router shell + bottom nav (5 PNG icons; active = glow only, no scale).
- `store/useStore.js` — all state + actions (habits, categories, wallet, jarBeads, coinLog, milestones, jackpotPool, spinStats, **engagement**, **gambling**, daily, settings) and the engagement-engine helpers. `engagement` = the LEARNED per-user profile (EMA rhythm / sitting length / return cadence / completion rate / time-of-day); `getEngagementProfile()` + `getQuitRisk()` feed the adaptive slot engine. Persist **v18**.
- `engine/gameLogic.js` — pure game math: outcome weights, `getAdjustedWeights` (luck/pity/warmup/jackpot-due), slots (`resolveSlotSession`/`resolveSlotSpin`), wheel, bonus wheel, **8 paylines** (3 rows + 3 cols + 2 diagonals), coin tables. **Adaptive engine** (`getSlotEngineParams`/`computeQuitRisk`/`reshapeSessionOrder`/`applyNearMisses`): reshapes the TIMING & FEEL of a session's spins per user — pure PERMUTATION, so the long-run total is unchanged (verified sum-invariant across profiles). Hard rules: coins shown = coins awarded; no losses-disguised-as-wins; no engineered loss streaks. Citations in ROADMAP.
- `engine/casino/*` — the 10 casino games' pure engines (Coin Flip, Crash, Penguin-Cross, Mines, Plinko, Hi-Lo, Limbo, Blackjack, Slots, Fortune Wheel), each stress-tested for its RTP. `components/plinkoBoard.js` = shared Plinko geometry; `scripts/bake-plinko.mjs` = headless bake of `BUCKET_MULTS`.
- **Casino economy (HARD RULE):** `placeBet`/`settleBet` route through `spendCoins`/`awardCoins` tagged **`casino:<game>`** — NEVER add a new coinLog type (the balance is rebuilt from the log on reload, so a new type silently breaks it). `gambling:{wagered,won}` is **display-only** stats.
- `engine/sounds.js` — SFX hooks + the 4-tier casino `WIN_FILE` map (`t1/t2/t3/jackpot/bonus`; see SOUNDS.md). `engine/audio.js` — SFX file MANIFEST + Web Audio player. `engine/probability.js` — RNG helpers.
- **Audio model — TWO independent systems:** (1) **SFX** = `engine/audio.js` (Web Audio, decoded buffers) + `engine/sounds.js` (synth fallbacks); volume = `settings.volume`. (2) **Background music** = `engine/music.js`, a single looping `HTMLAudioElement` streaming `public/music/bg-kawaii-pop.mp3`; volume = `settings.musicVolume` (default **0.2**, low), on/off = `settings.musicEnabled`. `App.jsx`'s `<MusicController/>` subscribes to those settings + `muted` and pushes them via `setMusicConfig()`. **`settings.muted` is a MASTER mute** — it silences BOTH systems; the Settings SOUND panel dims its level controls + shows "🔇 Muted" while muted so the UI isn't contradictory. Browsers block autoplay until a gesture, so music.js arms a one-shot pointer/key/touch listener and starts on the first tap.
- `screens/` — HomeScreen, SpinScreen, BonusScreen, RewardScreen, WalletScreen, StatsScreen, EditorScreen, SettingsScreen + **`screens/casino/*`** (one screen per game + the casino lobby).
- `components/` — SlotMachine (real-art cabinet, used by SpinScreen), **SlotsPixi** (code-drawn casino-Slots cabinet — _pending migration to reuse SlotMachine, see CASINO_PLAN_), **Plinko3D** (R3F), Jar3D, Wheel, BonusWheel, ui/ (KawaiiButton, BeadDisplay, PixelPanel, TierBadge, TimerDisplay, WarningSplash, FloatingDecor, NearMissOverlay).
- **StrictMode `aliveRef` gotcha:** an `aliveRef` must be set `true` on effect setup AND `false` on cleanup. The common `useEffect(() => () => { ref.current = false }, [])` is BROKEN — dev double-mount runs the cleanup once and never re-sets true, freezing rAF/`setTimeout` loops.

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
- Don't let the daily streak bonus (`checkInStreak`, runs in `StreakPopup` on app open and adds to `session.coinsEarned` via `awardCoins`) inflate a spin's reward — SpinScreen sets `coinsEarned` explicitly on the spin result.
- Popups must render above the bottom nav: don't give `.screen` a z-index/stacking context that traps `position:fixed` children below the nav.

## ⚠️ Workflow rules (learned the hard way)
1. **Spec art first** (`ASSETS.md`), generate to spec, wire once — don't iterate sizes live.
2. **Commit a working git checkpoint before big changes** (repo is here in `app/`).
3. **Don't revert the PNG asset integrations.** Parallel autonomous sessions once rewrote HomeScreen back to CSS/SVG/text — if a screen looks "plain," check git history and re-wire from the assets in `public/ui/` (they're never deleted).
