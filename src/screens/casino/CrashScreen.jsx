import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { KawaiiButton, CoinIcon } from '../../components/ui'
import BetBar from '../../components/casino/BetBar'
import { rollCrashPoint, crashMultiplierAt } from '../../engine/casino/crash'
import { playButtonTap, playWin, playNearMiss, playWheelTick } from '../../engine/sounds'

const MIN_BET = 10

export default function CrashScreen() {
  const navigate = useNavigate()
  const { getCoinsAvailable, placeBet, settleBet } = useStore()
  const balance = getCoinsAvailable()

  const [betRaw, setBet] = useState(() => Math.min(50, Math.max(MIN_BET, balance)))
  const [auto, setAuto]  = useState('')              // optional auto-cashout target (string)
  const [phase, setPhase] = useState('betting')      // betting | running | cashed | busted
  const [mult, setMult]   = useState(1)
  const [outcome, setOutcome] = useState(null)       // { win, at }

  const rafRef   = useRef(0)
  const startRef = useRef(0)
  const bustRef  = useRef(0)
  const autoRef  = useRef(0)
  const [staked, setStaked] = useState(0)             // stake snapshot at launch (avoids re-clamped bet)
  const tickRef  = useRef(1)                          // last integer multiplier we ticked a sound for
  const aliveRef = useRef(true)
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; cancelAnimationFrame(rafRef.current) } }, [])

  // Effective bet, derived (not an effect) so it stays affordable as the balance moves.
  const bet = Math.max(MIN_BET, Math.min(balance, betRaw))
  const tooPoor = balance < MIN_BET
  const canLaunch = phase === 'betting' && !tooPoor && bet >= MIN_BET && bet <= balance

  function frame() {
    if (!aliveRef.current) return
    const t = (performance.now() - startRef.current) / 1000
    const m = crashMultiplierAt(t)
    if (m >= bustRef.current) { setMult(bustRef.current); endBust(); return }
    if (autoRef.current > 1 && m >= autoRef.current) { cashOut(autoRef.current); return }
    if (Math.floor(m) > tickRef.current) { tickRef.current = Math.floor(m); playWheelTick() }
    setMult(m)
    rafRef.current = requestAnimationFrame(frame)
  }

  function launch() {
    if (!canLaunch) return
    if (!placeBet(bet, 'crash')) return
    setStaked(bet)
    bustRef.current = rollCrashPoint()
    autoRef.current = Number(auto) > 1 ? Number(auto) : 0
    startRef.current = performance.now()
    tickRef.current = 1
    setMult(1); setOutcome(null); setPhase('running')
    playButtonTap()
    rafRef.current = requestAnimationFrame(frame)
  }

  function cashOut(forcedAt) {
    cancelAnimationFrame(rafRef.current)
    const t = (performance.now() - startRef.current) / 1000
    const at = Math.min(forcedAt || crashMultiplierAt(t), bustRef.current)
    const win = Math.floor(staked * at)
    settleBet(win, 'crash')
    setMult(at); setOutcome({ win, at }); setPhase('cashed')
    playWin(at >= 10 ? 'jackpot' : at >= 3 ? 't3' : at >= 1.8 ? 't2' : 't1')
  }

  function endBust() {
    cancelAnimationFrame(rafRef.current)
    setOutcome({ win: 0, at: bustRef.current }); setPhase('busted')
    playNearMiss()
  }

  function reset() { setPhase('betting'); setMult(1); setOutcome(null) }

  const running = phase === 'running'
  const multColor = phase === 'busted' ? '#C44B6A' : phase === 'cashed' ? '#5CBFA0'
    : mult >= 4 ? '#FF6B9D' : mult >= 2 ? '#F2933C' : '#7B5EA7'

  return (
    <div style={{ minHeight: '100%', padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => navigate('/casino')} style={backBtn}>← Lobby</button>
        <div style={balancePill}>{balance.toLocaleString()} <CoinIcon /></div>
      </div>

      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#3D2B4F', margin: '6px 0 2px' }}>🚀 Crash</h2>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 8 }}>
        Cash out before it blows. The longer you wait, the bigger — and riskier.
      </div>

      {/* multiplier readout */}
      <div style={{
        width: '100%', maxWidth: 420, height: 170, borderRadius: 20, marginBottom: 14,
        background: phase === 'busted' ? 'radial-gradient(circle, #FFE3EC 0%, #FAD0DD 100%)' : 'radial-gradient(circle, #FFF8FC 0%, #F3ECFB 100%)',
        border: '3px solid #ECC0DE', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 64, color: multColor, lineHeight: 1, transition: 'color 150ms' }}>
          {(phase === 'betting' ? 1 : mult).toFixed(2)}×
        </div>
        {running && <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 15, color: '#7B5EA7', marginTop: 6 }}>
          cash out = {Math.floor(staked * mult).toLocaleString()} <CoinIcon />
        </div>}
        {phase === 'busted' && <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#C44B6A', marginTop: 4 }}>💥 CRASHED — lost {staked.toLocaleString()} <CoinIcon /></div>}
        {phase === 'cashed' && <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#5CBFA0', marginTop: 4 }}>✅ Banked {outcome.win.toLocaleString()} <CoinIcon /></div>}
      </div>

      {running && (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <KawaiiButton variant="gold" size="lg" fullWidth onClick={() => cashOut()}>
            💰 CASH OUT {Math.floor(staked * mult).toLocaleString()} <CoinIcon />
          </KawaiiButton>
        </div>
      )}

      {(phase === 'betting' || phase === 'cashed' || phase === 'busted') && (
        <>
          {phase === 'betting' && (
            <div style={{ width: '100%', maxWidth: 420, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#7B5EA7' }}>Auto cash-out at</span>
              <input
                type="number" min={1.01} step={0.1} placeholder="—"
                value={auto} onChange={e => setAuto(e.target.value)}
                style={{ width: 70, fontFamily: 'Mulish, sans-serif', fontSize: 16, textAlign: 'center', padding: '6px 8px', border: '2px solid #D8C4EC', borderRadius: 10, background: '#FFF5F9', color: '#3D2B4F', outline: 'none' }}
              />
              <span style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#7B5EA7' }}>× (optional)</span>
            </div>
          )}
          <BetBar bet={bet} setBet={setBet} balance={balance} min={MIN_BET} />
          <div style={{ marginTop: 16, width: '100%', maxWidth: 420 }}>
            <KawaiiButton variant="primary" size="lg" fullWidth disabled={phase === 'betting' && !canLaunch} onClick={phase === 'betting' ? launch : reset}>
              {phase === 'betting'
                ? (tooPoor ? 'NOT ENOUGH COINS' : <>🚀 LAUNCH FOR {bet.toLocaleString()} <CoinIcon /></>)
                : '↻ PLAY AGAIN'}
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
