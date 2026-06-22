import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import useStore from '../store/useStore'
import { spinBonusWheel, SPINS_PER_TIER } from '../engine/gameLogic'
import { KawaiiButton, PixelPanel, TierBadge } from '../components/ui'
import { playWin } from '../engine/sounds'
import Wheel from '../components/Wheel'
import SlotMachine from '../components/SlotMachine'

const KAWAII_COLORS = ['#FF85A1', '#C8B4E0', '#B4E0C8', '#FFD700', '#FF6B9D', '#9B7EC8']

// Escalating juice: particle count, spread, velocity & side-cannons all scale
// with the SIZE of the win (coins), so a big haul feels visibly bigger than a
// small one. Jackpot/bonus keep their signature bursts on top.
function fireConfetti(result, coins = 0) {
  const mag = Math.max(0, Math.min(1, coins / 750))          // 0..1 across the win range
  const main = 45 + Math.round(mag * 165)                    // 45..210 particles
  confetti({
    particleCount: main, spread: 70 + mag * 90, startVelocity: 32 + mag * 26,
    origin: { x: 0.5, y: 0.5 }, colors: KAWAII_COLORS, scalar: 1 + mag * 0.4,
  })
  // Bigger wins (or any jackpot/bonus) add dual side-cannons.
  if (result === 'jackpot' || result === 'bonus' || coins >= 350) {
    setTimeout(() => {
      confetti({ angle: 60,  spread: 55, startVelocity: 55, particleCount: 60 + Math.round(mag * 60), origin: { x: 0 }, colors: KAWAII_COLORS })
      confetti({ angle: 120, spread: 55, startVelocity: 55, particleCount: 60 + Math.round(mag * 60), origin: { x: 1 }, colors: KAWAII_COLORS })
    }, 240)
  }
  // Jackpot: a full 360° bloom for the grand moment.
  if (result === 'jackpot') {
    setTimeout(() => confetti({ particleCount: 220, spread: 360, startVelocity: 55,
      origin: { x: 0.5, y: 0.45 }, colors: KAWAII_COLORS, scalar: 1.3 }), 120)
  }
}

export default function SpinScreen() {
  const navigate = useNavigate()
  const { session, setSession, resetSession, spinWheel, spinSlots, markSlotSessionComplete, pushReward } = useStore()
  const jackpotPool = useStore(s => s.jackpotPool)
  const activeTier = session.activeTier || 1

  // CORE RULE GUARD: spins are earned one per completed habit — the only ways
  // in are the BEAD EARNED prompt's two choices: cash matching beads (phase
  // 'cashIn') or keep them and spin Tier 1 (phase 'habitDone'). Browser-back
  // from /reward (or a typed URL) re-mounts this screen with a stale session;
  // without this check that re-mount offered a free, un-earned re-spin.
  // (Lazy state = a one-time mount snapshot; later phase changes don't re-judge it.)
  const [validEntry] = useState(() => session.phase === 'cashIn' || session.phase === 'habitDone')

  const [mode, setMode] = useState(null)          // 'wheel' | 'slots'
  const [wheelOutcome, setWheelOutcome] = useState(null)
  const [shouldSpin, setShouldSpin] = useState(false)

  const [slotSession, setSlotSession] = useState(null)   // resolved multi-spin slot session
  const slotGuard = useRef(false)      // prevent double-complete from the slot animation
  const [pendingNav, setPendingNav] = useState(null)  // route to navigate on continue tap

  const wheelRef = useRef(null)
  // pickMode (slots) and the wheel spin both BANK coins up front; their `shouldSpin`/
  // state guards are async, so a double-tap before re-render double-banks. Sync latches:
  const modeLock = useRef(false)
  const spinLock = useRef(false)

  useEffect(() => {
    if (!validEntry) {
      resetSession()                        // clear the stale session on the way out
      navigate('/', { replace: true })
    }
  }, [validEntry, navigate, resetSession])

  function pickMode(m) {
    if (modeLock.current) return
    modeLock.current = true
    slotGuard.current = false
    setMode(m)
    setSession({ chosenMode: m, phase: 'spinning' })
    if (m === 'slots') setSlotSession(spinSlots(activeTier))   // resolve the whole session up front
  }

  function handleWheelSpin() {
    if (spinLock.current || shouldSpin) return
    spinLock.current = true
    const outcome = spinWheel(activeTier)   // luck-adjusted + jackpot handled
    setWheelOutcome(outcome)
    setShouldSpin(true)
  }

  useEffect(() => {
    if (shouldSpin && wheelOutcome && wheelRef.current) {
      wheelRef.current.spin()
    }
  }, [shouldSpin, wheelOutcome])

  function handleWheelDone() {
    // Coins were already banked by spinWheel at spin start (abandon-safe) — this
    // handler is pure presentation. coinsEarned is set to THIS spin's coins only
    // (the store folds in any daily-login bonus too; don't inflate the reward total).
    const { awardedResult, coinsAwarded } = wheelOutcome
    pushReward(coinsAwarded)   // add to the running bonus-chain total
    setSession({ spinResult: awardedResult, isNearMiss: wheelOutcome.isNearMiss, coinsEarned: coinsAwarded, phase: 'reward' })
    fireConfetti(awardedResult, coinsAwarded)
    if (awardedResult === 'bonus') {
      // pre-roll the bonus round — the reward screen shows the coins first, then
      // a "Bonus Round" button continues to /bonus.
      const bonus = spinBonusWheel()
      setSession({ bonusResult: bonus.result, bonusTimerEnd: Date.now() + 10 * 60 * 1000 })
    }
    setPendingNav('/reward')   // always see the (cumulative) reward first
  }

  // All slot spins revealed — coins were banked by spinSlots up front
  // (abandon-safe); this just sets the result display and routes onward.
  function handleSlotsComplete() {
    if (slotGuard.current || !slotSession) return
    slotGuard.current = true
    markSlotSessionComplete()   // learned signal: this user finished the session

    const result = slotSession.isJackpot ? 'jackpot'
      : slotSession.isBonus ? 'bonus'
      : `t${activeTier}`   // show the tier you played (not a generic t1)
    pushReward(slotSession.totalCoins)   // add to the running bonus-chain total
    setSession({ spinResult: result, coinsEarned: slotSession.totalCoins, phase: 'reward' })
    playWin(result)   // slots win fanfare (the wheel plays its own in Wheel.jsx)
    fireConfetti(slotSession.isJackpot ? 'jackpot' : result, slotSession.totalCoins)
    if (slotSession.isBonus) {
      const bonus = spinBonusWheel()
      setSession({ bonusResult: bonus.result, bonusTimerEnd: Date.now() + 10 * 60 * 1000 })
    }
    setPendingNav('/reward')   // always see the (cumulative) reward first
  }

  if (!validEntry) return null   // un-earned visit — redirecting home (guard effect above)

  const tierColors = { 1: '#FFB7C5', 2: '#C8B4E0', 3: '#B4E0C8' }
  const tierColor = tierColors[activeTier] || '#FFB7C5'

  return (
    <div style={{
      minHeight: '100%',
      padding: '24px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          fontFamily: "'Fredoka', cursive",
          fontSize: 34, color: '#3D2B4F',
          marginBottom: 8,
        }}>
          ✦ SPIN TO WIN ✦
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#7B5EA7' }}>
            Active up to:
          </span>
          <TierBadge tier={`t${activeTier}`} />
        </div>
      </div>

      {/* Progressive jackpot banner — hidden in slots (the cabinet shows it) */}
      {mode !== 'slots' && (
      <div style={{
        background: 'linear-gradient(180deg, #FFE9A0 0%, #F5C44B 100%)',
        border: '3px solid #E6B800',
        borderRadius: 16,
        padding: '8px 22px',
        textAlign: 'center',
        boxShadow: '0 4px 0 #C99A00, 0 6px 16px rgba(245,196,75,0.45)',
        animation: 'pulse-glow 2.4s ease-in-out infinite',
      }}>
        <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 20, color: '#8A6A00', letterSpacing: '0.08em' }}>
          ★ GRAND JACKPOT ★
        </div>
        <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#5C3A00' }}>
          💎 {jackpotPool.toLocaleString()}
        </div>
      </div>
      )}


      {/* Mode picker */}
      {!mode && (
        <PixelPanel color="lavender" style={{ width: '100%', maxWidth: 380 }}>
          <div style={{
            fontFamily: "'Fredoka', cursive",
            fontSize: 27, color: '#3D2B4F',
            textAlign: 'center', marginBottom: 16,
          }}>
            CHOOSE YOUR GAME
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => pickMode('wheel')} style={modeBtn(tierColor)}>
              <div style={{ fontSize: 47, marginBottom: 6 }}>🎡</div>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 26 }}>
                WHEEL
              </div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#7B5EA7', marginTop: 4 }}>
                1 spin
              </div>
            </button>
            <button onClick={() => pickMode('slots')} style={modeBtn(tierColor)}>
              <div style={{ fontSize: 47, marginBottom: 6 }}>🎰</div>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 26 }}>
                SLOTS
              </div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#7B5EA7', marginTop: 4 }}>
                {SPINS_PER_TIER[activeTier] || 3} spins
              </div>
            </button>
          </div>
        </PixelPanel>
      )}

      {/* Wheel mode */}
      {mode === 'wheel' && (
        <>
          <Wheel
            ref={wheelRef}
            activeTier={activeTier}
            awardedResult={wheelOutcome?.awardedResult}
            rawResult={wheelOutcome?.rawResult}
            isNearMiss={wheelOutcome?.isNearMiss}
            onDone={handleWheelDone}
          />

          {!shouldSpin && (
            <KawaiiButton variant="gold" size="xl" onClick={handleWheelSpin}>
              ✨ SPIN! ✨
            </KawaiiButton>
          )}
          {/* The wheel lands visually on its wedge; the single reward reveal is /reward
              (the sticky "TAP TO SEE REWARDS" button below), matching the slots path —
              no inline "+N coins" pre-announcement to double up the win. */}
        </>
      )}

      {/* Slots mode — multi-spin video slot (3/6/9 spins by tier) */}
      {mode === 'slots' && (
        <SlotMachine
          session={slotSession}
          onComplete={handleSlotsComplete}
          jackpotPool={jackpotPool}
        />
      )}

      {/* Continue button after win — sticky so it's always reachable below the
          tall slot cabinet (otherwise it rendered off-screen). */}
      {pendingNav && (
        <div style={{
          position: 'sticky', bottom: 16, zIndex: 60,
          width: '100%', maxWidth: 380,
          display: 'flex', justifyContent: 'center', marginTop: 8,
        }}>
          <KawaiiButton
            variant={pendingNav === '/bonus' ? 'gold' : 'primary'}
            size="xl"
            fullWidth
            onClick={() => navigate(pendingNav)}
            style={{ animation: 'bounce-in 0.45s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: '0 6px 24px rgba(155,126,200,0.45)' }}
          >
            {pendingNav === '/bonus' ? '⭐ BONUS ROUND! TAP TO SPIN →' : '✨ TAP TO SEE REWARDS →'}
          </KawaiiButton>
        </div>
      )}

      {/* Back button (before picking mode) */}
      {!mode && (
        <KawaiiButton variant="ghost" size="md" onClick={() => navigate('/')}>
          ← Back
        </KawaiiButton>
      )}
    </div>
  )
}

function modeBtn(accentColor) {
  return {
    flex: 1,
    background: `${accentColor}22`,
    border: `3px solid ${accentColor}`,
    borderRadius: 18,
    padding: '16px 12px',
    cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    boxShadow: `0 4px 0 ${darken(accentColor, 30)}`,
    transition: 'transform 100ms ease',
    color: '#3D2B4F',
    userSelect: 'none',
  }
}

function darken(hex, amount) {
  try {
    const num = parseInt(hex.replace('#', ''), 16)
    const r = Math.max(0, (num >> 16) - amount)
    const g = Math.max(0, ((num >> 8) & 0xff) - amount)
    const b = Math.max(0, (num & 0xff) - amount)
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  } catch { return '#888' }
}
