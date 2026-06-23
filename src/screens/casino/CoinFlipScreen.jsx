import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { KawaiiButton, CoinIcon } from '../../components/ui'
import BetBar from '../../components/casino/BetBar'
import WinFlash from '../../components/casino/WinFlash'
import { flipCoin, COINFLIP_PAYOUT } from '../../engine/casino/coinflip'
import { playButtonTap, playWin, playNearMiss, playCoinDrop } from '../../engine/sounds'

const MIN_BET = 10

export default function CoinFlipScreen() {
  const navigate = useNavigate()
  const { getCoinsAvailable, placeBet, settleBet } = useStore()
  const balance = getCoinsAvailable()

  const [betRaw, setBet]  = useState(() => Math.min(50, Math.max(MIN_BET, balance)))
  const [pick, setPick]   = useState('heads')
  const [phase, setPhase] = useState('betting')   // betting | won | lost
  const [landed, setLanded] = useState('heads')
  const [pot, setPot]     = useState(0)
  const [streak, setStreak] = useState(0)
  const [flipKey, setFlipKey] = useState(0)
  const [flashKey, setFlashKey] = useState(0)
  const [flashTier, setFlashTier] = useState('t1')
  const [shakeKey, setShakeKey] = useState(0)

  const actingRef = useRef(false)
  useEffect(() => { actingRef.current = false }, [phase, pot])

  const bet = Math.max(MIN_BET, Math.min(balance, betRaw))
  const tooPoor = balance < MIN_BET
  const canFlip = (phase === 'betting' || phase === 'lost') && !!pick && !tooPoor && bet >= MIN_BET && bet <= balance

  function doFlip(stake) {
    const { result, win } = flipCoin(pick)
    setLanded(result)
    setFlipKey(k => k + 1)
    if (win) {
      const newPot = Math.floor(stake * COINFLIP_PAYOUT)
      const tier = newPot >= bet * 16 ? 'jackpot' : newPot >= bet * 6 ? 't3' : newPot >= bet * 2.5 ? 't2' : 't1'
      setPot(newPot); setStreak(s => s + 1); setPhase('won')
      playWin(tier)
      setFlashTier(tier); setFlashKey(k => k + 1)
    } else {
      setPot(0); setStreak(0); setPhase('lost')
      playNearMiss()
      setFlashTier('loss'); setFlashKey(k => k + 1)
      setShakeKey(s => s + 1)
    }
  }

  function startFlip() {
    if (actingRef.current || !canFlip || !placeBet(bet, 'coinflip')) return
    actingRef.current = true
    playButtonTap(); doFlip(bet)
  }
  function letItRide() {
    if (actingRef.current) return
    actingRef.current = true
    playButtonTap(); doFlip(pot)
  }
  function bank() {
    if (actingRef.current) return
    actingRef.current = true
    settleBet(pot, 'coinflip'); playCoinDrop()
    setFlashTier('t3'); setFlashKey(k => k + 1)
    setPot(0); setStreak(0); setPhase('betting')
  }

  const isHeads = landed === 'heads'

  return (
    <div
      key={shakeKey || undefined}
      style={{
        minHeight: '100%', padding: '16px 16px 28px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        animation: shakeKey ? 'game-shake 0.42s ease-out' : undefined,
      }}
    >
      <WinFlash flashKey={flashKey} tier={flashTier} />
      <style>{`@keyframes cf-flip{0%{transform:rotateY(0deg) scale(0.85)}60%{transform:rotateY(620deg) scale(1.08)}100%{transform:rotateY(720deg) scale(1)}}`}</style>

      <div style={{ width: '100%', maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => navigate('/casino')} style={backBtn}>← Lobby</button>
        <div style={balancePill}>{balance.toLocaleString()} <CoinIcon /></div>
      </div>

      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#3D2B4F', margin: '6px 0 2px' }}><CoinIcon /> Coin Flip</h2>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 12 }}>
        Win pays {COINFLIP_PAYOUT}× · let it ride to double up
      </div>

      {/* the coin */}
      <div style={{ height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          key={flipKey}
          style={{
            width: 140, height: 140, borderRadius: '50%',
            background: isHeads
              ? 'radial-gradient(circle at 36% 30%, #FFF9D6 0%, #FBD15B 42%, #D4960A 100%)'
              : 'radial-gradient(circle at 36% 30%, #F0E8FF 0%, #D0B8F0 45%, #8B62C8 100%)',
            border: `6px solid ${isHeads ? '#C98A00' : '#7A54B8'}`,
            boxShadow: isHeads
              ? '0 8px 0 #9A6A00, 0 12px 24px rgba(180,130,0,0.35), 0 0 18px rgba(251,209,91,0.45)'
              : '0 8px 0 #5E3E96, 0 12px 24px rgba(120,90,200,0.35), 0 0 14px rgba(180,140,240,0.35)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            animation: 'cf-flip 0.42s cubic-bezier(0.25,0.46,0.45,0.94)',
            gap: 2,
          }}
        >
          <div style={{ fontSize: 52, lineHeight: 1 }}>
            {isHeads ? '🌟' : '🌙'}
          </div>
          <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 20, color: isHeads ? '#7A5200' : '#3D1A6E', lineHeight: 1, letterSpacing: '0.04em' }}>
            {isHeads ? 'HEADS' : 'TAILS'}
          </div>
        </div>
      </div>

      {/* result line */}
      <div style={{ height: 30, fontFamily: "'Fredoka', cursive", fontSize: 22, marginBottom: 6 }}>
        {phase === 'won'  && <span style={{ color: '#5CBFA0' }}>{isHeads ? '🌟 Heads!' : '🌙 Tails!'} +{pot.toLocaleString()} <CoinIcon />{streak > 1 ? `  🔥×${streak}` : ''}</span>}
        {phase === 'lost' && <span style={{ color: '#C44B6A' }}>{isHeads ? '🌟 Heads' : '🌙 Tails'} — you lost it 💔</span>}
      </div>

      {/* pick a side */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {['heads', 'tails'].map(side => (
          <button key={side} type="button" onClick={() => { setPick(side); playButtonTap() }} style={pickBtn(pick === side, side)}>
            {side === 'heads' ? '🌟 Heads' : '🌙 Tails'}
          </button>
        ))}
      </div>

      {(phase === 'betting' || phase === 'lost') && (
        <>
          <BetBar bet={bet} setBet={setBet} balance={balance} min={MIN_BET} />
          <div style={{ marginTop: 16, width: '100%', maxWidth: 420 }}>
            <KawaiiButton variant="primary" size="lg" fullWidth disabled={!canFlip} onClick={startFlip}>
              {tooPoor ? 'NOT ENOUGH COINS' : !pick ? 'PICK A SIDE FIRST' : <>FLIP FOR {bet.toLocaleString()} <CoinIcon /></>}
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
            💰 BANK {pot.toLocaleString()} <CoinIcon />
          </KawaiiButton>
          <KawaiiButton variant="secondary" size="md" fullWidth onClick={letItRide}>
            🎲 LET IT RIDE → {Math.floor(pot * COINFLIP_PAYOUT).toLocaleString()} <CoinIcon />
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
const pickBtn = (on, side) => ({
  fontFamily: "'Fredoka', cursive", fontSize: 19, padding: '10px 22px', borderRadius: 14, cursor: 'pointer',
  color: on ? '#fff' : '#9B3D6B',
  background: on ? (side === 'heads' ? 'linear-gradient(135deg,#FBD15B,#E0A800)' : 'linear-gradient(135deg,#C8A4E8,#8B62C8)') : '#FFF0F8',
  border: `2.5px solid ${on ? (side === 'heads' ? '#C98A00' : '#7A54B8') : '#FFB7D0'}`,
  boxShadow: on ? `0 3px 0 ${side === 'heads' ? '#9A6A00' : '#5E3E96'}` : 'none',
})
