# 🔊 Sound Spec — My Habit Addiction

**Where to put them:** drop the files in a `sounds` subfolder of *My Habit Addiciton Assets*
(`~/Desktop/My Habit Addiciton Assets/sounds/`). I'll copy them into `app/public/sounds/`
and wire each one in `src/engine/sounds.js`.

**Format:** `.mp3` preferred (small + plays in iOS/WKWebView for the future native port);
`.wav` is fine too. Use the **exact filenames** below (lowercase) and they wire automatically —
if you name them differently, just give me the mapping.

**Don't worry about matching volumes** — I level/normalize everything in code, and there's
already a global volume + mute in Settings. For anything marked **LOOP**, make it seamless
(no click at the loop point). Keep ticks/taps very short.

Currently every sound is *synthesized* in code (Web Audio), so anything you don't provide
just keeps its current placeholder — you can do this in any order, a few at a time.

---

## ⭐ Essential — the core spin loop (do these first)

| filename | plays when | ~length | notes |
|---|---|---|---|
| `slot_spin_start.mp3` | you tap SPIN and the reels launch | 0.4 s | whoosh / lever pull |
| `reel_spin_loop.mp3` | **LOOP** while the reels are spinning | 0.5–1 s | seamless whirr; stops when reels land |
| `reel_stop.mp3` | each reel locks into place | 0.15 s | mechanical clunk; plays 3× per spin (I pitch them slightly) |
| `near_miss.mp3` | the last reel teases a win, then misses | 0.5 s | the "awww" — descending/deflating |
| `line_win.mp3` | a winning payline lights up | 0.3 s | sparkle/ding; I pitch it up for each extra line |
| `coin_tick.mp3` | each coin as the total counts up | 0.05–0.1 s | fires rapidly; keep it tiny |
| `win_small.mp3` | small win flourish (1 line / low total) | 0.8 s | happy little jingle |
| `win_big.mp3` | big win flourish (multi-line / high total) | 1.5–2 s | bigger triumphant jingle |
| `jackpot.mp3` | JACKPOT — the grand moment | 3–5 s | full fanfare, go all out |
| `bonus_trigger.mp3` | triple 🎰 → bonus round | 1–1.5 s | exciting "you unlocked something" |
| `wheel_tick.mp3` | a wheel segment passes the pointer | 0.03 s | fires rapidly, auto-slows as the wheel slows |
| `bead_draw.mp3` | complete a habit → draw a bead | 0.4 s | pleasant pop/chime (the core reward "yes!") |
| `button_tap.mp3` | any button press | 0.05 s | soft, kawaii |

## 💖 Nice to have — rounds it out

| filename | plays when | ~length | notes |
|---|---|---|---|
| `tease_build.mp3` | last reel slows while 2 already match | 0.8–1.5 s | rising tension before the near-miss/win |
| `bead_gold.mp3` | rare GOLD bead drawn | 0.8 s | sparkly, clearly special |
| `cash_in.mp3` | cash in matching beads for a tier | 0.6 s | satisfying combine/shuffle |
| `tier_up.mp3` | you unlock a higher tier (T2/T3) | 1 s | rising, triumphant |
| `bonus_win.mp3` | the bonus wheel lands on a prize | 1 s | celebratory |
| `spend.mp3` | cash out coins for a treat (Spend tab) | 0.6 s | cash-register / ka-ching |
| `daily_bonus.mp3` | daily login streak bonus claimed | 1 s | warm "welcome back" |
| `confirm.mp3` | save / confirm (e.g. new habit) | 0.3 s | gentle affirmative |
| `error.mp3` | invalid / not enough coins | 0.3 s | soft, not harsh |

## 🪙 Coin cascade (ships with the screen-filling coin animation)

| filename | plays when | ~length | notes |
|---|---|---|---|
| `coin_cascade.mp3` | the screen fills with coins on a win | 2–3 s (or **LOOP**) | layered coin shower |
| `coin_clink.mp3` | a single coin bounces/lands (physics) | 0.08 s | short metallic clink; I pitch-vary per coin |

## 🔮 Future — FOMO / pressure mechanics (lowest priority)

| filename | plays when | ~length | notes |
|---|---|---|---|
| `jackpot_climb.mp3` | the jackpot pool ticks up | 0.1 s | subtle, optional |
| `mystery_reveal.mp3` | a surprise mystery reward opens | 1 s | "what did I get?!" |
| `multiplier.mp3` | a limited-time coin multiplier activates | 0.8 s | energizing |
| `milestone.mp3` | a jar / streak milestone is reached | 1.2 s | proud, rewarding |

---

### Reuse notes (so you don't have to make duplicates)
- The **wheel** uses `slot_spin_start` to launch and `win_small`/`win_big`/`jackpot` for results.
- The **bonus wheel** uses `wheel_tick` while spinning.
- `nav_tap` / modal sounds can reuse `button_tap` — no separate files needed unless you want them.

### Minimum to make it feel alive
If you only do a handful first: `slot_spin_start`, `reel_stop`, `near_miss`, `coin_tick`,
`win_big`, `jackpot`, `bead_draw`, `button_tap`. That covers ~90% of what you'll hear.

---

## 🎚️ Casino win-sound tiering — AS BUILT (2026-06-17)

The casino games share **one 4-tier win-sound spectrum** so the loud, climactic sound is reserved for
genuinely rare wins. Earlier every win fired the big crowd-cheer, which felt cheap/inappropriate on
ordinary wins — this fixes that. Wiring lives in `src/engine/sounds.js` (`WIN_FILE` map) and
`src/engine/audio.js` (`MANIFEST` → real files in `public/sounds/`, sourced from
`~/Desktop/My Habit Addiciton Assets/Sound Effects/`).

| tier key | file (audio.js) | feel | used for |
|---|---|---|---|
| `t1` | `winSmall` | quick happy ding | the common, everyday win |
| `t2` | `winMedium` (`win-medium-chimes.wav`) | brighter chime run | a solid above-average win |
| `t3` | `winLarge` (`win-large-casino.wav`) | rich casino flourish | a big win |
| `jackpot` | `jackpot` (crowd cheer) | full fanfare + cheer | **rare top-end wins ONLY** |
| `bonus` | `bonus` | "you unlocked something" | bonus/feature triggers |

**Each game calls `playWin(tier)` with thresholds chosen for ITS payout curve** (a 2× in Plinko ≠ a 2× in
Crash). Per-game rules as shipped:
- **Slots** — `mult ≥ 600 → jackpot · ≥ 130 → t3 · ≥ 40 → t2 · else t1` (💎 line / 7️⃣7️⃣7️⃣ hit the top).
- **Crash / Limbo / Mines / Penguin-Cross** — `≥ 10× → jackpot · ≥ 5× → t3 · ≥ 2× → t2 · else t1` (cashing
  out high / surviving deep is the jackpot moment).
- **Coin Flip** — `≥ 16× pot → jackpot`, else scaled t1–t3.
- **Hi-Lo** — `≥ 10× pot → jackpot`, else scaled.
- **Plinko** — `mult ≥ 2.5 → t3 · ≥ 1.8 → t2 · else t1` (no jackpot — ceiling is low).
- **Blackjack** — `mult ≥ 2.5 (i.e. a natural) → t2 · else t1` (no jackpot — even-money game).
- **Fortune Wheel** — unchanged (its own segment-based result sounds).

**Rule of thumb when adding/retuning a game:** map `jackpot` to roughly the top ~1–2% of outcomes only;
everything routine should be `t1`, with `t2`/`t3` for the satisfying-but-not-rare middle.

---

## 🎶 Background music — AS BUILT (2026-06-20)

A looping kawaii-pop track plays softly under the whole app. It is a **completely separate system**
from the SFX above — different volume, different engine.

- **File:** `public/music/bg-kawaii-pop.mp3` (source: `~/Desktop/My Habit Addiciton Assets/Background Music/`).
  To swap the song, drop a new mp3 in `public/music/` and update `SRC` in `src/engine/music.js`.
- **Engine:** `src/engine/music.js` — a single looping **`HTMLAudioElement`** (streamed, NOT decoded into a
  Web Audio buffer like the SFX; a multi-minute song would be wasteful to hold decoded). `App.jsx`'s
  `<MusicController/>` watches the audio settings and calls `setMusicConfig()` on every change.
- **Settings** (in the SOUND panel): a **🎵 Music on/off** toggle (`settings.musicEnabled`, default on) and a
  **MUSIC VOLUME** slider (`settings.musicVolume`, **default 0.2 = intentionally low** so it sits under SFX).
  The track is hot, so `music.js` also applies a **`MUSIC_GAIN = 0.55` master ceiling** — actual element
  volume = `musicVolume * MUSIC_GAIN` (slider 20% ≈ 0.11, slider 100% ≈ 0.55, never full blast). The music
  toggle button reads **MUTE / UNMUTE** to match the master Sound mute.
  The **SOUND EFFECTS** slider drives only SFX (`settings.volume`); the two are independent.
- **MUTE is a master switch** — `settings.muted` silences BOTH music and SFX. While muted the panel dims its
  level controls and the music row reads "🔇 Muted" (so it never shows "Music on" during silence).
- **Autoplay:** browsers block audio until the user interacts, so music starts on the **first tap** (the
  warning-splash dismiss usually does it). Persisted at store **version 18**.
