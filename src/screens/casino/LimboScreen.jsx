import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { KawaiiButton, CoinIcon } from '../../components/ui'
import BetBar from '../../components/casino/BetBar'
import { rollLimbo, limboWinChance } from '../../engine/casino/limbo'
import { playButtonTap, playWin, playNearMiss, playCoinDrop } from '../../engine/sounds'

const MIN_BET = 10
const PRESETS = [1.5, 2, 3, 5, 10]

export default function LimboScreen() {
  const navigate = useNavigate()
  const { getCoinsAvailable, placeBet, settleBet } = useStore()
  const balance = getCoinsAvailable()

  const [betRaw, setBet]   = useState(() => Math.min(50, Math.max(MIN_BET, balance)))
  const [target, setTarget] = useState('2.00')
  const [phase, setPhase]  = useState('betting')   // betting | rolled
  const [result, setResult] = useState(null)       // { roll, win, target }

  const bet = Math.max(MIN_BET, Math.min(balance, betRaw))
  const tooPoor = balance < MIN_BET
  const t = Number(target)
  const validTarget = t > 1
  const winPct = validTarget ? (limboWinChance(t) * 100) : 0
  const canRoll = !tooPoor && validTarget && bet >= MIN_BET && bet <= balance

  function roll() {
    if (!canRoll) return
    if (!placeBet(bet, 'limbo')) return
    const r = rollLimbo()
    const win = r >= t
    if (win) settleBet(Math.floor(bet * t), 'limbo')
    setResult({ roll: r, win, target: t })
    setPhase('rolled')
    playButtonTap()
    if (win) { playWin(t >= 10 ? 'jackpot' : t >= 5 ? 't3' : t >= 2 ? 't2' : 't1'); playCoinDrop() } else playNearMiss()
  }

  function again() { setPhase('betting'); setResult(null) }

  return (
    <div style={{ minHeight: '100%', padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => navigate('/casino')} style={backBtn}>← Lobby</button>
        <div style={balancePill}>{balance.toLocaleString()} <CoinIcon /></div>
      </div>

      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#3D2B4F', margin: '6px 0 2px' }}>📈 Limbo</h2>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 14 }}>
        Pick a target. Roll over it to win — higher targets pay more but hit less.
      </div>

      {/* result readout */}
      <div style={{
        width: '100%', maxWidth: 420, height: 150, borderRadius: 20, marginBottom: 14,
        background: phase === 'rolled' ? (result.win ? 'radial-gradient(circle,#E4F8EC 0%,#CFEFDB 100%)' : 'radial-gradient(circle,#FFE3EC 0%,#FAD0DD 100%)') : 'radial-gradient(circle,#FFF8FC 0%,#F3ECFB 100%)',
        border: '3px solid #ECC0DE', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 60, lineHeight: 1, color: phase !== 'rolled' ? '#C8B4E0' : result.win ? '#3E9B6A' : '#C44B6A' }}>
          {phase === 'rolled' ? result.roll.toFixed(2) : '—'}×
        </div>
        {phase === 'rolled' && (
          <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 20, marginTop: 4, color: result.win ? '#3E9B6A' : '#C44B6A' }}>
            {result.win ? <>✅ Won {Math.floor(bet * result.target).toLocaleString()} <CoinIcon /></> : <>💥 Needed ≥ {result.target}× — lost {bet.toLocaleString()} <CoinIcon /></>}
          </div>
        )}
      </div>

      {phase === 'betting' && (
        <>
          <div style={{ width: '100%', maxWidth: 420, marginBottom: 10 }}>
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, fontWeight: 700, color: '#7B5EA7', textAlign: 'center', marginBottom: 6 }}>
              TARGET — win chance {winPct.toFixed(1)}%
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
              <input
                type="number" min={1.01} step={0.1} value={target} onChange={e => setTarget(e.target.value)}
                style={{ width: 110, fontFamily: "'Fredoka', cursive", fontSize: 26, textAlign: 'center', padding: '6px 8px', border: '2px solid #D8C4EC', borderRadius: 12, background: '#FFF5F9', color: '#7B5EA7', outline: 'none' }}
              />
              <span style={{ fontFamily: "'Fredoka', cursive", fontSize: 26, color: '#7B5EA7' }}>×</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {PRESETS.map(p => (
                <button key={p} type="button" onClick={() => { setTarget(p.toFixed(2)); playButtonTap() }} style={preset(Number(target) === p)}>{p}×</button>
              ))}
            </div>
          </div>
          <BetBar bet={bet} setBet={setBet} balance={balance} min={MIN_BET} />
          <div style={{ marginTop: 16, width: '100%', maxWidth: 420 }}>
            <KawaiiButton variant="primary" size="lg" fullWidth disabled={!canRoll} onClick={roll}>
              {tooPoor ? 'NOT ENOUGH COINS' : !validTarget ? 'PICK A TARGET > 1×' : <>📈 ROLL FOR {bet.toLocaleString()} <CoinIcon /></>}
            </KawaiiButton>
          </div>
          {tooPoor && (
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginTop: 10, textAlign: 'center' }}>
              Go do a habit to earn more coins 💪
            </div>
          )}
        </>
      )}

      {phase === 'rolled' && (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <KawaiiButton variant="primary" size="lg" fullWidth onClick={again}>↻ ROLL AGAIN</KawaiiButton>
        </div>
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
const preset = on => ({
  flex: 1, fontFamily: "'Fredoka', cursive", fontSize: 15, padding: '7px 0', borderRadius: 10, cursor: 'pointer',
  color: on ? '#fff' : '#7B5EA7', background: on ? '#C8B4E0' : '#F5EDFC', border: `2px solid ${on ? '#8B6BAE' : '#D8C4EC'}`,
})
