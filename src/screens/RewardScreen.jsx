import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import useStore from '../store/useStore'
import { TIER_COINS } from '../engine/gameLogic'
import { KawaiiButton, TierBadge, PixelPanel } from '../components/ui'

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

function CoinCounter({ to, duration = 1400 }) {
  const [value, setValue] = useState(0)
  const [landed, setLanded] = useState(false)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!to) { setValue(0); setLanded(true); return }
    const start = performance.now()
    function tick(now) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(to * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else setLanded(true)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => rafRef.current && cancelAnimationFrame(rafRef.current)
  }, [to, duration])

  return (
    <span style={{
      display: 'inline-block',
      transition: 'transform 240ms cubic-bezier(0.34,1.56,0.64,1)',
      transform: landed ? 'scale(1.15)' : 'scale(1)',
      textShadow: landed ? '0 0 12px rgba(255,215,0,0.7)' : 'none',
    }}>
      +{value}
    </span>
  )
}

const RESULT_CFG = {
  t1:      { emoji: '🌸', color: '#FFB7C5', msg: 'Nice work!',    sub: 'Every habit counts!' },
  t2:      { emoji: '✦',  color: '#C8B4E0', msg: 'So good!',     sub: 'You\'re on a roll!' },
  t3:      { emoji: '✿',  color: '#B4E0C8', msg: 'Amazing!!',    sub: 'Tier 3 — you crushed it!' },
  bonus:   { emoji: '⭐',  color: '#FFE9A0', msg: 'BONUS!',       sub: 'Lucky bonus round!' },
  jackpot: { emoji: '💎', color: '#FFD700', msg: '💎 JACKPOT!! 💎', sub: 'This almost never happens!' },
}

export default function RewardScreen() {
  const navigate = useNavigate()
  const { session, resetSession, checkMilestones, settings, getCoinsAvailable } = useStore()
  const { spinResult, coinsEarned, isNearMiss, pullHistory } = session

  const cfg = RESULT_CFG[spinResult] || RESULT_CFG.t1
  const coins = coinsEarned || TIER_COINS[spinResult] || 0
  const coinName = 'coins'
  const moneyVal = settings?.moneyPerCoin ? (coins * settings.moneyPerCoin).toFixed(2) : null
  const timeVal = settings?.secondsPerCoin ? formatTime(coins * settings.secondsPerCoin) : null
  const timeActivity = settings?.timeActivity || 'free time'

  const [newMilestones, setNewMilestones] = useState([])
  const [canLeave, setCanLeave] = useState(false)

  useEffect(() => {
    setNewMilestones(checkMilestones())
    fireRewardConfetti(spinResult)
    // Prevent click-bleed from the SpinScreen's "TAP TO SEE REWARDS" button
    // firing immediately on the "BACK TO HABITS" button at the same position
    const t = setTimeout(() => setCanLeave(true), 600)
    return () => clearTimeout(t)
  }, [])

  function handleDone() {
    resetSession()
    navigate('/')
  }

  return (
    <div style={{
      minHeight: '100%',
      padding: '32px 20px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
    }}>
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
            (so close to a higher tier!)
          </div>
        )}
      </div>

      {/* Tier badge */}
      <TierBadge tier={spinResult || 't1'} style={{ transform: 'scale(1.4)' }} />

      {/* Coins card */}
      <PixelPanel color="yellow" style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Fredoka', cursive",
          fontSize: 27, color: '#5C3A00', marginBottom: 8,
        }}>
          COINS EARNED
        </div>
        <div style={{
          fontFamily: "'Fredoka', cursive",
          fontSize: 34, color: '#5C3A00', marginBottom: 4,
        }}>
          <CoinCounter to={coins} duration={spinResult === 'jackpot' ? 2200 : 1400} /> {coinName}
        </div>
        {coins > 0 && moneyVal && (
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#7B5EA7' }}>
            = ${moneyVal} guilt-free spending
          </div>
        )}
        {coins > 0 && timeVal && (
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#7B5EA7' }}>
            = {timeVal} of {timeActivity}
          </div>
        )}
      </PixelPanel>

      {/* Slot pull history */}
      {pullHistory && pullHistory.length > 0 && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 24, color: '#9B7EC8', marginBottom: 6 }}>
            YOUR 3 PULLS:
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {pullHistory.map((r, i) => (
              <TierBadge key={i} tier={r} />
            ))}
          </div>
        </div>
      )}

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

      <KawaiiButton variant="primary" size="lg" onClick={handleDone} disabled={!canLeave} fullWidth style={{ maxWidth: 340 }}>
        🏠 BACK TO HABITS
      </KawaiiButton>
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
