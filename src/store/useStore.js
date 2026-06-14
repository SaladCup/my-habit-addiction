import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import {
  resolveWheelSpin, resolveSlotSession, isGoodResult, TIER_COINS, COIN_SCALE,
  computeQuitRisk, determineTier,
} from '../engine/gameLogic'

// ── Progressive jackpot tuning (scaled to COIN_SCALE) ──
const JACKPOT_SEED      = 80 * COIN_SCALE   // 2,000 — pool starts here & resets here after a jackpot
const JACKPOT_PER_SPIN  = 2 * COIN_SCALE    // 50/spin — slow progressive build the more you play
const SESSION_GAP_MS    = 30 * 60 * 1000  // >30min idle starts a fresh "session" (warm-up)
const COIN_LOG_MAX      = 500             // log is a recent-history view; totals live in coinTotals

const DEFAULT_SPIN_STATS = {
  totalSpins: 0,
  sessionSpins: 0,
  spinsSinceGood: 0,
  spinsSinceJackpot: 0,
  lossStreak: 0,
  lastSpinAt: 0,
}

// ── Adaptive engagement profile (LEARNED per-user, persisted) ──
// These signals let the slot engine reshape the TIMING/feel of wins for this
// specific user (warm-up strength, where the peak lands, near-miss density) while
// the long-run total stays fixed. All EMAs are exponentially-smoothed so the
// engine tracks the user's CURRENT rhythm and forgets stale behaviour.
const DEFAULT_ENGAGEMENT = {
  interSpinGapEMA:     0,   // ms — typical gap between cash-ins within a sitting (rhythm)
  sessionPlayCountEMA: 0,   // typical # cash-ins per active sitting (predicts quit point)
  returnGapEMA:        0,   // ms — typical gap between sittings (return cadence / churn)
  curSessionPlays:     0,   // cash-ins so far in the current sitting
  lastSessionStartAt:  0,   // when the current sitting began
  lastGap:             0,   // ms — most recent inter-cash-in gap
  playCount:           0,   // total cash-ins the engine has observed (engagement phase)
  startedSessions:     0,   // slot sessions begun     ┐ completion rate = within-session
  completedSessions:   0,   // slot sessions finished  ┘ engagement signal
  todBuckets:          [0, 0, 0, 0],  // plays by time-of-day: night/morning/afternoon/evening
}

const EMA_ALPHA = 0.25                                   // smoothing for all engagement EMAs
const ema = (prev, x) => (prev > 0 ? prev * (1 - EMA_ALPHA) + x * EMA_ALPHA : x)
const todBucket = (ts) => Math.floor((new Date(ts).getHours() % 24) / 6)  // 0..3

// ── 30-color kawaii palette ──
export const KAWAII_COLORS = [
  { hex: '#FFB7C5', name: 'Rose Quartz' },
  { hex: '#FF85A1', name: 'Hot Pink' },
  { hex: '#FF6B9D', name: 'Raspberry' },
  { hex: '#FFAED6', name: 'Bubblegum' },
  { hex: '#F7C5D5', name: 'Blush' },
  { hex: '#C8B4E0', name: 'Lavender' },
  { hex: '#B39DDB', name: 'Wisteria' },
  { hex: '#9B7EC8', name: 'Violet' },
  { hex: '#C44BF5', name: 'Grape' },
  { hex: '#E8B4F8', name: 'Lilac' },
  { hex: '#B4D4FF', name: 'Sky' },
  { hex: '#85C1E9', name: 'Cornflower' },
  { hex: '#4BC5F5', name: 'Aqua' },
  { hex: '#A8DADC', name: 'Powder' },
  { hex: '#D6EAF8', name: 'Ice' },
  { hex: '#B4E0C8', name: 'Sage' },
  { hex: '#4BF5A0', name: 'Spearmint' },
  { hex: '#A8E6CF', name: 'Seafoam' },
  { hex: '#C8F5B4', name: 'Pistachio' },
  { hex: '#F0FFF4', name: 'Honeydew' },
  { hex: '#FFE9A0', name: 'Butter' },
  { hex: '#F5C44B', name: 'Honey' },
  { hex: '#FFD700', name: 'Goldie' },
  { hex: '#FFEAA7', name: 'Lemon' },
  { hex: '#FFF3CD', name: 'Cream' },
  { hex: '#F54B4B', name: 'Cherry' },
  { hex: '#FF7675', name: 'Coral' },
  { hex: '#FAB1A0', name: 'Peach' },
  { hex: '#FDCB6E', name: 'Apricot' },
  { hex: '#E17055', name: 'Terracotta' },
]

// Colors + names match the actual bead PNG art (public/beads/bead-1..6),
// sampled from the marble art so the glow halo, medallion & label all agree.
const DEFAULT_BEAD_SLOTS = [
  { slot: 1, color: '#FBB3CF', name: 'Rose Quartz' },
  { slot: 2, color: '#BC93F2', name: 'Orchid' },   // bluer purple — was pink-adjacent
  { slot: 3, color: '#7FBCF2', name: 'Sky' },      // a touch deeper/saturated
  { slot: 4, color: '#87E0BA', name: 'Mint' },     // a touch deeper/saturated
  { slot: 5, color: '#FCB8A3', name: 'Coral' },
  // Rainbow = WILD CARD: matches with any slot when cashing in (see gameLogic
  // determineTier/isCashable). color is a representative swatch for UI chips;
  // real rendering is the rainbow PNG / rainbow 3D material.
  { slot: 6, color: '#E5C0F5', name: 'Rainbow', rainbow: true },
]

// Every bead — habit-drawn OR bonus-won — is built here, so per-slot flags like
// `rainbow` (wild card) can never drift between the two paths again.
function rollBead(beadSlots, habitId) {
  // Uniform 1/7 chance: slots 1-6 + gold
  const isGold = Math.random() < (1 / 7)
  const slot = isGold ? null : (Math.floor(Math.random() * 6) + 1)
  // beads drawn from a rainbow slot are wild cards (stamped on the bead
  // so wallet/jar history keeps the flag even if slots are re-themed)
  const isRainbow = !isGold && !!beadSlots.find(s => s.slot === slot)?.rainbow
  return { id: uuid(), slot, isGold, isRainbow, habitId, earnedAt: Date.now() }
}

const DEFAULT_SESSION = {
  phase: 'idle',           // idle | habitDone | cashIn | spinning | bonus | reward
  selectedHabit: null,
  drawnBead: null,
  cashedBeads: [],
  activeTier: 1,
  chosenMode: null,        // 'wheel' | 'slots'
  spinResult: null,        // 't1'|'t2'|'t3'|'jackpot'|'bonus'
  isNearMiss: false,
  bonusResult: null,       // '75'|'50'|'25'|'free'
  bonusTimerEnd: null,
  coinsEarned: 0,
  pullsRemaining: 3,
  bestPullResult: null,
  pullHistory: [],
}

const useStore = create(
  persist(
    (set, get) => ({
      // ── Persisted state ──
      habits:     [],
      categories: [],     // { id, name, color }
      wallet:     [],     // { id, slot, isGold, habitId, earnedAt }
      jarBeads:   [],     // { id, slot, isGold, cashedAt, x, y }
      jarSeenCount: 0,    // how many jarBeads have been shown settled in the 3D jar (the rest physics-drop on next view)
      coinLog:    [],     // recent history (capped at COIN_LOG_MAX) — { id, type, amount, source, habitId, note, timestamp }
      coinTotals: { earned: 0, spent: 0 },   // running balance — O(1) reads, never trimmed
      coinLogComplete: true,                 // true while coinLog holds FULL history (so totals can be rebuilt from it)
      milestones: [],

      // ── Engagement systems (persisted) ──
      jackpotPool: JACKPOT_SEED,                 // progressive jackpot, grows as you play
      spinStats:   { ...DEFAULT_SPIN_STATS },    // drives the luck engine
      engagement:  { ...DEFAULT_ENGAGEMENT },    // LEARNED per-user profile (adaptive engine)
      daily:       { lastPlayDate: null, loginStreak: 0, bonusClaimedDate: null },
      settings: {
        beadSlots:      DEFAULT_BEAD_SLOTS,
        moneyPerCoin:   0.01,   // 1 coin = 1¢
        secondsPerCoin: 2,      // 1 coin = 2 sec → T1/T2/T3 ≈ 4/8/12.5 min
        timeActivity:   'free time',
        muted:          false,
        volume:         0.6,
      },

      // ── Ephemeral session (not persisted) ──
      session: { ...DEFAULT_SESSION },
      // Running coin total across a bonus chain (each spin adds; the reward
      // screen shows it crushing up). Transient — resets on a non-bonus reward.
      rewardChain: { prev: 0, total: 0 },

      // ── Computed getters ──
      getTotalCoinsEarned: () => get().coinTotals.earned,
      getTotalCoinsSpent:  () => get().coinTotals.spent,
      getCoinsAvailable:   () => get().coinTotals.earned - get().coinTotals.spent,
      getJarCount: () => get().jarBeads.length,
      getBeadColor: (slot, isGold) => {
        if (isGold) return '#FFD700'
        const found = get().settings.beadSlots.find(s => s.slot === slot)
        return found ? found.color : '#FFB7C5'
      },

      // ── Category actions ──
      addCategory: (cat) => {
        const newCat = { id: uuid(), ...cat }
        set(s => ({ categories: [...s.categories, newCat] }))
        return newCat
      },
      updateCategory: (id, updates) => set(s => ({
        categories: s.categories.map(c => c.id === id ? { ...c, ...updates } : c),
      })),
      deleteCategory: (id) => set(s => ({
        categories: s.categories.filter(c => c.id !== id),
        habits: s.habits.map(h => h.categoryId === id ? { ...h, categoryId: null } : h),
      })),

      // ── Habit actions ──
      addHabit: (habit) => set(s => ({ habits: [...s.habits, { id: uuid(), rewards: { bonusActivity: '' }, ...habit }] })),
      updateHabit: (id, updates) => set(s => ({ habits: s.habits.map(h => h.id === id ? { ...h, ...updates } : h) })),
      deleteHabit: (id) => set(s => ({ habits: s.habits.filter(h => h.id !== id) })),

      // ── Bead actions ──
      drawBead: (habitId) => {
        const bead = rollBead(get().settings.beadSlots, habitId)
        set(s => ({
          wallet: [...s.wallet, bead],
          session: { ...s.session, drawnBead: bead, phase: 'habitDone' },
        }))
        return bead
      },

      cashInBeads: (beads) => {
        // single source of truth (handles gold shortcut + rainbow wild cards)
        const { activeTier } = determineTier(beads)

        // Move beads from wallet to jar
        const beadIds = beads.map(b => b.id)
        const jarBeadsToAdd = beads.map(b => ({
          ...b,
          cashedAt: Date.now(),
          x: 0.1 + Math.random() * 0.8,   // normalized 0-1, physics will refine
          y: 0.5 + Math.random() * 0.4,
        }))

        set(s => ({
          wallet: s.wallet.filter(b => !beadIds.includes(b.id)),
          jarBeads: [...s.jarBeads, ...jarBeadsToAdd],
          session: { ...s.session, cashedBeads: beads, activeTier, phase: 'cashIn' },
        }))
        return activeTier
      },

      addBonusBead: () => {
        const bead = rollBead(get().settings.beadSlots, get().session.selectedHabit?.id || null)
        set(s => ({ wallet: [...s.wallet, bead] }))
        return bead
      },

      // ── Coin actions ──
      // coinTotals is the authoritative balance (O(1) reads); the log is a recent-
      // history view. We update both, and the moment the log overflows the cap and
      // drops an entry we flip coinLogComplete off (the log can no longer rebuild
      // totals). Totals are read with ?? so a missing/half-migrated coinTotals can
      // never crash a spin (that was the v13 regression's blast radius).
      awardCoins: (amount, source, habitId = null) => {
        const event = { id: uuid(), type: 'earned', amount, source, habitId, note: '', timestamp: Date.now() }
        set(s => {
          const log = [...s.coinLog, event]
          const overflow = log.length > COIN_LOG_MAX
          return {
            coinLog: overflow ? log.slice(-COIN_LOG_MAX) : log,
            coinLogComplete: s.coinLogComplete && !overflow,
            coinTotals: { earned: (s.coinTotals?.earned ?? 0) + amount, spent: s.coinTotals?.spent ?? 0 },
            session: { ...s.session, coinsEarned: s.session.coinsEarned + amount },
          }
        })
      },
      spendCoins: (amount, note = '') => {
        const event = { id: uuid(), type: 'spent', amount, source: 'manual', habitId: null, note, timestamp: Date.now() }
        set(s => {
          const log = [...s.coinLog, event]
          const overflow = log.length > COIN_LOG_MAX
          return {
            coinLog: overflow ? log.slice(-COIN_LOG_MAX) : log,
            coinLogComplete: s.coinLogComplete && !overflow,
            coinTotals: { earned: s.coinTotals?.earned ?? 0, spent: (s.coinTotals?.spent ?? 0) + amount },
          }
        })
      },

      // ── Engagement engine: spins, luck, progressive jackpot ──
      getJackpot: () => get().jackpotPool,

      // Snapshot the luck inputs (with idle-gap session detection) BEFORE a spin.
      _luckSnapshot: () => {
        const { spinStats } = get()
        const fresh = Date.now() - spinStats.lastSpinAt > SESSION_GAP_MS
        return {
          sessionSpins: fresh ? 0 : spinStats.sessionSpins,
          spinsSinceGood: spinStats.spinsSinceGood,
          spinsSinceJackpot: spinStats.spinsSinceJackpot,
          lossStreak: spinStats.lossStreak,
        }
      },

      // Update stats + grow/reset the jackpot pool + LEARN the engagement profile.
      // Returns the enriched outcome.
      _finalizeSpin: (outcome) => {
        const now = Date.now()
        const { spinStats, jackpotPool, engagement } = get()
        const fresh = now - spinStats.lastSpinAt > SESSION_GAP_MS
        const newSession = fresh ? 1 : spinStats.sessionSpins + 1
        const good = isGoodResult(outcome.awardedResult)
        const isJackpot = outcome.awardedResult === 'jackpot'

        let pool = jackpotPool + JACKPOT_PER_SPIN
        let coinsAwarded = outcome.coinsAwarded
        let jackpotAward = 0
        if (isJackpot) {
          jackpotAward = pool       // win the whole accumulated pool
          coinsAwarded = pool
          pool = JACKPOT_SEED       // reset
        }

        // ── Learn this user's rhythm / sitting length / return cadence ──
        const lastGap = spinStats.lastSpinAt ? now - spinStats.lastSpinAt : 0
        const e = { ...engagement, lastGap, playCount: engagement.playCount + 1 }
        if (fresh) {
          // A new sitting begins: fold the sitting just ended into the EMAs.
          if (engagement.curSessionPlays > 0) e.sessionPlayCountEMA = ema(engagement.sessionPlayCountEMA, engagement.curSessionPlays)
          if (engagement.lastSessionStartAt)  e.returnGapEMA        = ema(engagement.returnGapEMA, now - engagement.lastSessionStartAt)
          e.curSessionPlays    = 1
          e.lastSessionStartAt = now
        } else {
          if (lastGap > 0) e.interSpinGapEMA = ema(engagement.interSpinGapEMA, lastGap)
          e.curSessionPlays = engagement.curSessionPlays + 1
        }
        e.todBuckets = engagement.todBuckets.map((c, i) => (i === todBucket(now) ? c + 1 : c))

        set({
          jackpotPool: pool,
          engagement: e,
          spinStats: {
            totalSpins:        spinStats.totalSpins + 1,
            sessionSpins:      newSession,
            spinsSinceGood:    good ? 0 : spinStats.spinsSinceGood + 1,
            spinsSinceJackpot: isJackpot ? 0 : spinStats.spinsSinceJackpot + 1,
            lossStreak:        good ? 0 : spinStats.lossStreak + 1,
            lastSpinAt:        now,
          },
        })
        return { ...outcome, coinsAwarded, jackpotAward }
      },

      // The learned per-user profile the adaptive slot engine reads. `phase`
      // gates warm-up generosity (new users get the strongest hook; experienced
      // ones tolerate leaner schedules); `quitRisk` biases WHERE the peak lands.
      getEngagementProfile: () => {
        const e = get().engagement
        const { lossStreak } = get().spinStats
        const phase = e.playCount < 8 ? 'new' : e.playCount < 30 ? 'warming' : 'established'
        const completionRate = e.startedSessions > 0 ? e.completedSessions / e.startedSessions : 1
        const todPeak = e.todBuckets.indexOf(Math.max(...e.todBuckets))
        const quitRisk = computeQuitRisk({
          curSessionPlays: e.curSessionPlays, sessionPlayCountEMA: e.sessionPlayCountEMA,
          lossStreak, lastGap: e.lastGap, interSpinGapEMA: e.interSpinGapEMA,
        })
        return { ...e, phase, completionRate, todPeak, quitRisk, lossStreak }
      },
      getQuitRisk: () => get().getEngagementProfile().quitRisk,

      // Record that a slot session was fully revealed (within-session completion
      // signal — low completion → strengthen front-loading next time).
      markSlotSessionComplete: () => set(s => ({
        engagement: { ...s.engagement, completedSessions: s.engagement.completedSessions + 1 },
      })),

      // Wheel: one spin that lands on a prize wedge by AREA at this tier (higher
      // tiers put bigger wedges on the wheel), plus bonus/jackpot upside.
      spinWheel: (activeTier) => {
        const luck = get()._luckSnapshot()
        const fin = get()._finalizeSpin(resolveWheelSpin(activeTier, luck))
        // Coins BANK the moment the outcome is final, not at animation end —
        // closing the app mid-spin can't eat a win whose pool/stats already committed.
        get().awardCoins(fin.coinsAwarded, fin.awardedResult, get().session.selectedHabit?.id)
        return fin
      },

      // Slots = GAMBLE: a session of N spins (tier sets the count), coins accumulate.
      // One special is rolled for the whole session; jackpot pays the pool on top.
      // The adaptive engine reshapes the spin ORDER/feel for THIS user (timing
      // only — the total is unchanged) using the learned engagement profile.
      spinSlots: (activeTier) => {
        const luck = get()._luckSnapshot()
        const profile = get().getEngagementProfile()
        set(s => ({ engagement: { ...s.engagement, startedSessions: s.engagement.startedSessions + 1 } }))
        const session = resolveSlotSession(activeTier, luck, profile)
        const fin = get()._finalizeSpin({
          awardedResult: session.isJackpot ? 'jackpot' : session.isBonus ? 'bonus' : 't1',
          rawResult: session.awardedResult, isNearMiss: false,
          coinsAwarded: session.baseCoins,
        })
        // jackpot pays the pool ON TOP of the accumulated spins
        const totalCoins = session.baseCoins + (session.isJackpot ? fin.jackpotAward : 0)
        const source = session.isJackpot ? 'jackpot' : session.isBonus ? 'bonus' : `t${activeTier}`
        // Bank at resolve time (see spinWheel) — abandoning mid-reveal keeps the coins.
        get().awardCoins(totalCoins, source, get().session.selectedHabit?.id)
        return { ...session, totalCoins, jackpotAward: fin.jackpotAward }
      },

      // Daily streak check-in — once per calendar day, on app open (drives the
      // streak popup). Miss a day → streak breaks to day 0 with NO bonus. Else
      // bonus = 10 × day coins (display units), small & escalating.
      // Returns { prevStreak, newStreak, broken, bonus } for the popup, or null
      // if already checked in today.
      checkInStreak: () => {
        const today = new Date().toDateString()
        const d = get().daily
        if (d.streakShownDate === today || d.lastPlayDate === today) return null   // once per day
        const yesterday = new Date(Date.now() - 86400000).toDateString()
        const prevStreak = d.loginStreak || 0
        let newStreak, broken
        if (!d.lastPlayDate)                   { newStreak = 1; broken = false }  // first ever
        else if (d.lastPlayDate === yesterday) { newStreak = prevStreak + 1; broken = false }  // continued
        else if (prevStreak >= 1)              { newStreak = 0; broken = true }   // HAD a streak, missed a day → break
        else                                   { newStreak = 1; broken = false }  // no streak to break → fresh start
        const bonus = newStreak > 0 ? Math.min(10 * newStreak, 200) : 0
        if (bonus > 0) get().awardCoins(bonus, 'daily-streak')
        set({ daily: { lastPlayDate: today, loginStreak: newStreak, bonusClaimedDate: today, streakShownDate: today } })
        return { prevStreak, newStreak, broken, bonus }
      },

      // ── Session actions ──
      setSession: (updates) => set(s => ({ session: { ...s.session, ...updates } })),
      resetSession: () => set({ session: { ...DEFAULT_SESSION } }),

      // ── Reward chain (cumulative coins across a bonus chain) ──
      pushReward: (coins) => set(s => ({ rewardChain: { prev: s.rewardChain.total, total: s.rewardChain.total + coins } })),
      resetRewardChain: () => set({ rewardChain: { prev: 0, total: 0 } }),

      // ── Milestone actions ──
      addMilestone: (m) => set(s => ({ milestones: [...s.milestones, { id: uuid(), reached: false, reachedAt: null, ...m }] })),
      updateMilestone: (id, updates) => set(s => ({ milestones: s.milestones.map(m => m.id === id ? { ...m, ...updates } : m) })),
      deleteMilestone: (id) => set(s => ({ milestones: s.milestones.filter(m => m.id !== id) })),
      checkMilestones: () => {
        const { jarBeads, milestones } = get()
        const count = jarBeads.length
        const updated = milestones.map(m => {
          if (!m.reached && count >= m.beadCount) return { ...m, reached: true, reachedAt: Date.now() }
          return m
        })
        set({ milestones: updated })
        return updated.filter(m => m.reached && !milestones.find(old => old.id === m.id)?.reached)
      },

      // The 3D jar calls this once its new beads have dropped & settled, so they
      // render as the static pile next time (only un-seen beads physics-drop).
      markJarSeen: () => set(s => (s.jarSeenCount === s.jarBeads.length ? {} : { jarSeenCount: s.jarBeads.length })),

      // ── Settings actions ──
      updateSettings: (updates) => set(s => ({ settings: { ...s.settings, ...updates } })),
      updateBeadSlotColor: (slot, color, name) => set(s => ({
        settings: {
          ...s.settings,
          beadSlots: s.settings.beadSlots.map(bs =>
            bs.slot === slot ? { ...bs, color, name: name || bs.name } : bs
          ),
        },
      })),

      // ── Reset actions ──
      resetWallet: () => set({ wallet: [] }),
      resetEverything: () => set({
        habits:     [],
        categories: [],
        wallet:     [],
        jarBeads:   [],
        jarSeenCount: 0,
        coinLog:    [],
        coinTotals: { earned: 0, spent: 0 },
        coinLogComplete: true,
        milestones: [],
        jackpotPool: JACKPOT_SEED,
        spinStats:  { ...DEFAULT_SPIN_STATS },
        engagement: { ...DEFAULT_ENGAGEMENT },
        daily:      { lastPlayDate: null, loginStreak: 0, bonusClaimedDate: null },
        session:    { ...DEFAULT_SESSION },
        rewardChain: { prev: 0, total: 0 },
      }),
    }),
    {
      name: 'my-habit-addiction',
      version: 15,
      migrate: (persisted, version) => {
        if (version < 2 && persisted.settings?.beadSlots) {
          persisted.settings.beadSlots = persisted.settings.beadSlots.map(s => {
            if (s.slot === 5) return { ...s, color: '#B4D4FF', name: 'Sky' }
            if (s.slot === 6) return { ...s, color: '#F5C44B', name: 'Honey' }
            return s
          })
        }
        if (version < 3) {
          // ×COIN_SCALE coin rescale — keep history consistent with new big numbers
          if (Array.isArray(persisted.coinLog)) {
            persisted.coinLog = persisted.coinLog.map(e => ({ ...e, amount: (e.amount || 0) * COIN_SCALE }))
          }
          if (typeof persisted.jackpotPool === 'number') {
            persisted.jackpotPool = Math.max(persisted.jackpotPool * COIN_SCALE, JACKPOT_SEED)
          }
          if (persisted.settings) {
            // money: was $0.25/coin → clean 1¢ if it was enabled, else stays off
            persisted.settings.moneyPerCoin = persisted.settings.moneyPerCoin ? 0.01 : 0
            // time: convert minutes/coin → seconds/coin (clean 1s if it was enabled)
            persisted.settings.secondsPerCoin = persisted.settings.minutesPerCoin ? 1 : 0
            delete persisted.settings.minutesPerCoin
          }
        }
        if (version < 4 && persisted.settings) {
          if (persisted.settings.secondsPerCoin) persisted.settings.secondsPerCoin = 2.4
          if (persisted.settings.moneyPerCoin) persisted.settings.moneyPerCoin = 0.01
        }
        if (version < 5 && persisted.settings) {
          // Retune: 1 coin = 2 sec & 1¢ (clean default)
          if (persisted.settings.secondsPerCoin) persisted.settings.secondsPerCoin = 2
          if (persisted.settings.moneyPerCoin) persisted.settings.moneyPerCoin = 0.01
        }
        if (version < 6 && persisted.settings?.beadSlots) {
          // New bead PNG art — recolor/rename every slot to match the marble set
          // (pink, orchid, sky, mint, coral, cherry) so glow + label match the image.
          const NEW = {
            1: { color: '#FBB3CF', name: 'Rose Quartz' },
            2: { color: '#E4A8EB', name: 'Orchid' },
            3: { color: '#A9D2F5', name: 'Sky' },
            4: { color: '#B2EAD8', name: 'Mint' },
            5: { color: '#FCB8A3', name: 'Coral' },
            6: { color: '#F87586', name: 'Cherry' },
          }
          persisted.settings.beadSlots = persisted.settings.beadSlots.map(s =>
            NEW[s.slot] ? { ...s, ...NEW[s.slot] } : s
          )
        }
        if (version < 8) {
          // Jackpot reseed: start fresh at the new 2,000 seed (was 6,250)
          persisted.jackpotPool = JACKPOT_SEED
        }
        if (version < 9 && persisted.settings) {
          // Bead slot names/colors are FIXED to the marble bead art now — hard-reset
          // any stale/old names (e.g. "Hot Pink", "Honey") to the canonical set.
          persisted.settings.beadSlots = DEFAULT_BEAD_SLOTS.map(s => ({ ...s }))
        }
        if (version < 10) {
          // Adaptive engagement engine — seed the learned per-user profile.
          persisted.engagement = { ...DEFAULT_ENGAGEMENT, ...(persisted.engagement || {}) }
        }
        if (version < 11) {
          // Cherry (red) → RAINBOW wild card. Slot 6 becomes the rainbow slot,
          // and every existing slot-6 bead in the wallet/jar becomes wild.
          if (persisted.settings?.beadSlots) {
            persisted.settings.beadSlots = persisted.settings.beadSlots.map(s =>
              s.slot === 6 ? { ...s, color: '#E5C0F5', name: 'Rainbow', rainbow: true } : s
            )
          }
          const stamp = b => (b.slot === 6 && !b.isGold) ? { ...b, isRainbow: true } : b
          if (Array.isArray(persisted.wallet)) persisted.wallet = persisted.wallet.map(stamp)
          if (Array.isArray(persisted.jarBeads)) persisted.jarBeads = persisted.jarBeads.map(stamp)
        }
        if (version < 12 && persisted.settings?.beadSlots) {
          // color tuning: Orchid bluer (was pink-adjacent), Sky/Mint deeper
          const TUNE = { 2: '#BC93F2', 3: '#7FBCF2', 4: '#87E0BA' }
          persisted.settings.beadSlots = persisted.settings.beadSlots.map(s =>
            TUNE[s.slot] ? { ...s, color: TUNE[s.slot] } : s
          )
        }
        if (version < 13) {
          // O(1) coin balance: fold the full log into running totals once, then
          // keep only recent history in the log (it was growing unbounded).
          const log = Array.isArray(persisted.coinLog) ? persisted.coinLog : []
          persisted.coinTotals = {
            earned: log.filter(e => e.type === 'earned').reduce((s, e) => s + (e.amount || 0), 0),
            spent:  log.filter(e => e.type === 'spent').reduce((s, e) => s + (e.amount || 0), 0),
          }
          persisted.coinLog = log.slice(-COIN_LOG_MAX)
        }
        if (version < 14) {
          // RECOVERY: v13 could leave coinTotals at {0,0} while the log still held
          // the real history — Spend showed 0 coins though thousands were earned.
          // (A dev hot-reload landed between adding the field and its seed step, so
          // the persisted version reached 13 without the seed ever running.)
          // Rebuild totals from the log and record whether the log is still the
          // complete history, so onRehydrateStorage can keep self-healing.
          const log = Array.isArray(persisted.coinLog) ? persisted.coinLog : []
          persisted.coinTotals = {
            earned: log.filter(e => e.type === 'earned').reduce((s, e) => s + (e.amount || 0), 0),
            spent:  log.filter(e => e.type === 'spent').reduce((s, e) => s + (e.amount || 0), 0),
          }
          persisted.coinLogComplete = log.length < COIN_LOG_MAX
        }
        if (version < 15) {
          // 3D jar now places already-earned beads instantly (static pile) and only
          // physics-drops NEW ones. Treat every existing jar bead as already seen so
          // the whole jar doesn't re-pour on the first load after this update.
          persisted.jarSeenCount = Array.isArray(persisted.jarBeads) ? persisted.jarBeads.length : 0
        }
        return persisted
      },
      // Only persist these — session is ephemeral
      partialize: (state) => ({
        habits:     state.habits,
        categories: state.categories,
        wallet:     state.wallet,
        jarBeads:   state.jarBeads,
        jarSeenCount: state.jarSeenCount,
        coinLog:    state.coinLog,
        coinTotals: state.coinTotals,
        coinLogComplete: state.coinLogComplete,
        milestones: state.milestones,
        settings:   state.settings,
        jackpotPool: state.jackpotPool,
        spinStats:  state.spinStats,
        engagement: state.engagement,
        daily:      state.daily,
      }),
      // Self-heal on every load: while the log is the complete history, it's the
      // source of truth — rebuild coinTotals from it so the balance can NEVER
      // silently drift from the log again (the regression where Stats showed
      // 38,620 earned but Spend showed 0). Once the log overflows and starts
      // dropping entries (coinLogComplete=false), we trust the incrementally
      // maintained totals instead. Runs once per load — O(n) at startup, not per render.
      onRehydrateStorage: () => (state) => {
        if (!state || !state.coinLogComplete) return
        const log = state.coinLog || []
        state.coinTotals = {
          earned: log.filter(e => e.type === 'earned').reduce((s, e) => s + (e.amount || 0), 0),
          spent:  log.filter(e => e.type === 'spent').reduce((s, e) => s + (e.amount || 0), 0),
        }
      },
    }
  )
)

export { TIER_COINS }
export default useStore

// Dev-only: expose the store on window for quick manual testing in the preview.
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.useStore = useStore
}
