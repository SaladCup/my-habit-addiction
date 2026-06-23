// ─────────────────────────────────────────────────────────────────────────────
// HABIT-CHAN'S LINES — every word she says lives HERE, in one place.
// This is PLACEHOLDER copy in your style; rewrite it in your own voice anytime —
// it's all in this one file, so it's a find-and-edit, never a code hunt.
//
// Each beat: { pose, text }
//   pose = a filename in /public/habitchan/<pose>.png  (happy, talking, point,
//          serious, sinister, evil, coin, celebrate, laughing, surprised,
//          worried, sad, flying, sitting, talking-open)
//   text = one line she says (the box types it out, advances on tap)
// ─────────────────────────────────────────────────────────────────────────────

export const ONBOARDING_INTRO = [
  { pose: 'happy',     text: "Hi hi! I'm Habit-Chan — fairy princess of actually-doing-the-thing. ✨" },
  { pose: 'talking',   text: "Welcome to your kingdom! It's a habit tracker… wearing a slot machine as a disguise." },
  { pose: 'sinister',  text: "Every sneaky little trick a casino uses to keep you hooked? We stole all of them. 😈" },
  { pose: 'point',     text: "But here's the twist — I point them at YOUR habits. You get hooked on showing up." },
  { pose: 'coin',      text: "Do a habit → spin the wheel → win beads and coins. Real effort, sparkly payoff." },
  { pose: 'talking',   text: "Fill your jar with beads, hit milestones, and cash coins in for real-life treats you choose." },
  { pose: 'celebrate', text: "Okayyy — enough chit-chat! Let's make your very first habit together. 💖" },
]

// Bottom-nav coach-mark tour. Each step spotlights a real nav icon (matched by
// data-tour="<target>" on the NavLink) and Habit-Chan explains it. `icon` is the
// art to lift + enlarge over the dimmed bar.
export const NAV_TOUR = [
  { target: 'home',     icon: '/ui/icon_home.png',     pose: 'happy',    text: "Home base 🏠 — your jar, your beads, your daily check-in. You'll live here." },
  { target: 'casino',   icon: '/ui/icon_casino.png',   pose: 'sinister', text: "The Casino 🎰 — 100% optional! Bet your coins for a shot at way more… or lose the lot. Feeling lucky? 😈" },
  { target: 'spend',    icon: '/ui/icon_spend.png',    pose: 'coin',     text: "Spend 💖 — cash coins in for real-life treats YOU choose. This is the whole point." },
  { target: 'stats',    icon: '/ui/icon_stats.png',    pose: 'point',    text: "Stats 📈 — receipts. Proof you're actually doing the thing. Brag fuel." },
  { target: 'habits',   icon: '/ui/icon_editor.png',   pose: 'talking',  text: "Habits ✨ — where your habits live. We're about to make your very first one." },
  { target: 'settings', icon: '/ui/icon_settings.png', pose: 'laughing', text: "Settings ⚙️ — tweak everything. Yes, including muting my fabulous theme song. 🎵" },
]

// Per-pose fit data so every expression renders at a CONSISTENT character size with
// her feet on the same baseline (the PNGs were each drawn at slightly different
// scale/offset). Measured from the art via canvas:
//   fillH = the character's substantial height as a fraction of the canvas (skips thin
//           raised arms); feet = transparent padding below her feet, as a fraction.
// HabitChanSprite renders img height = charVh / fillH and drops it by feet so she's
// uniform. Re-measure + update if the art is regenerated.
export const POSE_FIT = {
  happy:          { fillH: 0.911, feet: 0.007 },
  talking:        { fillH: 0.720, feet: 0.095 },
  'talking-open': { fillH: 0.721, feet: 0.094 },
  point:          { fillH: 0.734, feet: 0.035 },
  serious:        { fillH: 0.720, feet: 0.075 },
  sinister:       { fillH: 0.810, feet: 0.032 },
  evil:           { fillH: 0.810, feet: 0.032 },
  coin:           { fillH: 0.935, feet: 0.006 },
  celebrate:      { fillH: 0.818, feet: 0.050 },
  laughing:       { fillH: 0.796, feet: 0.042 },
  surprised:      { fillH: 0.796, feet: 0.020 },
  worried:        { fillH: 0.796, feet: 0.020 },
  sad:            { fillH: 0.804, feet: 0.031 },
  flying:         { fillH: 0.628, feet: 0.223 },
  sitting:        { fillH: 0.725, feet: 0.070 },
}

// ── First-visit pop-ins (one per tab, shown once) ──
export const FIRST_VISIT_CASINO = [
  { pose: 'sinister', text: "Oh, you found the Casino. 😈 One disclaimer: this is 100% optional." },
  { pose: 'coin',     text: "Bet your habit coins here for a shot at way, WAY more. Or lose the lot. No safety net." },
  { pose: 'laughing', text: "The house edge is real. But so is hitting jackpot on a lucky night. Good luck, gambler. 🎰" },
]

export const FIRST_VISIT_SPEND = [
  { pose: 'celebrate', text: "Welcome to SPEND — this is the whole point! 💖" },
  { pose: 'coin',      text: "All those coins you earned? Cash them in for real-life treats YOU chose. Sushi? A nap? A new game? You decide." },
  { pose: 'happy',     text: "No grind is pointless when there's a reward at the end. Set up your treats in Settings → Milestones. 🌸" },
]

export const FIRST_VISIT_ROTBLOCK = [
  { pose: 'serious',  text: "RotBlock. This is where you put the apps eating your brain." },
  { pose: 'point',    text: "Add your Brainrots — every minute using them drains your coins. Hit zero and they're BLOCKED." },
  { pose: 'sinister', text: "Do a habit to earn coins back. It's a leash on your worst habits, funded by your best ones. 😈" },
]

export const FIRST_VISIT_SETTINGS = [
  { pose: 'talking', text: "Settings! Here's where you make the app actually yours." },
  { pose: 'point',   text: "Set what your coins are worth — real money, or free-time minutes. Then it HURTS to waste them." },
  { pose: 'happy',   text: "Milestones are the big one: set a reward (like 'sushi night') for hitting a jar count, and watch the jar fill toward it. 🌟" },
]

// ── Reactive moments (brief 2-panel surprises, not first-visit gates) ──

export const REACTION_GOLD_BEAD = [
  { pose: 'surprised', text: "WAIT— is that a GOLD BEAD?! 😱 That's like a 1-in-20 pull!!" },
  { pose: 'coin',      text: "Straight to Tier 3, baby. The universe is cheering for you. ✨ Lucky!!" },
]

export const REACTION_JACKPOT = [
  { pose: 'laughing',  text: "JACKPOT!! 💎💎💎 Do you understand how rare that ACTUALLY is?!" },
  { pose: 'celebrate', text: "You literally just won the lottery of your own habit tracker. Screenshot this. Show people. I'm AMAZED." },
]

export const REACTION_STREAK_BREAK = [
  { pose: 'sad',      text: "Nooo… your streak… 💔 It was so beautiful." },
  { pose: 'sinister', text: "…but also? This is how addiction WORKS. You'll be back. They always come back. 😌" },
]

// Reusable elsewhere later (RotBlock setup, tips, the bonus walkthrough, etc.).
export default { ONBOARDING_INTRO, NAV_TOUR, POSE_FIT }
