import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { KawaiiButton } from '../../components/ui'
import BetBar from '../../components/casino/BetBar'
import Plinko3D from '../../components/Plinko3D'
import { BUCKET_MULTS, GAP } from '../../components/plinkoBoard'
import { playButtonTap, playWin, playNearMiss, playCoinDrop } from '../../engine/sounds'

const MIN_BET = 10
const bucketColor = m => m >= 2 ? '#FF6B6B' : m >= 1.5 ? '#F2933C' : m >= 1 ? '#F2C94C' : m >= 0.7 ? '#C8B4E0' : '#8E7FB0'

export default function PlinkoScreen() {
  const navigate = useNavigate()
  const { getCoinsAvailable, placeBet, settleBet } = useStore()
  const balance = getCoinsAvailable()

  const [betRaw, setBet] = useState(() => Math.min(50, Math.max(MIN_BET, balance)))
  const [phase, setPhase] = useState('betting')   // betting | dropping | landed
  const [drop, setDrop]   = useState({ id: 0, spawnX: 0 })
  const [result, setResult] = useState(null)      // { bucket, mult, win }
  const stakeRef = useRef(0)
  const timeoutRef = useRef(0)
  const settledRef = useRef(false)
  const aliveRef = useRef(true)
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; clearTimeout(timeoutRef.current) } }, [])

  const bet = Math.max(MIN_BET, Math.min(balance, betRaw))
  const tooPoor = balance < MIN_BET
  const dropping = phase === 'dropping'

  // ref-guarded so onLand + the safety timeout can't double-settle (closures are stale)
  function settle(bucket) {
    if (settledRef.current) return
    settledRef.current = true
    clearTimeout(timeoutRef.current)
    const mult = BUCKET_MULTS[bucket] ?? 0.5
    const win = Math.floor(stakeRef.current * mult)
    settleBet(win, 'plinko')
    setResult({ bucket, mult, win })
    setPhase('landed')
    if (mult >= 1) { playWin(mult >= 2 ? 't3' : 't2'); playCoinDrop() } else playNearMiss()
  }

  function dropBall() {
    if (tooPoor || bet < MIN_BET || bet > balance || dropping) return
    if (!placeBet(bet, 'plinko')) return
    settledRef.current = false
    stakeRef.current = bet
    setResult(null)
    setDrop(d => ({ id: d.id + 1, spawnX: (Math.random() - 0.5) * GAP * 0.5 }))
    setPhase('dropping')
    playButtonTap()
    // safety net: if the ball never settles (stuck), resolve at the common center bucket
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => { if (aliveRef.current) settle(Math.floor(BUCKET_MULTS.length / 2)) }, 9000)
  }

  return (
    <div style={{ minHeight: '100%', padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => navigate('/casino')} style={backBtn}>← Lobby</button>
        <div style={balancePill}>{balance.toLocaleString()} 🪙</div>
      </div>

      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#3D2B4F', margin: '6px 0 2px' }}>🎯 Plinko</h2>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 8 }}>
        Drop the marble — real physics decides where it lands.
      </div>

      {/* 3D board */}
      <div style={{ width: '100%', maxWidth: 344, height: 384, borderRadius: 18, overflow: 'hidden', border: '3px solid #E0A800', marginBottom: 8, background: '#2E2142' }}>
        <Plinko3D dropId={drop.id} spawnX={drop.spawnX} onLand={settle} active={dropping} />
      </div>

      {/* bucket multiplier strip (aligned to the 11 buckets) */}
      <div style={{ display: 'flex', gap: 2, width: '100%', maxWidth: 344, marginBottom: 10 }}>
        {BUCKET_MULTS.map((m, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: 6, fontFamily: "'Fredoka', cursive", fontSize: 11,
            background: bucketColor(m), color: '#fff',
            outline: result && result.bucket === i ? '3px solid #3D2B4F' : 'none',
            transform: result && result.bucket === i ? 'translateY(-3px)' : 'none',
          }}>{m}×</div>
        ))}
      </div>

      <div style={{ height: 26, fontFamily: "'Fredoka', cursive", fontSize: 20, marginBottom: 8 }}>
        {phase === 'landed' && (result.mult >= 1
          ? <span style={{ color: '#5CBFA0' }}>×{result.mult} — won {result.win.toLocaleString()} 🪙</span>
          : <span style={{ color: '#C44B6A' }}>×{result.mult} — got {result.win.toLocaleString()} 🪙 back</span>)}
        {dropping && <span style={{ color: '#9B7EC8' }}>dropping…</span>}
      </div>

      {!dropping && (
        <>
          <BetBar bet={bet} setBet={setBet} balance={balance} min={MIN_BET} />
          <div style={{ marginTop: 16, width: '100%', maxWidth: 420 }}>
            <KawaiiButton variant="primary" size="lg" fullWidth disabled={tooPoor} onClick={dropBall}>
              {tooPoor ? 'NOT ENOUGH COINS' : `🎯 DROP FOR ${bet.toLocaleString()} 🪙`}
            </KawaiiButton>
          </div>
          {tooPoor && (
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginTop: 10, textAlign: 'center' }}>
              Go do a habit to earn more coins 💪
            </div>
          )}
        </>
      )}
    </div>
  )
}

const backBtn = {
  fontFamily: 'Mulish, sans-serif', fontSize: 15, fontWeight: 700, color: '#7B5EA7',
  background: 'rgba(255,255,255,0.7)', border: '2px solid #D8C4EC', borderRadius: 12, padding: '6px 12px', cursor: 'pointer',
}
const balancePill = {
  fontFamily: "'Fredoka', cursive", fontSize: 18, color: '#E0A800',
  background: '#FFF5F9', border: '2px solid #ECC0DE', borderRadius: 12, padding: '4px 12px',
}
