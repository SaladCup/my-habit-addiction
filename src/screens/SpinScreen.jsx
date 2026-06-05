import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import useStore from '../store/useStore'
import { spinBonusWheel, TIER_COINS, SPINS_PER_TIER } from '../engine/gameLogic'
import { KawaiiButton, PixelPanel, TierBadge } from '../components/ui'
import Wheel from '../components/Wheel'
import SlotMachine from '../components/SlotMachine'

const KAWAII_COLORS = ['#FF85A1', '#C8B4E0', '#B4E0C8', '#FFD700', '#FF6B9D', '#9B7EC8']

function fireConfetti(result) {
  if (result === 'jackpot') {
    confetti({ particleCount: 200, spread: 360, startVelocity: 55,
      origin: { x: 0.5, y: 0.45 }, colors: KAWAII_COLORS, scalar: 1.3 })
    setTimeout(() => {
      confetti({ angle: 60,  spread: 55, origin: { x: 0 }, colors: KAWAII_COLORS })
      confetti({ angle: 120, spread: 55, origin: { x: 1 }, colors: KAWAII_COLORS })
    }, 300)
  } else if (result === 't3') {
    confetti({ particleCount: 90, spread: 70, startVelocity: 40,
      origin: { x: 0.5, y: 0.45 }, colors: ['#B4E0C8', '#5CBFA0', '#FFD700', '#FF85A1'] })
  } else if (result === 'bonus') {
    confetti({ particleCount: 60, spread: 90, startVelocity: 30,
      origin: { x: 0.5, y: 0.5 }, colors: ['#FFD700', '#F5C44B', '#FF85A1', '#FFE9A0'] })
  }
}

const TIER_LABEL = { t1: 'Tier 1', t2: 'Tier 2', t3: 'Tier 3', jackpot: 'JACKPOT', bonus: 'BONUS' }

export default function SpinScreen() {
  const navigate = useNavigate()
  const { session, setSession, awardCoins, addBonusBead, spinWheel, spinSlots, claimDailyBonus } = useStore()
  const jackpotPool = useStore(s => s.jackpotPool)
  const activeTier = session.activeTier || 1

  const [mode, setMode] = useState(null)          // 'wheel' | 'slots'
  const [wheelOutcome, setWheelOutcome] = useState(null)
  const [shouldSpin, setShouldSpin] = useState(false)
  const [wheelDone, setWheelDone] = useState(false)

  const [slotSession, setSlotSession] = useState(null)   // resolved multi-spin slot session
  const slotGuard = useRef(false)      // prevent double-complete from the slot animation
  const [pendingNav, setPendingNav] = useState(null)  // route to navigate on continue tap
  const [dailyBonus, setDailyBonus] = useState(null)  // { streak, bonus } if claimed today

  const wheelRef = useRef(null)

  // Daily login bonus — escalating reward, once per calendar day
  useEffect(() => {
    const claimed = claimDailyBonus()
    if (claimed) setDailyBonus(claimed)
  }, [])

  function pickMode(m) {
    slotGuard.current = false
    setMode(m)
    setSession({ chosenMode: m, phase: 'spinning' })
    if (m === 'slots') setSlotSession(spinSlots(activeTier))   // resolve the whole session up front
  }

  function handleWheelSpin() {
    if (shouldSpin) return
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
    setWheelDone(true)
    const { awardedResult, coinsAwarded } = wheelOutcome
    awardCoins(coinsAwarded, awardedResult, session.selectedHabit?.id)
    // Set coinsEarned to THIS spin's coins only (awardCoins also folds in any
    // daily-login bonus claimed on mount — don't let that inflate the reward total).
    setSession({ spinResult: awardedResult, isNearMiss: wheelOutcome.isNearMiss, coinsEarned: coinsAwarded, phase: 'reward' })
    fireConfetti(awardedResult)
    if (awardedResult === 'bonus') {
      const bonus = spinBonusWheel()
      setSession({ bonusResult: bonus.result, bonusTimerEnd: Date.now() + 10 * 60 * 1000 })
      setPendingNav('/bonus')
    } else {
      setPendingNav('/reward')
    }
  }

  // All slot spins revealed — award the accumulated coins, set result, route onward
  function handleSlotsComplete() {
    if (slotGuard.current || !slotSession) return
    slotGuard.current = true
    const result = slotSession.isJackpot ? 'jackpot'
      : slotSession.isBonus ? 'bonus'
      : `t${activeTier}`   // show the tier you played (not a generic t1)
    awardCoins(slotSession.totalCoins, result, session.selectedHabit?.id)
    setSession({ spinResult: result, coinsEarned: slotSession.totalCoins, phase: 'reward' })
    fireConfetti(slotSession.isJackpot ? 'jackpot' : result)
    if (slotSession.isBonus) {
      const bonus = spinBonusWheel()
      setSession({ bonusResult: bonus.result, bonusTimerEnd: Date.now() + 10 * 60 * 1000 })
      setPendingNav('/bonus')
    } else {
      setPendingNav('/reward')
    }
  }

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
          fontFamily: "'Bunny Snaps', cursive",
          fontSize: 34, color: '#3D2B4F',
          marginBottom: 8,
        }}>
          ✦ SPIN TO WIN ✦
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 22, color: '#7B5EA7' }}>
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
        <div style={{ fontFamily: "'Bunny Snaps', cursive", fontSize: 20, color: '#8A6A00', letterSpacing: '0.08em' }}>
          ★ GRAND JACKPOT ★
        </div>
        <div style={{ fontFamily: "'Bunny Snaps', cursive", fontSize: 30, color: '#5C3A00' }}>
          💎 {jackpotPool.toLocaleString()}
        </div>
      </div>
      )}

      {/* Daily streak bonus */}
      {dailyBonus && (
        <div style={{
          fontFamily: 'Nunito, sans-serif', fontSize: 20, fontWeight: 800, color: '#5CBFA0',
          background: '#E8FBF2', border: '2px solid #B4E0C8', borderRadius: 999,
          padding: '6px 16px', animation: 'bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          🔥 Day {dailyBonus.streak} streak — +{dailyBonus.bonus} bonus coins!
        </div>
      )}

      {/* Mode picker */}
      {!mode && (
        <PixelPanel color="lavender" style={{ width: '100%', maxWidth: 380 }}>
          <div style={{
            fontFamily: "'Bunny Snaps', cursive",
            fontSize: 27, color: '#3D2B4F',
            textAlign: 'center', marginBottom: 16,
          }}>
            CHOOSE YOUR GAME
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => pickMode('wheel')} style={modeBtn(tierColor)}>
              <div style={{ fontSize: 47, marginBottom: 6 }}>🎡</div>
              <div style={{ fontFamily: "'Bunny Snaps', cursive", fontSize: 26 }}>
                WHEEL
              </div>
              <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 22, color: '#7B5EA7', marginTop: 4 }}>
                1 spin
              </div>
            </button>
            <button onClick={() => pickMode('slots')} style={modeBtn(tierColor)}>
              <div style={{ fontSize: 47, marginBottom: 6 }}>🎰</div>
              <div style={{ fontFamily: "'Bunny Snaps', cursive", fontSize: 26 }}>
                SLOTS
              </div>
              <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 22, color: '#7B5EA7', marginTop: 4 }}>
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

          {wheelDone && wheelOutcome && (
            <div style={{ textAlign: 'center', animation: 'bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <TierBadge tier={wheelOutcome.awardedResult} />
              <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 26, color: '#7B5EA7', marginTop: 8 }}>
                {wheelOutcome.isNearMiss && '(near miss!) '}
                +{wheelOutcome.coinsAwarded} coins earned
              </div>
            </div>
          )}
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
