# My Habit Addiction — Roadmap & Status

_Kawaii casino-psychology habit tracker. React 19 + Vite, Zustand (persist), plain inline CSS. Fonts currently Bunny Snaps + Nunito. Local dev on port 5173 (launcher) / 5175 (preview)._

Last updated: 2026-06-05

---

## ✅ Done so far
- **Game/engagement engine** — variable-ratio reinforcement, pity timer, session warm-up, progressive jackpot, daily login streak, near-miss injection. Distributions verified (slots avg ~125/250/375 coins by tier; bonus ~15% on both wheel & slots; jackpot ~1–2.5%).
- **Two games** — multi-spin tier-scaled slot machine (3/6/9 spins by tier) + wheel; bonus equally likely on both. Coin economy: 1 coin = 1¢ = 2 sec.
- **Full kawaii PNG asset integration** — nav icons (castle/orb/stats/quill/gear), logo, jar, "tap a habit" banner, ornate habit-card rows, slot-machine cabinet, framed sunburst background, popup frames (cash prompt / onboarding / gold-bead).
- **App icon** — browser favicon + macOS Dock icon (the jar-with-face).
- **Cash-in flow** — every habit completion grants a spin: cash in matching beads for a higher tier, OR keep all beads and still play at Tier 1.
- **Background** — framed sunburst scaled up to fill mobile dimensions; no scene behind it.
- **Version control** — git repo initialized in `app/` with recovery checkpoints.

---

## 🔧 Near-term polish
- [ ] **Icon sizes** — finalize/normalize so every nav + in-app icon is *exactly* the same size (recurring issue; lock it down once).
- [ ] **Asset dimension spec** — lock exact pixel dimensions for EVERY static UI element (labels, boxes, banners, frames, icons) so art is generated once at the correct size instead of iterating live. Authoritative list is in project memory — keep it the source of truth.
- [ ] **Pin the home header** — keep the title (logo) and the jar fixed in place at the top of the Home screen (NOT scrollable). Only the habit list below should scroll. Real mobile-game feel.

---

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
- [ ] **App blocking** — block distracting apps (TikTok, YouTube, etc.) on the phone when the user doesn't have enough coins. Requires native mobile integration (iOS Screen Time / Family Controls API, Android Accessibility/UsageStats) — well beyond the current web app; likely a native app or companion down the line.

---

## ⚠️ Workflow note (lesson learned)
Running parallel autonomous "fix everything" sessions reverted the PNG asset integrations once already. Going forward:
1. Define the asset + dimension spec FIRST, generate art to spec, then wire once.
2. Commit working checkpoints in git (`app/` repo) before big changes so recovery is instant.
