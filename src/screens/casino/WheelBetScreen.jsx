import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { KawaiiButton, CoinIcon } from '../../components/ui'
import BetBar from '../../components/casino/BetBar'
import { WHEEL_SEGMENTS, spinWheel } from '../../engine/casino/wheel'
import { playButtonTap, playWin, playNearMiss, playCoinDrop, playWheelTick } from '../../engine/sounds'

const MIN_BET = 10
const N = WHEEL_SEGMENTS.length
const SEG = 360 / N
const R = 130, CX = 150, CY = 150

const segColor = m => m === 0 ? '#B6BECC' : m < 1 ? '#C8B4E0' : m < 2 ? '#9BD9B4' : m < 5 ? '#F2C94C' : '#FF6B6B'

function pt(angleDeg, radius) {
  const a = (angleDeg - 90) * Math.PI / 180
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)]
}
function wedgePath(i) {
  const [x0, y0] = pt(i * SEG, R)
  const [x1, y1] = pt((i + 1) * SEG, R)
  return `M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`
}

export default function WheelBetScreen() {
  const navigate = useNavigate()
  const { getCoinsAvailable, placeBet, settleBet } = useStore()
  const balance = getCoinsAvailable()

  const [betRaw, setBet] = useState(() => Math.min(50, Math.max(MIN_BET, balance)))
  const [phase, setPhase] = useState('betting')   // betting | spinning | done
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState(null)      // { mult, win }
  const timerRef = useRef(0)
  const aliveRef = useRef(true)
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; clearTimeout(timerRef.current) } }, [])

  const bet = Math.max(MIN_BET, Math.min(balance, betRaw))
  const tooPoor = balance < MIN_BET

  function spin() {
    if (tooPoor || bet < MIN_BET || bet > balance || phase === 'spinning') return
    if (!placeBet(bet, 'wheel')) return
    const { index, mult } = spinWheel()
    const win = Math.floor(bet * mult)
    const base = Math.ceil(rotation / 360) * 360
    const target = base + 360 * 5 + ((360 - (index * SEG + SEG / 2)) % 360)
    setResult(null); setPhase('spinning'); setRotation(target); playButtonTap()
    timerRef.current = setTimeout(() => {
      if (!aliveRef.current) return
      settleBet(win, 'wheel'); playWheelTick()
      setResult({ mult, win })
      setPhase('done')
      if (mult >= 1) { playWin(mult >= 5 ? 't3' : mult >= 2 ? 't2' : 't1'); playCoinDrop() } else playNearMiss()
    }, 3300)
  }

  function again() { setPhase('betting'); setResult(null) }

  return (
    <div style={{ minHeight: '100%', padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => phase !== 'spinning' && navigate('/casino')} disabled={phase === 'spinning'}
          style={{ ...backBtn, opacity: phase === 'spinning' ? 0.4 : 1, cursor: phase === 'spinning' ? 'default' : 'pointer' }}>← Lobby</button>
        <div style={balancePill}>{balance.toLocaleString()} <CoinIcon /></div>
      </div>

      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#3D2B4F', margin: '6px 0 2px' }}>🎡 Fortune Wheel</h2>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 8 }}>
        Spin for a multiplier — but plenty of slices pay nothing.
      </div>

      {/* wheel */}
      <div style={{ position: 'relative', width: 300, height: 312, marginBottom: 10 }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', marginLeft: -12, fontSize: 26, zIndex: 2 }}>🔻</div>
        <svg viewBox="0 0 300 300" width="300" height="300" style={{ position: 'absolute', top: 12, left: 0 }}>
          <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '150px 150px', transition: phase === 'spinning' ? 'transform 3.2s cubic-bezier(0.18,0.7,0.12,1)' : 'none' }}>
            {WHEEL_SEGMENTS.map((m, i) => {
              const [lx, ly] = pt(i * SEG + SEG / 2, R * 0.64)
              return (
                <g key={i}>
                  <path d={wedgePath(i)} fill={segColor(m)} stroke="#fff" strokeWidth="2" />
                  <text x={lx} y={ly} fill="#fff" fontFamily="'Fredoka', cursive" fontSize="16" fontWeight="700"
                    textAnchor="middle" dominantBaseline="central" transform={`rotate(${i * SEG + SEG / 2} ${lx} ${ly})`}>
                    {m === 0 ? '✕' : `${m}×`}
                  </text>
                </g>
              )
            })}
            <circle cx={CX} cy={CY} r="20" fill="#FFF5F9" stroke="#E0A800" strokeWidth="3" />
          </g>
        </svg>
      </div>

      <div style={{ height: 28, fontFamily: "'Fredoka', cursive", fontSize: 20, marginBottom: 8 }}>
        {phase === 'done' && (result.mult >= 1
          ? <span style={{ color: '#5CBFA0' }}>×{result.mult} — won {result.win.toLocaleString()} <CoinIcon /></span>
          : result.mult > 0
            ? <span style={{ color: '#F2933C' }}>×{result.mult} — got {result.win.toLocaleString()} <CoinIcon /> back</span>
            : <span style={{ color: '#C44B6A' }}>✕ — lost {bet.toLocaleString()} <CoinIcon /></span>)}
      </div>

      {phase !== 'spinning' && (
        <>
          <BetBar bet={bet} setBet={setBet} balance={balance} min={MIN_BET} />
          <div style={{ marginTop: 16, width: '100%', maxWidth: 420 }}>
            <KawaiiButton variant="primary" size="lg" fullWidth disabled={tooPoor} onClick={phase === 'done' ? again : spin}>
              {phase === 'done' ? '↻ SPIN AGAIN' : (tooPoor ? 'NOT ENOUGH COINS' : <>🎡 SPIN FOR {bet.toLocaleString()} <CoinIcon /></>)}
            </KawaiiButton>
          </div>
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
