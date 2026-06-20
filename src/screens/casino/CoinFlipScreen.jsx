import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { KawaiiButton } from '../../components/ui'
import BetBar from '../../components/casino/BetBar'
import { flipCoin, COINFLIP_PAYOUT } from '../../engine/casino/coinflip'
import { playButtonTap, playWin, playNearMiss, playCoinDrop } from '../../engine/sounds'

const MIN_BET = 10

export default function CoinFlipScreen() {
  const navigate = useNavigate()
  const { getCoinsAvailable, placeBet, settleBet } = useStore()
  const balance = getCoinsAvailable()

  const [betRaw, setBet]  = useState(() => Math.min(50, Math.max(MIN_BET, balance)))
  const [pick, setPick]   = useState('heads')      // pre-picked so you can flip right away
  const [phase, setPhase] = useState('betting')    // betting | won | lost
  const [landed, setLanded] = useState('heads')    // face shown on the coin (H/T)
  const [pot, setPot]     = useState(0)            // winnings riding (virtual until banked)
  const [streak, setStreak] = useState(0)
  const [flipKey, setFlipKey] = useState(0)        // bump → re-trigger the coin's CSS flip

  const bet = Math.max(MIN_BET, Math.min(balance, betRaw))
  const tooPoor = balance < MIN_BET
  const canFlip = (phase === 'betting' || phase === 'lost') && !!pick && !tooPoor && bet >= MIN_BET && bet <= balance

  // One flip, resolved SYNCHRONOUSLY (no timers → can never get stuck).
  function doFlip(stake) {
    const { result, win } = flipCoin(pick)
    setLanded(result)
    setFlipKey(k => k + 1)
    if (win) {
      const newPot = Math.floor(stake * COINFLIP_PAYOUT)
      setPot(newPot); setStreak(s => s + 1); setPhase('won')
      playWin(newPot >= bet * 16 ? 'jackpot' : newPot >= bet * 6 ? 't3' : newPot >= bet * 2.5 ? 't2' : 't1')
    } else {
      setPot(0); setStreak(0); setPhase('lost'); playNearMiss()
    }
  }

  function startFlip() {
    if (!canFlip || !placeBet(bet, 'coinflip')) return
    playButtonTap(); doFlip(bet)
  }
  function letItRide() { playButtonTap(); doFlip(pot) }
  function bank() {
    settleBet(pot, 'coinflip'); playCoinDrop()
    setPot(0); setStreak(0); setPhase('betting')
  }

  const isHeads = landed === 'heads'

  return (
    <div style={{ minHeight: '100%', padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <style>{`@keyframes cf-flip{0%{transform:rotateY(0deg) scale(0.85)}100%{transform:rotateY(720deg) scale(1)}}`}</style>

      <div style={{ width: '100%', maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => navigate('/casino')} style={backBtn}>← Lobby</button>
        <div style={balancePill}>{balance.toLocaleString()} 🪙</div>
      </div>

      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#3D2B4F', margin: '6px 0 2px' }}>🪙 Coin Flip</h2>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 12 }}>
        Win pays {COINFLIP_PAYOUT}× · let it ride to double up
      </div>

      {/* the coin — shows H or T (the landed side) */}
      <div style={{ height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          key={flipKey}
          style={{
            width: 140, height: 140, borderRadius: '50%',
            background: isHeads
              ? 'radial-gradient(circle at 36% 30%, #FFF4C2 0%, #FBD15B 45%, #E0A800 100%)'
              : 'radial-gradient(circle at 36% 30%, #FFFFFF 0%, #E8D9F5 45%, #B79FDA 100%)',
            border: `6px solid ${isHeads ? '#C98A00' : '#8B6BAE'}`,
            boxShadow: `0 8px 0 ${isHeads ? '#B07A00' : '#7458A0'}, 0 12px 22px rgba(120,90,160,0.35)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Fredoka', cursive", fontSize: 76, color: isHeads ? '#9A6A00' : '#5A4072',
            animation: 'cf-flip 0.4s ease-out',
          }}
        >
          {isHeads ? 'H' : 'T'}
        </div>
      </div>

      {/* result line */}
      <div style={{ height: 30, fontFamily: "'Fredoka', cursive", fontSize: 22, marginBottom: 6 }}>
        {phase === 'won'  && <span style={{ color: '#5CBFA0' }}>{isHeads ? 'Heads!' : 'Tails!'} +{pot.toLocaleString()} 🪙{streak > 1 ? `  🔥×${streak}` : ''}</span>}
        {phase === 'lost' && <span style={{ color: '#C44B6A' }}>{isHeads ? 'Heads' : 'Tails'} — you lost it 💔</span>}
      </div>

      {/* pick a side */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {['heads', 'tails'].map(side => (
          <button key={side} type="button" onClick={() => { setPick(side); playButtonTap() }} style={pickBtn(pick === side)}>
            {side === 'heads' ? 'H · Heads' : 'T · Tails'}
          </button>
        ))}
      </div>

      {(phase === 'betting' || phase === 'lost') && (
        <>
          <BetBar bet={bet} setBet={setBet} balance={balance} min={MIN_BET} />
          <div style={{ marginTop: 16, width: '100%', maxWidth: 420 }}>
            <KawaiiButton variant="primary" size="lg" fullWidth disabled={!canFlip} onClick={startFlip}>
              {tooPoor ? 'NOT ENOUGH COINS' : !pick ? 'PICK A SIDE FIRST' : `FLIP FOR ${bet.toLocaleString()} 🪙`}
            </KawaiiButton>
          </div>
          {tooPoor && (
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginTop: 10, textAlign: 'center' }}>
              Go do a habit to earn more coins 💪
            </div>
          )}
        </>
      )}

      {phase === 'won' && (
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <KawaiiButton variant="gold" size="lg" fullWidth onClick={bank}>
            💰 BANK {pot.toLocaleString()} 🪙
          </KawaiiButton>
          <KawaiiButton variant="secondary" size="md" fullWidth onClick={letItRide}>
            🎲 LET IT RIDE → {Math.floor(pot * COINFLIP_PAYOUT).toLocaleString()} 🪙
          </KawaiiButton>
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
const pickBtn = on => ({
  fontFamily: "'Fredoka', cursive", fontSize: 19, padding: '10px 22px', borderRadius: 14, cursor: 'pointer',
  color: on ? '#fff' : '#9B3D6B', background: on ? '#FF85A1' : '#FFF0F8',
  border: `2.5px solid ${on ? '#C44B6A' : '#FFB7D0'}`, boxShadow: on ? '0 3px 0 #C44B6A' : 'none',
})
