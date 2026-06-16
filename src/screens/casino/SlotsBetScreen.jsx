import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { KawaiiButton } from '../../components/ui'
import BetBar from '../../components/casino/BetBar'
import { SLOT_SYMBOLS, spinSlots } from '../../engine/casino/slots'
import { playButtonTap, playWin, playNearMiss, playCoinDrop, playReelStop } from '../../engine/sounds'

const MIN_BET = 10
const SYM = SLOT_SYMBOLS.map(s => s.e)

export default function SlotsBetScreen() {
  const navigate = useNavigate()
  const { getCoinsAvailable, placeBet, settleBet } = useStore()
  const balance = getCoinsAvailable()

  const [betRaw, setBet] = useState(() => Math.min(50, Math.max(MIN_BET, balance)))
  const [phase, setPhase] = useState('betting')   // betting | spinning | done
  const [reels, setReels] = useState([0, 1, 2])
  const [result, setResult] = useState(null)      // { mult, win, win3 }
  const timerRef = useRef(0)
  const aliveRef = useRef(true)
  useEffect(() => () => { aliveRef.current = false; clearTimeout(timerRef.current) }, [])

  const bet = Math.max(MIN_BET, Math.min(balance, betRaw))
  const tooPoor = balance < MIN_BET

  function spin() {
    if (tooPoor || bet < MIN_BET || bet > balance || phase === 'spinning') return
    if (!placeBet(bet, 'slots')) return
    const r = spinSlots()
    const win = Math.floor(bet * r.mult)
    setResult(null); setPhase('spinning'); playButtonTap()
    timerRef.current = setTimeout(() => {
      if (!aliveRef.current) return
      setReels(r.reels); playReelStop()
      settleBet(win, 'slots')
      setResult({ mult: r.mult, win, win3: r.win3 })
      setPhase('done')
      if (r.win3) { playWin(r.mult >= 130 ? 't3' : r.mult >= 40 ? 't2' : 't1'); playCoinDrop() } else playNearMiss()
    }, 900)
  }

  function again() { setPhase('betting'); setResult(null) }

  const spinning = phase === 'spinning'

  return (
    <div style={{ minHeight: '100%', padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <style>{`@keyframes slot-buzz{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => navigate('/casino')} style={backBtn}>← Lobby</button>
        <div style={balancePill}>{balance.toLocaleString()} 🪙</div>
      </div>

      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#3D2B4F', margin: '6px 0 2px' }}>🎰 Slots</h2>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 14 }}>
        Match three to win. Rarer symbols pay way more.
      </div>

      {/* reels */}
      <div style={{
        display: 'flex', gap: 10, padding: '18px 18px', marginBottom: 12, borderRadius: 20,
        background: 'linear-gradient(180deg,#3D2B4F 0%,#5A4072 100%)', border: '4px solid #E0A800',
        boxShadow: '0 6px 0 #B07A00, inset 0 2px 8px rgba(0,0,0,0.4)',
      }}>
        {reels.map((s, i) => (
          <div key={i} style={{
            width: 76, height: 86, borderRadius: 12, background: '#FFF8FC',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 46,
            border: result?.win3 ? '3px solid #F2C94C' : '3px solid #C8B4E0',
            animation: spinning ? 'slot-buzz 0.28s linear infinite' : 'none',
          }}>
            {spinning ? '🎰' : SYM[s]}
          </div>
        ))}
      </div>

      <div style={{ height: 28, fontFamily: "'Fredoka', cursive", fontSize: 20, marginBottom: 8 }}>
        {phase === 'done' && (result.win3
          ? <span style={{ color: '#5CBFA0' }}>{SYM[reels[0]]}×3 — won {result.win.toLocaleString()} 🪙 (×{result.mult})</span>
          : <span style={{ color: '#C44B6A' }}>No match — lost {bet.toLocaleString()} 🪙</span>)}
      </div>

      {phase !== 'spinning' && (
        <>
          <BetBar bet={bet} setBet={setBet} balance={balance} min={MIN_BET} />
          <div style={{ marginTop: 16, width: '100%', maxWidth: 420 }}>
            <KawaiiButton variant="primary" size="lg" fullWidth disabled={tooPoor} onClick={phase === 'done' ? again : spin}>
              {phase === 'done' ? '↻ SPIN AGAIN' : (tooPoor ? 'NOT ENOUGH COINS' : `🎰 SPIN FOR ${bet.toLocaleString()} 🪙`)}
            </KawaiiButton>
          </div>
          {/* paytable */}
          <div style={{ marginTop: 14, width: '100%', maxWidth: 420, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 14px' }}>
            {SLOT_SYMBOLS.map(s => (
              <span key={s.e} style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#7B5EA7' }}>
                {s.e}{s.e}{s.e} <strong>×{s.pay}</strong>
              </span>
            ))}
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
