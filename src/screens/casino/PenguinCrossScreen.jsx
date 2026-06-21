import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { KawaiiButton, CoinIcon } from '../../components/ui'
import BetBar from '../../components/casino/BetBar'
import { CROSS_MODES, crossMultiplier, crossSurvive } from '../../engine/casino/cross'
import { playButtonTap, playWin, playNearMiss, playCoinDrop } from '../../engine/sounds'

const MIN_BET = 10

export default function PenguinCrossScreen() {
  const navigate = useNavigate()
  const { getCoinsAvailable, placeBet, settleBet } = useStore()
  const balance = getCoinsAvailable()

  const [betRaw, setBet] = useState(() => Math.min(50, Math.max(MIN_BET, balance)))
  const [mode, setMode]  = useState('medium')
  const [phase, setPhase] = useState('betting')   // betting | crossing | cashed | hit
  const [lane, setLane]   = useState(0)           // current safe lane (0 = start curb)
  const [deathLane, setDeathLane] = useState(-1)
  const [outcome, setOutcome] = useState(null)    // { win, mult }
  const trackRef = useRef(null)
  const penRef   = useRef(null)
  const [staked, setStaked] = useState(0)

  const bet = Math.max(MIN_BET, Math.min(balance, betRaw))
  const tooPoor = balance < MIN_BET
  const cfg = CROSS_MODES[mode]
  const lanes = cfg.lanes

  // keep the penguin in view as it advances (DOM scroll — not a state effect)
  useEffect(() => { penRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }) }, [lane, phase])

  function start() {
    if (tooPoor || bet < MIN_BET || bet > balance) return
    if (!placeBet(bet, 'cross')) return
    setStaked(bet)
    setLane(0); setDeathLane(-1); setOutcome(null); setPhase('crossing')
    playButtonTap()
  }

  function cross() {
    if (crossSurvive(mode)) {
      const next = lane + 1
      setLane(next)
      playButtonTap()
      if (next >= lanes) finishCash(next)   // made it all the way → auto cash at the top
    } else {
      setDeathLane(lane + 1)
      setPhase('hit')
      playNearMiss()
    }
  }

  function finishCash(atLane) {
    const l = atLane ?? lane
    const mult = crossMultiplier(mode, l)
    const win = Math.floor(staked * mult)
    settleBet(win, 'cross')
    setOutcome({ win, mult })
    setPhase('cashed')
    playWin(mult >= 10 ? 'jackpot' : mult >= 3 ? 't3' : mult >= 1.8 ? 't2' : 't1')
    playCoinDrop()
  }

  function reset() { setPhase('betting'); setLane(0); setDeathLane(-1); setOutcome(null) }

  const crossing = phase === 'crossing'
  const curMult  = lane >= 1 ? crossMultiplier(mode, lane) : 0
  const nextMult = crossMultiplier(mode, Math.min(lane + 1, lanes))

  return (
    <div style={{ minHeight: '100%', padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => navigate('/casino')} style={backBtn}>← Lobby</button>
        <div style={balancePill}>{balance.toLocaleString()} <CoinIcon /></div>
      </div>

      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#3D2B4F', margin: '6px 0 2px' }}>🐧 Penguin Cross</h2>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 10 }}>
        Cross another lane for more — but one wrong step and it&apos;s gone.
      </div>

      {/* difficulty (betting only) */}
      {phase === 'betting' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {Object.values(CROSS_MODES).map(m => (
            <button key={m.key} type="button" onClick={() => { setMode(m.key); playButtonTap() }} style={modeBtn(mode === m.key)}>
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
      )}

      {/* the crossing track */}
      <div ref={trackRef} style={{
        width: '100%', maxWidth: 460, overflowX: 'auto', display: 'flex', gap: 6, padding: '12px 4px',
        background: 'linear-gradient(180deg, #EAF4FF 0%, #DCEcFB 100%)', border: '3px solid #C9DEF5', borderRadius: 18, marginBottom: 12,
      }}>
        {Array.from({ length: lanes + 1 }).map((_, i) => {
          const isStart = i === 0
          const here = i === lane
          const crossed = i < lane && !isStart
          const isNext = crossing && i === lane + 1
          const died = phase === 'hit' && i === deathLane
          return (
            <div
              key={i}
              ref={here ? penRef : null}
              style={{
                flexShrink: 0, width: 56, height: 84, borderRadius: 12,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                background: isStart ? '#CFE8D4' : died ? '#FAD0DD' : crossed ? '#D6F0DE' : isNext ? '#FFF4CF' : '#FFFFFF',
                border: `2px solid ${isNext ? '#F2C94C' : died ? '#E48FAE' : '#D8E6F5'}`,
              }}
            >
              {isStart ? (
                <div style={{ fontSize: 26 }}>{here ? '🐧' : '🏁'}</div>
              ) : (
                <>
                  <div style={{ fontSize: 26, lineHeight: 1 }}>{here ? '🐧' : died ? '💥' : crossed ? '✅' : cfg.emoji}</div>
                  <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 13, color: crossed ? '#3E9B6A' : '#7B5EA7' }}>
                    ×{crossMultiplier(mode, i)}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* status line */}
      <div style={{ height: 28, fontFamily: "'Fredoka', cursive", fontSize: 20, marginBottom: 8 }}>
        {crossing && lane >= 1 && <span style={{ color: '#5CBFA0' }}>Cash out = {Math.floor(staked * curMult).toLocaleString()} <CoinIcon /> (×{curMult})</span>}
        {crossing && lane === 0 && <span style={{ color: '#7B5EA7' }}>Next lane pays ×{nextMult}</span>}
        {phase === 'cashed' && <span style={{ color: '#5CBFA0' }}>✅ Safe! Banked {outcome.win.toLocaleString()} <CoinIcon /> (×{outcome.mult})</span>}
        {phase === 'hit' && <span style={{ color: '#C44B6A' }}>💥 Splat! Lost {staked.toLocaleString()} <CoinIcon /></span>}
      </div>

      {crossing && (
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <KawaiiButton variant="primary" size="lg" fullWidth onClick={cross}>
            🐧 CROSS → ×{nextMult}
          </KawaiiButton>
          <KawaiiButton variant="gold" size="md" fullWidth disabled={lane < 1} onClick={() => finishCash()}>
            {lane < 1 ? 'CROSS AT LEAST ONE LANE' : <>💰 CASH OUT {Math.floor(staked * curMult).toLocaleString()} <CoinIcon /></>}
          </KawaiiButton>
        </div>
      )}

      {(phase === 'betting' || phase === 'cashed' || phase === 'hit') && (
        <>
          <BetBar bet={bet} setBet={setBet} balance={balance} min={MIN_BET} />
          <div style={{ marginTop: 16, width: '100%', maxWidth: 420 }}>
            <KawaiiButton variant="primary" size="lg" fullWidth disabled={tooPoor} onClick={phase === 'betting' ? start : reset}>
              {phase === 'betting' ? (tooPoor ? 'NOT ENOUGH COINS' : <>🐧 START FOR {bet.toLocaleString()} <CoinIcon /></>) : '↻ PLAY AGAIN'}
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
  fontFamily: "'Fredoka', cursive", fontSize: 16, padding: '8px 16px', borderRadius: 12, cursor: 'pointer',
  color: on ? '#fff' : '#7B5EA7', background: on ? '#C8B4E0' : '#F5EDFC',
  border: `2px solid ${on ? '#8B6BAE' : '#D8C4EC'}`, boxShadow: on ? '0 3px 0 #8B6BAE' : 'none',
})
