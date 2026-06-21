import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { CoinIcon } from '../../components/ui'
import BetBar from '../../components/casino/BetBar'
import { SLOT_SYMBOLS, spinSlots } from '../../engine/casino/slots'
import CasinoSlots, { SLOT_MAX_SPIN_MS } from '../../components/CasinoSlots'
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
  const [spinId, setSpinId] = useState(0)
  const [result, setResult] = useState(null)      // { mult, win, win3 }
  const [staked, setStaked] = useState(0)         // the amount actually wagered (not the re-clamped live bet)
  const timerRef = useRef(0)
  const aliveRef = useRef(true)
  const pendingRef = useRef(null)     // the spin's result, settled when the reels stop
  const settledRef = useRef(false)
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; clearTimeout(timerRef.current) } }, [])

  const bet = Math.max(MIN_BET, Math.min(balance, betRaw))
  const tooPoor = balance < MIN_BET

  function spin() {
    if (tooPoor || bet < MIN_BET || bet > balance || phase === 'spinning') return
    if (!placeBet(bet, 'slots')) return
    setStaked(bet)
    const r = spinSlots()
    const win = Math.floor(bet * r.mult)
    pendingRef.current = { r, win }
    settledRef.current = false
    setReels(r.reels)                 // the reels spin and land on these
    setSpinId(id => id + 1)           // trigger the cabinet spin
    setResult(null); setPhase('spinning'); playButtonTap()
    // settle on the reels' onSettled; safety net (just past the worst-case spin) if it never fires
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(doSettle, SLOT_MAX_SPIN_MS)
  }

  // ref-guarded so onSettled + the safety timeout can't double-settle
  function doSettle() {
    if (settledRef.current || !aliveRef.current || !pendingRef.current) return
    settledRef.current = true
    clearTimeout(timerRef.current)
    const { r, win } = pendingRef.current
    playReelStop()
    settleBet(win, 'slots')
    setResult({ mult: r.mult, win, win3: r.win3 })
    setPhase('done')
    // 🍒4×/🍋14× small · 🔔40× medium · ⭐130× large · 💎600×/7️⃣2000× JACKPOT (crowd cheer)
    if (r.win3) { playWin(r.mult >= 600 ? 'jackpot' : r.mult >= 130 ? 't3' : r.mult >= 40 ? 't2' : 't1'); playCoinDrop() } else playNearMiss()
  }

  return (
    <div style={{ minHeight: '100%', padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => phase !== 'spinning' && navigate('/casino')} disabled={phase === 'spinning'}
          style={{ ...backBtn, opacity: phase === 'spinning' ? 0.4 : 1, cursor: phase === 'spinning' ? 'default' : 'pointer' }}>← Lobby</button>
        <div style={balancePill}>{balance.toLocaleString()} <CoinIcon /></div>
      </div>

      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#3D2B4F', margin: '6px 0 2px' }}>🎰 Slots</h2>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 14 }}>
        Match three to win. Rarer symbols pay way more.
      </div>

      {/* Real-cabinet slot machine — tap its painted SPIN button to play */}
      <CasinoSlots
        reels={reels}
        spinId={spinId}
        win3={result?.win3 ?? false}
        bet={phase === 'betting' ? bet : staked}
        lastWin={result?.win ?? 0}
        canSpin={phase !== 'spinning' && !tooPoor}
        onSpin={spin}
        onSettled={doSettle}
      />

      <div style={{ height: 28, fontFamily: "'Fredoka', cursive", fontSize: 20, margin: '8px 0' }}>
        {phase === 'done'
          ? (result.win3
              ? <span style={{ color: '#5CBFA0' }}>{SYM[reels[0]]}×3 — won {result.win.toLocaleString()} <CoinIcon /> (×{result.mult})</span>
              : <span style={{ color: '#C44B6A' }}>No match — lost {staked.toLocaleString()} <CoinIcon /></span>)
          : phase === 'spinning'
            ? <span style={{ color: '#9B7EC8' }}>Spinning…</span>
            : tooPoor
              ? <span style={{ color: '#C44B6A' }}>Not enough coins</span>
              : <span style={{ color: '#9B7EC8', fontSize: 16 }}>Set your bet, then tap the machine's ▶ SPIN</span>}
      </div>

      {phase !== 'spinning' && (
        <>
          <BetBar bet={bet} setBet={setBet} balance={balance} min={MIN_BET} />
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
