# My Habit Addiction — Roadmap & Status

_Kawaii casino-psychology habit tracker. React 19 + Vite, Zustand (persist), plain inline CSS. Fonts currently Bunny Snaps + Nunito. Local dev on port 5173 (launcher) / 5175 (preview)._

Last updated: 2026-06-08

---

## ✅ Done so far
- **Game/engagement engine** — variable-ratio reinforcement, pity timer, session warm-up, progressive jackpot, daily login streak, near-miss injection. Distributions verified (slots avg ~125/250/375 coins by tier; bonus ~15% on both wheel & slots; jackpot ~1–2.5%).
- **Adaptive engagement engine (2026-06-08)** — research-grounded per-user learning that reshapes the **timing/feel** of wins (warm-up, peak placement at predicted quit-point, honest near-misses) while the long-run total stays anchored. Verified sum-invariant across engagement profiles. See the engine section below for mechanics, citations & ethical red lines.
- **Vertical slot wins** — 8 paylines (3 rows + 3 columns + 2 diagonals); no economy rebalance (constructed-grid model decouples win frequency from payline count).
- **Two games** — multi-spin tier-scaled slot machine (3/6/9 spins by tier) + wheel; bonus equally likely on both. Coin economy: 1 coin = 1¢ = 2 sec.
- **Full kawaii PNG asset integration** — nav icons (castle/orb/stats/quill/gear), logo, jar, "tap a habit" banner, ornate habit-card rows, slot-machine cabinet, framed sunburst background, popup frames (cash prompt / onboarding / gold-bead).
- **App icon** — browser favicon + macOS Dock icon (the jar-with-face).
- **Cash-in flow** — every habit completion grants a spin: cash in matching beads for a higher tier, OR keep all beads and still play at Tier 1.
- **Background** — framed sunburst scaled up to fill mobile dimensions; no scene behind it.
- **Version control** — git repo initialized in `app/` with recovery checkpoints.
- **Phase 0 complete (2026-06-05):** asset dimension spec locked (`ASSETS.md`); nav icons normalized to 216×216; fonts swapped — **Fredoka** (display) + **Mulish** (body, free Genshin-like sans) replacing Bunny Snaps + Nunito.
- **Recovered** the Home PNG integrations after parallel sessions reverted them; fixed the cash-prompt so keeping a bead still lets you play (Tier 1).

---

## 🗺️ Execution plan — how we tackle it

Two tracks run in parallel: **🎨 You generate** (art/fonts to spec) and **💻 I build** (code).
Phase 0 produces the spec so you can generate art while I build logic — then we wire together.
Each phase ends with a committed, working git checkpoint. Sizes: S = small, M = medium, L = large.

### Phase 0 — Foundation _(do first; unblocks everything, stops the churn)_
- 💻 **Asset dimension spec** — I produce the exact px size for every asset (S)
- 🔤 **Fonts** — I shortlist kawaii display + body fonts → you pick → I install (S)
- 💻 **Icon-size normalization** — every icon exactly equal (S)
- ✅ _Checkpoint: stable sizes + fonts locked._

### Phase 1 — Make it make sense _(I build; runs while you generate Phase 2 art)_
- 💻 **Pin home header** — title (logo) + jar fixed at top, only habit list scrolls (S–M)
- 💻 **Slot payout clarity** — paytable-driven payouts + per-line breakdown + paytable view (M)
- 💻 **Adaptive engagement engine** — refactor luck logic into one tunable module (M–L)
- ✅ _Checkpoint: the game is legible + tuned._

### Phase 2 — Art swap-ins _(🎨 you generate to Phase-0 spec → 💻 I wire)_
- 🎨 new bead PNGs · 🎨 kawaii Wheel asset · 🎨 bank icon
- 💻 wire each in
- ✅ _Checkpoint: final art everywhere._

### Phase 3 — The juice _(biggest reward payoff)_
- 💻 **Audio SFX mapping** — map your downloaded sounds to every event (M)
- 💻 **Coin cascade** — screen-filling coins w/ physics, count = amount won, + clink sound (L)
- 💻 **Bead-fall physics** — beads fall through the opening + stack at the bottom (L)
- ✅ _Checkpoint: maximal audio-visual reward._

### Phase 4 — Bank feature
- 💻 **Bank screen** (view coin / $ / time balances; uses the bank icon)
- 💻 **Spending tracker** (log a purchase → deduct from balance, with history) (M)

### Phase 5 — Future _(separate native effort, parked)_
- 📱 **App blocking** — block TikTok/YouTube when low on coins (needs iOS/Android native)

**What I need from you, by phase:** P0 = pick a font from my shortlist · P2 = generate beads/wheel/bank-icon to the spec · P3 = hand over the casino sound files (point me to the folder).

---

## 🔧 Near-term polish
- [ ] **Icon sizes** — finalize/normalize so every nav + in-app icon is *exactly* the same size (recurring issue; lock it down once).
- [ ] **Asset dimension spec** — lock exact pixel dimensions for EVERY static UI element (labels, boxes, banners, frames, icons) so art is generated once at the correct size instead of iterating live. Authoritative list is in project memory — keep it the source of truth.
- [ ] **Pin the home header** — keep the title (logo) and the jar fixed in place at the top of the Home screen (NOT scrollable). Only the habit list below should scroll. Real mobile-game feel.

---

## 🎰 Slot machine — payout clarity & engagement engine
**Make wins legible (the #1 confusion: "why did I win _that_ amount?").**
Right now `resolveSlotSpin` pre-rolls a total payout via a triangular distribution
(min 10 / mode 40 / max 100), splits it into chunks across paylines, then assigns
reel symbols *cosmetically* — so the symbols and winning lines don't actually
determine the coin amount. That's why payouts feel arbitrary.
- [ ] Move to a **paytable-driven** model: each symbol/combo has a defined coin value, and the amount won = the sum of the actual winning lines.
- [ ] Show **per-line payouts** on the highlighted lines + a running breakdown (e.g. "Row 1 🌸🌸🌸 +30", "Diagonal ⭐⭐⭐ +50") so the total is self-explanatory.
- [ ] Add a viewable **paytable** screen/sheet (what each symbol & line pays).

**✅ Vertical (column) wins (2026-06-07)** — slots now have **8 paylines** (3 rows
+ 3 columns + 2 diagonals). Because the constructed-grid model sets win
frequency/value independently of payline count, adding columns needed **zero
rebalance**: re-sim (8 paylines, 200k/tier) = 129/258/388, 84% hit, 0 phantom.

**✅ Adaptive engagement engine (2026-06-08)** — _research-grounded; reshapes the
TIMING & FEEL of wins, never the total._ Built on a fact-checked literature pass
(20 verified claims; see citations below). The economy stays mathematically
anchored because every operation is a **pure permutation** of the session's
already-rolled spins (verified: per-tier totals identical across new/established/
high-quit profiles — 122/251/380 — with 0 phantom lines).
- ✅ **Per-user learning** (`useStore.engagement`, persisted v10) — EMA-smoothed
  signals: inter-spin rhythm, sitting length (`sessionPlayCountEMA`), return
  cadence, time-of-day histogram, within-session completion rate, play-count phase.
- ✅ **Timing reshape** (`reshapeSessionOrder`, `gameLogic.js`) — warm-up win up
  front (the hook; strongest for **new** users, lighter for experienced ones who
  tolerate leaner schedules), wins spread so zeros never bunch, **peak-end** finish,
  biggest win placed at the personalised peak slot.
- ✅ **Quit-risk response** (`computeQuitRisk`) — when the user is likely to stop
  (at/over their typical sitting length, on a cold streak, or slowing), bias the
  peak **earlier** so the probably-final spin is rewarding — never to trap/chase.
- ✅ **Honest near-misses** (`applyNearMisses`) — some 0-coin losses render as
  "so close!" 2-of-a-kind (motivation lever, Clark et al. 2009); density scales
  with quit-risk. **Coins shown always = coins awarded.**

**🚫 Deliberately NOT built (ethical red lines from the same research):**
- ❌ **Losses-disguised-as-wins** — celebrating a net loss as a win causally
  distorts a player's sense of their real economy (Dixon et al. 2010). Refuted
  3-0: "engineer more arousing LDWs to boost reinforcement."
- ❌ **Engineered loss streaks** to exploit the partial-reinforcement extinction
  effect (Horsley 2012) — antithetical to durable positive habits.
- ❌ Anything that changes the long-run total, or makes a session drier than it
  rolled. The engine only ever improves *feel*.

**Citations** (deep-research, 2026-06-08, 5 angles → 26 sources → 20 verified claims):
James, O'Malley & Tunney 2016 (Frontiers in Psych — timing/frequency are the
levers that move engagement at fixed payout); Clark & Zack 2023 (Addictive
Behaviors — uncertainty/VR drives dopamine even for non-monetary rewards);
Horsley et al. 2012 (PREE larger in high-frequency players → scale by engagement);
Clark et al. 2009 (Neuron — near-miss raises motivation, recruits win circuitry);
Dixon/Harrigan/Fugelsang et al. 2010 (Addiction — LDWs & win-miscounting);
Murch & Clark 2016 (The Neuroscientist — the 4-mechanic toolkit + public-health framing).
- _Intentional by design — this app weaponizes casino dopamine loops toward positive
  habit completion (durable RETURN + habit adherence), within hard ethical bounds._

**Parked / future engine work:**
- [ ] Surface the learned profile to the user (transparency) — a gentle "the game
  is learning your rhythm" note in Stats; honesty is itself an ethical guardrail.
- [ ] A/B-test the parameter envelope per-user (warm-up strength, near-miss density)
  — current values are research-informed *starting hypotheses*, not validated for a
  fixed-odds habit app (the literature's numbers come from money-gambling).
- [ ] Optional daily-spins awareness / soft session cap for anti-compulsion (the
  spin is already gated behind a real completed habit — the prosocial anchor).

## 🔤 Fonts
- [ ] Bunny Snaps no longer fits the new aesthetic. Research & choose font(s) that match the glossy kawaii / magical-girl style for editable & dynamic text (habit names, numbers, labels).
  - Need: a **display/heading** font + a **readable body** font.
  - Must be free/licensable for use in the app; digits should render cleanly (Bunny Snaps' numbers were a problem).

---

## 🎨 Art / assets to make
- [ ] **New bead PNGs** — redesign the bead set to match the current aesthetic.
- [ ] **Wheel asset** — a kawaii-style wheel graphic to replace the current SVG/emoji wheel.
- [ ] **Bank icon** — for the new Bank nav tab (see Features).
- [ ] Generate all of the above at the dimensions defined in the asset spec.

---

## ✨ Physics & animation (the "juice")
- [ ] **Beads fall into the jar with real physics** — bead drops, falls *through the jar opening*, and settles/stacks at the bottom in a believable pile (collision + gravity), clipped to the jar interior. Current version is a simple CSS drop + static fill.
- [ ] **Coin cascade on wins** — a screen-filling shower of coins with good physics where the *number of coins* matches the amount won, paired with a clinking sound. This is the core reward moment.
  - **Tech options (decide at build time):**
    1. _2D coin that spins + cascades (recommended)_ — flat coin face PNG (optionally a few rotation frames), spun via CSS 3D flip, light 2D physics (matter.js or hand-rolled gravity). On-aesthetic, fast, safest for the iOS/WKWebView port.
    2. _Flat face on a 3D cylinder_ — map a flat face onto a procedural Three.js cylinder for true spin + physics; no 3D modeling needed. Heavier.
    3. _Full 3D model + physics_ — GLB coin + Rapier/cannon. Most realistic, heaviest, perf risk on phones, needs a modeled/AI-generated GLB.
  - **Perf rule (any approach):** cap the *visible* coins (~60–100) and let the on-screen counter tick to the real amount — never spawn hundreds of bodies on mobile.
  - _Status: asset format parked until we build this (Phase 3); user undecided on 2D vs 3D._

---

## 🔊 Audio — maximize the audio-visual reward
- [ ] Inventory the downloaded casino/game sound effects and map each to an event:
  spin start, reel stop, each line win, tier win, jackpot, bonus, coin tick/clink, bead drop, button taps, milestone reached.
- [ ] Layer/escalate win sounds with tier & jackpot; coin-cascade sound should scale with the amount won.
- [ ] Goal: make wins feel maximally rewarding (slot-machine dopamine loop).

---

## 🏦 New features
- [ ] **Bank screen** (+ bank nav icon) — a place to view and spend earned coins: guilt-free spending balance ($) and time balance.
- [ ] **Spending tracker** — let the user log what they bought / how much guilt-free spending money they used, and deduct it from their balance, with a history log.

---

## 🚀 Future / big ideas

### 📱 App blocking — the killer feature (needs an iOS port)
**The loop:** watching gated apps (TikTok, YouTube) *spends* coins, metered by watch
time → run out of coins → those apps get *blocked* → do more habits to earn coins →
apps unlock. A coin-gated, metered app-blocker. (Apps that already do this: Opal,
one sec, Jomo, Brick.)

**iOS mapping (Apple Screen Time / Family Controls stack):**
- **FamilyControls** — user picks which apps to gate via Apple's `FamilyActivityPicker`
  (privacy-preserving: app choices come back as opaque tokens, not bundle IDs/names).
- **DeviceActivity** — monitors usage of the selected apps; fires a `DeviceActivityMonitor`
  extension at time thresholds → deduct coins per interval of watch time.
- **ManagedSettings** — applies a "shield" to the selected apps (custom block screen
  via a Shield extension) when coins hit 0; remove the shield when balance > 0.

**Port path (keeps the entire current web app):**
1. Wrap this React/Vite app in **Capacitor** → real iOS app in a WKWebView; UI + coin
   economy + `localStorage`/Zustand persistence ship as-is, ~no rewrite.
2. Add a **native Swift blocking module + 2 app extensions** (DeviceActivityMonitor +
   Shield) bridged to the JS.
3. Share the **coin balance via an App Group** (extensions run in a separate process),
   so the monitor/shield can read & deduct it. → _Keep the coin balance centralized in
   the Zustand store now so this bridge stays clean._

**Requirements (when we build it):** paid Apple Developer account ($99/yr) + the
**Family Controls entitlement** (request from Apple; granted for legit wellness/
screen-time apps). Blocking is native Swift work, but well-trodden.

**Keep web-port-friendly now (already doing):** React + localStorage + plain assets,
`viewport-fit=cover`, centralized coin logic. (Android later = UsageStats + Accessibility,
a separate, hackier effort.)

---

## ⚠️ Workflow note (lesson learned)
Running parallel autonomous "fix everything" sessions reverted the PNG asset integrations once already. Going forward:
1. Define the asset + dimension spec FIRST, generate art to spec, then wire once.
2. Commit working checkpoints in git (`app/` repo) before big changes so recovery is instant.
