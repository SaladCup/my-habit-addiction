import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { KawaiiButton } from '../../components/ui'
import BetBar from '../../components/casino/BetBar'
import { RANKS, SUITS, drawCard, hiloMults, hiloWin } from '../../engine/casino/hilo'
import { playButtonTap, playWin, playNearMiss, playCoinDrop, playCoinTick } from '../../engine/sounds'

const MIN_BET = 10
const isRed = suit => suit === 1 || suit === 2   // ♥ ♦

function Card({ card, big }) {
  const red = isRed(card.suit)
  return (
    <div style={{
      width: big ? 104 : 64, height: big ? 144 : 90, borderRadius: 14,
      background: '#FFFDF7', border: '3px solid #E6D8B8', boxShadow: '0 6px 0 #D8C49A, 0 8px 16px rgba(150,120,60,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      fontFamily: "'Fredoka', cursive", color: red ? '#E0466B' : '#3D2B4F',
    }}>
      <div style={{ fontSize: big ? 40 : 26, lineHeight: 1 }}>{RANKS[card.rank]}</div>
      <div style={{ fontSize: big ? 38 : 24, lineHeight: 1 }}>{SUITS[card.suit]}</div>
    </div>
  )
}

export default function HiLoScreen() {
  const navigate = useNavigate()
  const { getCoinsAvailable, placeBet, settleBet } = useStore()
  const balance = getCoinsAvailable()

  const [betRaw, setBet]  = useState(() => Math.min(50, Math.max(MIN_BET, balance)))
  const [phase, setPhase] = useState('betting')   // betting | playing | cashed | lost
  const [card, setCard]   = useState(() => drawCard())
  const [pot, setPot]     = useState(0)
  const [streak, setStreak] = useState(0)

  const bet = Math.max(MIN_BET, Math.min(balance, betRaw))
  const tooPoor = balance < MIN_BET
  const mults = hiloMults(card.rank)

  function deal() {
    if (tooPoor || bet < MIN_BET || bet > balance) return
    if (!placeBet(bet, 'hilo')) return
    setCard(drawCard()); setPot(bet); setStreak(0); setPhase('playing')
    playButtonTap()
  }

  function guess(dir) {
    const draw = drawCard()
    if (hiloWin(dir, card.rank, draw.rank)) {
      const newPot = Math.floor(pot * mults[dir])
      setPot(newPot); setStreak(s => s + 1); setCard(draw)
      playCoinTick(streak)
    } else {
      setCard(draw); setPhase('lost')
      playNearMiss()
    }
  }

  function bank() {
    settleBet(pot, 'hilo'); playWin(pot >= bet * 10 ? 'jackpot' : pot >= bet * 4 ? 't3' : pot >= bet * 2 ? 't2' : 't1'); playCoinDrop()
    setPhase('cashed')
  }
  function reset() { setPhase('betting'); setPot(0); setStreak(0) }

  const playing = phase === 'playing'

  return (
    <div style={{ minHeight: '100%', padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => navigate('/casino')} style={backBtn}>← Lobby</button>
        <div style={balancePill}>{balance.toLocaleString()} 🪙</div>
      </div>

      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#3D2B4F', margin: '6px 0 2px' }}>🎴 Hi-Lo</h2>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 14 }}>
        Higher or lower? A tie wins. Stack the streak, then bank it.
      </div>

      <div style={{ height: 156, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Card card={card} big />
      </div>

      <div style={{ height: 28, fontFamily: "'Fredoka', cursive", fontSize: 20, marginBottom: 8 }}>
        {playing && pot > 0 && <span style={{ color: '#5CBFA0' }}>Pot {pot.toLocaleString()} 🪙{streak > 0 ? `  🔥×${streak}` : ''}</span>}
        {phase === 'cashed' && <span style={{ color: '#5CBFA0' }}>✅ Banked {pot.toLocaleString()} 🪙!</span>}
        {phase === 'lost' && <span style={{ color: '#C44B6A' }}>💔 Missed it — lost {bet.toLocaleString()} 🪙</span>}
      </div>

      {playing && (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <KawaiiButton variant="primary" size="lg" fullWidth onClick={() => guess('higher')}>
              ⬆ Higher · ×{mults.higher}
            </KawaiiButton>
            <KawaiiButton variant="secondary" size="lg" fullWidth onClick={() => guess('lower')}>
              ⬇ Lower · ×{mults.lower}
            </KawaiiButton>
          </div>
          <KawaiiButton variant="gold" size="md" fullWidth disabled={streak < 1} onClick={bank}>
            {streak < 1 ? 'GUESS TO BUILD A POT' : `💰 BANK ${pot.toLocaleString()} 🪙`}
          </KawaiiButton>
        </div>
      )}

      {(phase === 'betting' || phase === 'cashed' || phase === 'lost') && (
        <>
          <BetBar bet={bet} setBet={setBet} balance={balance} min={MIN_BET} />
          <div style={{ marginTop: 16, width: '100%', maxWidth: 420 }}>
            <KawaiiButton variant="primary" size="lg" fullWidth disabled={tooPoor} onClick={phase === 'betting' ? deal : reset}>
              {phase === 'betting' ? (tooPoor ? 'NOT ENOUGH COINS' : `🎴 DEAL FOR ${bet.toLocaleString()} 🪙`) : '↻ PLAY AGAIN'}
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
