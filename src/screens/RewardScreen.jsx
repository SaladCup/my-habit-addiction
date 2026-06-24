import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import useStore from '../store/useStore'
import { TIER_COINS } from '../engine/gameLogic'
import { KawaiiButton, TierBadge, PixelPanel } from '../components/ui'
import { playReward } from '../engine/sounds'
import VisualNovel from '../components/VisualNovel'
import { REACTION_JACKPOT } from '../content/habitChanScript'
// 3D physics coin shower — lazy so Three.js/rapier only load on a win
const CoinCascade3D = lazy(() => import('../components/CoinCascade3D'))

const KAWAII_COLORS = ['#FFB7C5', '#C8B4E0', '#B4E0C8', '#FFE9A0', '#B4D4FF', '#FF85A1', '#9B7EC8', '#FFD700', '#FFF176']

function fireRewardConfetti(result) {
  if (result === 'jackpot') {
    confetti({ particleCount: 200, spread: 360, startVelocity: 55,
      origin: { x: 0.5, y: 0.45 }, colors: KAWAII_COLORS, scalar: 1.3 })
    setTimeout(() => {
      confetti({ angle: 60,  spread: 60, origin: { x: 0 }, colors: KAWAII_COLORS })
      confetti({ angle: 120, spread: 60, origin: { x: 1 }, colors: KAWAII_COLORS })
    }, 280)
    setTimeout(() => {
      confetti({ particleCount: 120, spread: 100, origin: { x: 0.5, y: 0.4 }, colors: KAWAII_COLORS })
    }, 600)
  } else if (result === 't3') {
    confetti({ particleCount: 90, spread: 70, startVelocity: 40,
      origin: { x: 0.5, y: 0.45 }, colors: ['#B4E0C8', '#5CBFA0', '#FFD700', '#FF85A1'] })
  } else if (result === 't2') {
    confetti({ particleCount: 60, spread: 65, startVelocity: 32,
      origin: { x: 0.5, y: 0.45 }, colors: ['#C8B4E0', '#9B7EC8', '#FFE9A0', '#FF85A1'] })
  } else if (result === 'bonus') {
    confetti({ particleCount: 60, spread: 90, startVelocity: 30,
      origin: { x: 0.5, y: 0.5 }, colors: ['#FFD700', '#F5C44B', '#FF85A1', '#FFE9A0'] })
  } else {
    confetti({ particleCount: 30, spread: 50, startVelocity: 22,
      origin: { x: 0.5, y: 0.45 }, colors: ['#FFB7C5', '#FF85A1', '#FFE9A0'] })
  }
}

// Counts from `from` up to `to` (so a chained reward visibly crushes the old total up).
function CoinCounter({ from = 0, to, duration = 1400 }) {
  const [value, setValue] = useState(from)
  const [landed, setLanded] = useState(!to)   // nothing to count up → land immediately
  const rafRef = useRef(null)

  useEffect(() => {
    if (!to) return
    const start = performance.now()
    function tick(now) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(from + (to - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else setLanded(true)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => rafRef.current && cancelAnimationFrame(rafRef.current)
  }, [from, to, duration])

  return (
    <span style={{
      display: 'inline-block',
      transition: 'transform 240ms cubic-bezier(0.34,1.56,0.64,1)',
      transform: landed ? 'scale(1.15)' : 'scale(1)',
      textShadow: landed ? '0 0 12px rgba(255,215,0,0.7)' : 'none',
    }}>
      {value}
    </span>
  )
}

const RESULT_CFG = {
  t1:      { emoji: '🌸', color: '#FFB7C5', msg: 'Nice work!',    sub: 'Every habit counts!' },
  t2:      { emoji: '✦',  color: '#C8B4E0', msg: 'So good!',     sub: 'You\'re on a roll!' },
  t3:      { emoji: '✿',  color: '#B4E0C8', msg: 'Amazing!!',    sub: 'Level 3 — you crushed it!' },
  bonus:   { emoji: '⭐',  color: '#FFE9A0', msg: 'BONUS!',       sub: 'Lucky bonus round!' },
  jackpot: { emoji: '💎', color: '#FFD700', msg: '💎 JACKPOT!! 💎', sub: 'This almost never happens!' },
}

export default function RewardScreen() {
  const navigate = useNavigate()
  const { session, resetSession, checkMilestones, settings, rewardChain, resetRewardChain } = useStore()
  const { spinResult, coinsEarned, isNearMiss } = session

  // Only a finished spin lands here (SpinScreen/BonusScreen set phase 'reward'
  // before navigating). A typed URL or stale forward-nav has no win to show —
  // bounce home instead of rendering a zero-coin "reward".
  // (Lazy state = a one-time mount snapshot; later phase changes don't re-judge it.)
  const [validEntry] = useState(() => session.phase === 'reward')

  const cfg = RESULT_CFG[spinResult] || RESULT_CFG.t1
  const thisSpin = coinsEarned || TIER_COINS[spinResult] || 0
  // Cumulative across a bonus chain: `total` is the running sum, `prev` the
  // total before this spin. First/normal spin → prev 0, total = thisSpin.
  const total = rewardChain.total > 0 ? rewardChain.total : thisSpin
  const prev = rewardChain.total > 0 ? rewardChain.prev : 0
  // 1:1 — exactly THIS spin's winnings fall (capped at 400 for physics perf)
  const cascadeCount = thisSpin > 0 ? Math.min(thisSpin, 400) : 0
  const coinName = 'coins'
  const moneyVal = settings?.moneyPerCoin ? (total * settings.moneyPerCoin).toFixed(2) : null
  const timeVal = settings?.secondsPerCoin ? formatTime(total * settings.secondsPerCoin) : null
  const timeActivity = settings?.timeActivity || 'free time'

  const [showJackpotToast, setShowJackpotToast] = useState(() => spinResult === 'jackpot' && session.phase === 'reward')
  const [newMilestones, setNewMilestones] = useState([])
  const [canLeave, setCanLeave] = useState(false)

  useEffect(() => {
    if (!validEntry) {
      navigate('/', { replace: true })
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount ritual: the milestone check mutates the store exactly once per reward view
    setNewMilestones(checkMilestones())
    playReward()
    fireRewardConfetti(spinResult)
    // Prevent click-bleed from the SpinScreen's "TAP TO SEE REWARDS" button
    // firing immediately on the "BACK TO HABITS" button at the same position
    const t = setTimeout(() => setCanLeave(true), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: confetti + milestone check must not re-fire on store updates
  }, [])

  function handleDone() {
    resetRewardChain()   // a non-bonus exit ends the chain — next spin starts fresh
    resetSession()
    navigate('/')
  }

  if (!validEntry) return null   // redirecting home (guard effect above)

  return (
    <div style={{
      minHeight: '100%',
      padding: '32px 20px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
      // Intentionally NOT position:relative. The coin cascade is an
      // absolute/inset:0 overlay; with no positioned root it anchors to .screen
      // (the next positioned ancestor) and fills the FULL card — including
      // .screen's bottom padding reserved for the hidden nav. If this div were
      // relative, the cascade floor would stop ~108px above the true bottom and
      // coins would pile up on an invisible ledge. (See CoinCascade3D.)
    }}>
      {/* Falling-coin 3D physics shower — coins shoot out one at a time + pile up */}
      {cascadeCount > 0 && (
        <Suspense fallback={null}><CoinCascade3D count={cascadeCount} /></Suspense>
      )}

      {/* Result badge */}
      <div style={{
        textAlign: 'center',
        animation: 'bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ fontSize: 56, marginBottom: 8, lineHeight: 1 }}>{cfg.emoji}</div>
        <h2 style={{
          fontFamily: "'Fredoka', cursive",
          fontSize: 36, color: cfg.color,
          textShadow: `2px 2px 0 ${darken(cfg.color, 40)}`,
          marginBottom: 6,
        }}>
          {cfg.msg}
        </h2>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 24, color: '#7B5EA7' }}>
          {cfg.sub}
        </div>
        {isNearMiss && (
          <div style={{
            fontFamily: 'Mulish, sans-serif', fontSize: 21, color: '#FF85A1',
            marginTop: 4, fontStyle: 'italic',
          }}>
            (so close to a higher level!)
          </div>
        )}
      </div>

      {/* Tier badge */}
      <TierBadge tier={spinResult || 't1'} style={{ transform: 'scale(1.4)' }} />

      {/* Coins card */}
      <PixelPanel color="yellow" style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Fredoka', cursive",
          fontSize: 26, color: '#5C3A00', marginBottom: prev > 0 ? 2 : 8,
        }}>
          {prev > 0 ? '✨ RUNNING TOTAL ✨' : 'COINS EARNED'}
        </div>
        {prev > 0 && (
          <div style={{
            fontFamily: "'Fredoka', cursive", fontSize: 20, color: '#1A5C3A', marginBottom: 4,
            animation: 'bounce-in 0.5s 0.15s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            + {thisSpin} this spin!
          </div>
        )}
        <div style={{
          fontFamily: "'Fredoka', cursive",
          fontSize: 36, color: '#5C3A00', marginBottom: 4,
        }}>
          <CoinCounter from={prev} to={total} duration={spinResult === 'jackpot' ? 2200 : 1400} /> {coinName}
        </div>
        {total > 0 && moneyVal && (
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#7B5EA7' }}>
            = ${moneyVal} guilt-free spending
          </div>
        )}
        {total > 0 && timeVal && (
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#7B5EA7' }}>
            = {timeVal} of {timeActivity}
          </div>
        )}
      </PixelPanel>

      {/* New milestones */}
      {newMilestones && newMilestones.length > 0 && (
        <PixelPanel color="mint" style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 27, color: '#1A5C3A', marginBottom: 8 }}>
            🎉 MILESTONE REACHED!
          </div>
          {newMilestones.map(m => (
            <div key={m.id} style={{ fontFamily: 'Mulish, sans-serif', fontSize: 24, color: '#3D2B4F', marginBottom: 4 }}>
              <strong>{m.name}</strong> — {m.prize}
            </div>
          ))}
        </PixelPanel>
      )}

      {spinResult === 'bonus' ? (
        <KawaiiButton variant="gold" size="lg" onClick={() => navigate('/bonus')} disabled={!canLeave} fullWidth style={{ maxWidth: 340 }}>
          ⭐ BONUS ROUND! TAP TO SPIN →
        </KawaiiButton>
      ) : (
        <KawaiiButton variant="primary" size="lg" onClick={handleDone} disabled={!canLeave} fullWidth style={{ maxWidth: 340 }}>
          🏠 BACK TO HABITS
        </KawaiiButton>
      )}

      {showJackpotToast && (
        <VisualNovel
          script={REACTION_JACKPOT}
          onComplete={() => setShowJackpotToast(false)}
          onSkip={() => setShowJackpotToast(false)}
        />
      )}
    </div>
  )
}

// Seconds → "Xs" / "Ym" / "Ym Zs"
function formatTime(totalSec) {
  const s = Math.round(totalSec)
  if (s < 60) return `${s} sec`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem ? `${m} min ${rem} sec` : `${m} min`
}

function darken(hex, amount) {
  try {
    const num = parseInt(hex.replace('#', ''), 16)
    const r = Math.max(0, (num >> 16) - amount)
    const g = Math.max(0, ((num >> 8) & 0xff) - amount)
    const b = Math.max(0, (num & 0xff) - amount)
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  } catch { return '#555' }
}
