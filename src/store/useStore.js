import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import {
  resolveWheelSpin, resolveSlotSession, isGoodResult, TIER_COINS, COIN_SCALE,
} from '../engine/gameLogic'

// ── Progressive jackpot tuning (scaled to COIN_SCALE) ──
const JACKPOT_SEED      = 250 * COIN_SCALE  // pool resets here after a jackpot
const JACKPOT_PER_SPIN  = 5 * COIN_SCALE    // pool grows by this each spin (the more you play, the bigger)
const SESSION_GAP_MS    = 30 * 60 * 1000  // >30min idle starts a fresh "session" (warm-up)

const DEFAULT_SPIN_STATS = {
  totalSpins: 0,
  sessionSpins: 0,
  spinsSinceGood: 0,
  spinsSinceJackpot: 0,
  lossStreak: 0,
  lastSpinAt: 0,
}

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
  { slot: 2, color: '#E4A8EB', name: 'Orchid' },
  { slot: 3, color: '#A9D2F5', name: 'Sky' },
  { slot: 4, color: '#B2EAD8', name: 'Mint' },
  { slot: 5, color: '#FCB8A3', name: 'Coral' },
  { slot: 6, color: '#F87586', name: 'Cherry' },
]

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
      coinLog:    [],     // { id, type, amount, source, habitId, note, timestamp }
      milestones: [],

      // ── Engagement systems (persisted) ──
      jackpotPool: JACKPOT_SEED,                 // progressive jackpot, grows as you play
      spinStats:   { ...DEFAULT_SPIN_STATS },    // drives the luck engine
      daily:       { lastPlayDate: null, loginStreak: 0, bonusClaimedDate: null },
      settings: {
        beadSlots:      DEFAULT_BEAD_SLOTS,
        coinName:       'coins',
        moneyPerCoin:   0.01,   // 1 coin = 1¢
        secondsPerCoin: 2,      // 1 coin = 2 sec → T1/T2/T3 ≈ 4/8/12.5 min
        timeActivity:   'free time',
        muted:          false,
        volume:         0.6,
      },

      // ── Ephemeral session (not persisted) ──
      session: { ...DEFAULT_SESSION },

      // ── Computed getters ──
      getTotalCoinsEarned: () =>
        get().coinLog.filter(e => e.type === 'earned').reduce((s, e) => s + e.amount, 0),
      getTotalCoinsSpent: () =>
        get().coinLog.filter(e => e.type === 'spent').reduce((s, e) => s + e.amount, 0),
      getCoinsAvailable: () =>
        get().coinLog.reduce((s, e) => e.type === 'earned' ? s + e.amount : s - e.amount, 0),
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
        // Uniform 1/7 chance: slots 1-6 + gold
        const roll = Math.random()
        const isGold = roll < (1 / 7)
        const slot = isGold ? null : (Math.floor(Math.random() * 6) + 1)
        const bead = { id: uuid(), slot, isGold, habitId, earnedAt: Date.now() }
        set(s => ({
          wallet: [...s.wallet, bead],
          session: { ...s.session, drawnBead: bead, phase: 'habitDone' },
        }))
        return bead
      },

      cashInBeads: (beads) => {
        // Determine active tier
        let activeTier = 1
        const hasGold = beads.some(b => b.isGold)
        if (hasGold) {
          activeTier = 3
        } else {
          const slotCounts = {}
          beads.forEach(b => { slotCounts[b.slot] = (slotCounts[b.slot] || 0) + 1 })
          const max = Math.max(...Object.values(slotCounts))
          if (max >= 3) activeTier = 3
          else if (max >= 2) activeTier = 2
        }

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
        const { session, habits } = get()
        const habitId = session.selectedHabit?.id || null
        const roll = Math.random()
        const isGold = roll < (1 / 7)
        const slot = isGold ? null : (Math.floor(Math.random() * 6) + 1)
        const bead = { id: uuid(), slot, isGold, habitId, earnedAt: Date.now() }
        set(s => ({ wallet: [...s.wallet, bead] }))
        return bead
      },

      // ── Coin actions ──
      awardCoins: (amount, source, habitId = null) => {
        const event = { id: uuid(), type: 'earned', amount, source, habitId, note: '', timestamp: Date.now() }
        set(s => ({
          coinLog: [...s.coinLog, event],
          session: { ...s.session, coinsEarned: s.session.coinsEarned + amount },
        }))
      },
      spendCoins: (amount, note = '') => {
        const event = { id: uuid(), type: 'spent', amount, source: 'manual', habitId: null, note, timestamp: Date.now() }
        set(s => ({ coinLog: [...s.coinLog, event] }))
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

      // Update stats + grow/reset the jackpot pool. Returns the enriched outcome.
      _finalizeSpin: (outcome) => {
        const now = Date.now()
        const { spinStats, jackpotPool } = get()
        const newSession = now - spinStats.lastSpinAt > SESSION_GAP_MS ? 1 : spinStats.sessionSpins + 1
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

        set({
          jackpotPool: pool,
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

      // Wheel = SAFE: one certain spin for the full tier value (+ bonus/jackpot upside).
      spinWheel: (activeTier) => {
        const luck = get()._luckSnapshot()
        return get()._finalizeSpin(resolveWheelSpin(activeTier, luck))
      },

      // Slots = GAMBLE: a session of N spins (tier sets the count), coins accumulate.
      // One special is rolled for the whole session; jackpot pays the pool on top.
      spinSlots: (activeTier) => {
        const luck = get()._luckSnapshot()
        const session = resolveSlotSession(activeTier, luck)
        const fin = get()._finalizeSpin({
          awardedResult: session.isJackpot ? 'jackpot' : session.isBonus ? 'bonus' : 't1',
          rawResult: session.awardedResult, isNearMiss: false,
          coinsAwarded: session.baseCoins,
        })
        // jackpot pays the pool ON TOP of the accumulated spins
        const totalCoins = session.baseCoins + (session.isJackpot ? fin.jackpotAward : 0)
        return { ...session, totalCoins, jackpotAward: fin.jackpotAward }
      },

      // Escalating daily login bonus (once per calendar day).
      claimDailyBonus: () => {
        const today = new Date().toDateString()
        const d = get().daily
        if (d.bonusClaimedDate === today) return null
        const yesterday = new Date(Date.now() - 86400000).toDateString()
        const streak = d.lastPlayDate === yesterday ? (d.loginStreak || 0) + 1 : 1
        const bonus = Math.min(10 + (streak - 1) * 5, 50) * COIN_SCALE
        get().awardCoins(bonus, 'daily-bonus')
        set({ daily: { lastPlayDate: today, loginStreak: streak, bonusClaimedDate: today } })
        return { streak, bonus }
      },

      // ── Session actions ──
      setSession: (updates) => set(s => ({ session: { ...s.session, ...updates } })),
      resetSession: () => set({ session: { ...DEFAULT_SESSION } }),

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
        coinLog:    [],
        milestones: [],
        jackpotPool: JACKPOT_SEED,
        spinStats:  { ...DEFAULT_SPIN_STATS },
        daily:      { lastPlayDate: null, loginStreak: 0, bonusClaimedDate: null },
        session:    { ...DEFAULT_SESSION },
      }),
    }),
    {
      name: 'my-habit-addiction',
      version: 6,
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
        return persisted
      },
      // Only persist these — session is ephemeral
      partialize: (state) => ({
        habits:     state.habits,
        categories: state.categories,
        wallet:     state.wallet,
        jarBeads:   state.jarBeads,
        coinLog:    state.coinLog,
        milestones: state.milestones,
        settings:   state.settings,
        jackpotPool: state.jackpotPool,
        spinStats:  state.spinStats,
        daily:      state.daily,
      }),
    }
  )
)

export { TIER_COINS }
export default useStore
