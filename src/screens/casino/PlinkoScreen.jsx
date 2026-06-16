import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { KawaiiButton } from '../../components/ui'
import BetBar from '../../components/casino/BetBar'
import { PLINKO_ROWS, PLINKO_BUCKETS, PLINKO_RISKS, PLINKO_TABLES, dropBall, plinkoMultiplier } from '../../engine/casino/plinko'
import { playButtonTap, playWin, playNearMiss, playCoinDrop } from '../../engine/sounds'

const MIN_BET = 10

const bucketColor = m =>
  m >= 10 ? '#FF6B6B' : m >= 3 ? '#F2933C' : m >= 1.5 ? '#F2C94C' : m >= 1 ? '#C8B4E0' : '#B8C0CC'

export default function PlinkoScreen() {
  const navigate = useNavigate()
  const { getCoinsAvailable, placeBet, settleBet } = useStore()
  const balance = getCoinsAvailable()

  const [betRaw, setBet] = useState(() => Math.min(50, Math.max(MIN_BET, balance)))
  const [risk, setRisk]  = useState('medium')
  const [phase, setPhase] = useState('betting')   // betting | dropping | landed
  const [ball, setBall]  = useState({ top: 0, left: 50 })
  const [result, setResult] = useState(null)      // { bucket, mult, win }
  const timerRef = useRef(0)
  const aliveRef = useRef(true)
  useEffect(() => () => { aliveRef.current = false; clearTimeout(timerRef.current) }, [])

  const bet = Math.max(MIN_BET, Math.min(balance, betRaw))
  const tooPoor = balance < MIN_BET
  const table = PLINKO_TABLES[risk]

  function drop() {
    if (tooPoor || bet < MIN_BET || bet > balance || phase === 'dropping') return
    if (!placeBet(bet, 'plinko')) return
    const { bucket } = dropBall()
    const mult = plinkoMultiplier(risk, bucket)
    const win = Math.floor(bet * mult)
    setResult(null)
    setBall({ top: 0, left: 50 })
    setPhase('dropping')
    playButtonTap()
    // let the reset paint, then animate to the bucket
    requestAnimationFrame(() => setBall({ top: 82, left: (bucket + 0.5) / PLINKO_BUCKETS * 100 }))
    timerRef.current = setTimeout(() => {
      if (!aliveRef.current) return
      settleBet(win, 'plinko')
      setResult({ bucket, mult, win })
      setPhase('landed')
      if (mult >= 1) { playWin(mult >= 5 ? 't3' : mult >= 2 ? 't2' : 't1'); playCoinDrop() } else playNearMiss()
    }, 1350)
  }

  function again() { setPhase('betting'); setResult(null); setBall({ top: 0, left: 50 }) }

  return (
    <div style={{ minHeight: '100%', padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => navigate('/casino')} style={backBtn}>← Lobby</button>
        <div style={balancePill}>{balance.toLocaleString()} 🪙</div>
      </div>

      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#3D2B4F', margin: '6px 0 2px' }}>🎯 Plinko</h2>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 10 }}>
        Drop the bead. The edges pay huge — the middle, not so much.
      </div>

      {phase === 'betting' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {PLINKO_RISKS.map(r => (
            <button key={r.key} type="button" onClick={() => { setRisk(r.key); playButtonTap() }} style={modeBtn(risk === r.key)}>{r.label}</button>
          ))}
        </div>
      )}

      {/* board */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 360, height: 240, marginBottom: 10 }}>
        {/* pegs */}
        <div style={{ position: 'absolute', inset: '6% 4% 26% 4%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {Array.from({ length: PLINKO_ROWS - 2 }).map((_, r) => (
            <div key={r} style={{ display: 'flex', justifyContent: 'center', gap: `${4 + r * 0.4}%` }}>
              {Array.from({ length: r + 3 }).map((__, p) => (
                <div key={p} style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9B6E6', opacity: 0.7 }} />
              ))}
            </div>
          ))}
        </div>
        {/* ball */}
        <div style={{
          position: 'absolute', width: 18, height: 18, borderRadius: '50%', marginLeft: -9,
          top: `${ball.top}%`, left: `${ball.left}%`,
          background: 'radial-gradient(circle at 35% 30%, #FFF 0%, #FF9ECF 55%, #E0508F 100%)',
          boxShadow: '0 2px 6px rgba(200,60,120,0.5)',
          transition: phase === 'dropping' ? 'top 1.3s cubic-bezier(0.45,0,0.7,1), left 1.3s ease-in-out' : 'none',
          opacity: phase === 'betting' ? 0 : 1,
        }} />
        {/* buckets */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', gap: 2 }}>
          {table.map((m, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: 6,
              background: bucketColor(m), color: '#fff',
              fontFamily: "'Fredoka', cursive", fontSize: 9.5, lineHeight: 1.1,
              outline: result && result.bucket === i ? '3px solid #3D2B4F' : 'none',
              transform: result && result.bucket === i ? 'translateY(-3px)' : 'none',
            }}>{m}×</div>
          ))}
        </div>
      </div>

      <div style={{ height: 26, fontFamily: "'Fredoka', cursive", fontSize: 20, marginBottom: 8 }}>
        {phase === 'landed' && (result.mult >= 1
          ? <span style={{ color: '#5CBFA0' }}>×{result.mult} — won {result.win.toLocaleString()} 🪙</span>
          : <span style={{ color: '#C44B6A' }}>×{result.mult} — got back {result.win.toLocaleString()} 🪙</span>)}
      </div>

      {phase !== 'dropping' && (
        <>
          <BetBar bet={bet} setBet={setBet} balance={balance} min={MIN_BET} />
          <div style={{ marginTop: 16, width: '100%', maxWidth: 420 }}>
            <KawaiiButton variant="primary" size="lg" fullWidth disabled={tooPoor} onClick={phase === 'landed' ? again : drop}>
              {phase === 'landed' ? '↻ DROP AGAIN' : (tooPoor ? 'NOT ENOUGH COINS' : `🎯 DROP FOR ${bet.toLocaleString()} 🪙`)}
            </KawaiiButton>
          </div>
          {tooPoor && phase === 'betting' && (
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
const modeBtn = on => ({
  fontFamily: "'Fredoka', cursive", fontSize: 16, padding: '8px 18px', borderRadius: 12, cursor: 'pointer',
  color: on ? '#fff' : '#7B5EA7', background: on ? '#C8B4E0' : '#F5EDFC', border: `2px solid ${on ? '#8B6BAE' : '#D8C4EC'}`,
})
