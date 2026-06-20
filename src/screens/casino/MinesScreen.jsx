import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { KawaiiButton } from '../../components/ui'
import BetBar from '../../components/casino/BetBar'
import { MINES_PRESETS, MINES_TILES, minesMultiplier, placeMines } from '../../engine/casino/mines'
import { playButtonTap, playWin, playNearMiss, playCoinDrop, playCoinTick } from '../../engine/sounds'

const MIN_BET = 10

export default function MinesScreen() {
  const navigate = useNavigate()
  const { getCoinsAvailable, placeBet, settleBet } = useStore()
  const balance = getCoinsAvailable()

  const [betRaw, setBet]   = useState(() => Math.min(50, Math.max(MIN_BET, balance)))
  const [mineCount, setMineCount] = useState(5)
  const [phase, setPhase]  = useState('betting')   // betting | playing | cashed | lost
  const [mines, setMines]  = useState(() => new Set())
  const [revealed, setRevealed] = useState(() => new Set())
  const [hitTile, setHitTile]   = useState(-1)
  const [outcome, setOutcome]   = useState(null)

  const bet = Math.max(MIN_BET, Math.min(balance, betRaw))
  const tooPoor = balance < MIN_BET
  const safeTotal = MINES_TILES - mineCount
  const k = revealed.size
  const curMult  = k >= 1 ? minesMultiplier(mineCount, k) : 0
  const nextMult = minesMultiplier(mineCount, Math.min(k + 1, safeTotal))
  const ended = phase === 'cashed' || phase === 'lost'

  function start() {
    if (tooPoor || bet < MIN_BET || bet > balance) return
    if (!placeBet(bet, 'mines')) return
    setMines(placeMines(mineCount))
    setRevealed(new Set())
    setHitTile(-1); setOutcome(null); setPhase('playing')
    playButtonTap()
  }

  function tapTile(i) {
    if (phase !== 'playing' || revealed.has(i)) return
    if (mines.has(i)) {
      setHitTile(i); setPhase('lost'); playNearMiss()
      return
    }
    const next = new Set(revealed); next.add(i)
    setRevealed(next)
    playCoinTick(next.size)
    if (next.size >= safeTotal) finishCash(next.size)   // cleared the board → auto cash
  }

  function finishCash(count) {
    const n = count ?? k
    const mult = minesMultiplier(mineCount, n)
    const win = Math.floor(bet * mult)
    settleBet(win, 'mines')
    setOutcome({ win, mult }); setPhase('cashed')
    playWin(mult >= 10 ? 'jackpot' : mult >= 3 ? 't3' : mult >= 1.8 ? 't2' : 't1'); playCoinDrop()
  }

  function reset() { setPhase('betting'); setRevealed(new Set()); setHitTile(-1); setOutcome(null) }

  return (
    <div style={{ minHeight: '100%', padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => navigate('/casino')} style={backBtn}>← Lobby</button>
        <div style={balancePill}>{balance.toLocaleString()} 🪙</div>
      </div>

      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#3D2B4F', margin: '6px 0 2px' }}>💣 Mines</h2>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 10 }}>
        Tap gems to climb the multiplier. Hit a bomb and it&apos;s gone.
      </div>

      {phase === 'betting' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {MINES_PRESETS.map(p => (
            <button key={p.mines} type="button" onClick={() => { setMineCount(p.mines); playButtonTap() }} style={modeBtn(mineCount === p.mines)}>
              {p.mines} 💣 {p.label}
            </button>
          ))}
        </div>
      )}

      {/* grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 7, width: '100%', maxWidth: 340, marginBottom: 12 }}>
        {Array.from({ length: MINES_TILES }).map((_, i) => {
          const isMine = mines.has(i)
          const isRev = revealed.has(i)
          const isHit = i === hitTile
          let face, bg = '#EFE7FA', border = '#D8C4EC'
          if (isRev) { face = '💎'; bg = '#D6F0DE'; border = '#9BD9B4' }
          else if (ended && isMine) { face = '💣'; bg = isHit ? '#F7B4C6' : '#FAD9E2'; border = isHit ? '#C44B6A' : '#E9AFC0' }
          else if (ended && !isMine) { face = '💎'; bg = '#F0F6F2'; border = '#D6E6DC' }
          else { face = phase === 'playing' ? '' : '·'; }
          const tappable = phase === 'playing' && !isRev
          return (
            <button
              key={i}
              type="button"
              disabled={!tappable}
              onClick={() => tapTile(i)}
              style={{
                aspectRatio: '1', borderRadius: 12, fontSize: 24, lineHeight: 1,
                background: bg, border: `2px solid ${border}`,
                cursor: tappable ? 'pointer' : 'default',
                opacity: ended && !isRev && !isMine ? 0.5 : 1,
                boxShadow: tappable ? '0 2px 0 #C8B4E0' : 'none',
              }}
            >
              {face}
            </button>
          )
        })}
      </div>

      <div style={{ height: 28, fontFamily: "'Fredoka', cursive", fontSize: 20, marginBottom: 8 }}>
        {phase === 'playing' && k >= 1 && <span style={{ color: '#5CBFA0' }}>Cash out = {Math.floor(bet * curMult).toLocaleString()} 🪙 (×{curMult})</span>}
        {phase === 'playing' && k === 0 && <span style={{ color: '#7B5EA7' }}>First gem pays ×{nextMult}</span>}
        {phase === 'cashed' && <span style={{ color: '#5CBFA0' }}>✅ Banked {outcome.win.toLocaleString()} 🪙 (×{outcome.mult})</span>}
        {phase === 'lost' && <span style={{ color: '#C44B6A' }}>💥 Boom! Lost {bet.toLocaleString()} 🪙</span>}
      </div>

      {phase === 'playing' && (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <KawaiiButton variant="gold" size="lg" fullWidth disabled={k < 1} onClick={() => finishCash()}>
            {k < 1 ? 'REVEAL A GEM FIRST' : `💰 CASH OUT ${Math.floor(bet * curMult).toLocaleString()} 🪙`}
          </KawaiiButton>
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 12.5, color: '#9B7EC8', textAlign: 'center', marginTop: 8 }}>
            {k} gem{k === 1 ? '' : 's'} · next gem → ×{nextMult}
          </div>
        </div>
      )}

      {(phase === 'betting' || ended) && (
        <>
          <BetBar bet={bet} setBet={setBet} balance={balance} min={MIN_BET} />
          <div style={{ marginTop: 16, width: '100%', maxWidth: 420 }}>
            <KawaiiButton variant="primary" size="lg" fullWidth disabled={tooPoor} onClick={phase === 'betting' ? start : reset}>
              {phase === 'betting' ? (tooPoor ? 'NOT ENOUGH COINS' : `💣 START FOR ${bet.toLocaleString()} 🪙`) : '↻ PLAY AGAIN'}
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
  fontFamily: "'Fredoka', cursive", fontSize: 15, padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
  color: on ? '#fff' : '#7B5EA7', background: on ? '#C8B4E0' : '#F5EDFC',
  border: `2px solid ${on ? '#8B6BAE' : '#D8C4EC'}`, boxShadow: on ? '0 3px 0 #8B6BAE' : 'none',
})
