import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { KawaiiButton } from '../../components/ui'
import BetBar from '../../components/casino/BetBar'
import { RANKS, SUITS, drawCard, handValue, isBlackjack, dealerPlay, settleHand } from '../../engine/casino/blackjack'
import { playButtonTap, playWin, playNearMiss, playCoinDrop } from '../../engine/sounds'

const MIN_BET = 10
const isRed = s => s === 1 || s === 2

function Card({ card, hidden }) {
  if (hidden) return (
    <div style={{ ...cardBox, background: 'repeating-linear-gradient(45deg,#C8B4E0,#C8B4E0 6px,#B79FDA 6px,#B79FDA 12px)', borderColor: '#9B7EC8' }} />
  )
  const red = isRed(card.suit)
  return (
    <div style={{ ...cardBox, color: red ? '#E0466B' : '#3D2B4F' }}>
      <div style={{ fontSize: 24, lineHeight: 1 }}>{RANKS[card.rank]}</div>
      <div style={{ fontSize: 22, lineHeight: 1 }}>{SUITS[card.suit]}</div>
    </div>
  )
}

function Hand({ cards, hideHole }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', minHeight: 86 }}>
      {cards.map((c, i) => <Card key={i} card={c} hidden={hideHole && i === 1} />)}
    </div>
  )
}

export default function BlackjackScreen() {
  const navigate = useNavigate()
  const { getCoinsAvailable, placeBet, settleBet } = useStore()
  const balance = getCoinsAvailable()

  const [betRaw, setBet] = useState(() => Math.min(50, Math.max(MIN_BET, balance)))
  const [phase, setPhase] = useState('betting')   // betting | player | done
  const [player, setPlayer] = useState([])
  const [dealer, setDealer] = useState([])
  const [staked, setStaked] = useState(0)
  const [natural, setNatural] = useState(false)
  const [result, setResult] = useState(null)      // { mult, label, win }

  const bet = Math.max(MIN_BET, Math.min(balance, betRaw))
  const tooPoor = balance < MIN_BET
  const pVal = handValue(player).total
  const canDouble = phase === 'player' && player.length === 2 && balance >= bet

  function resolve(p, d, wasNatural, totalStaked) {
    const dealt = dealerPlay(d)
    const mult = settleHand(p, dealt, wasNatural)
    const win = Math.floor(totalStaked * mult)
    if (win > 0) settleBet(win, 'blackjack')
    const label = mult === 2.5 ? `Blackjack! +${win.toLocaleString()} 🪙`
      : mult === 2 ? `You win! +${win.toLocaleString()} 🪙`
      : mult === 1 ? `Push — ${win.toLocaleString()} 🪙 back`
      : handValue(p).total > 21 ? `Bust! Lost ${totalStaked.toLocaleString()} 🪙`
      : `Dealer wins — lost ${totalStaked.toLocaleString()} 🪙`
    setDealer(dealt); setResult({ mult, label }); setPhase('done')
    // blackjack tops out at 2.5×, so keep it modest: 2× win small · 2.5× blackjack medium
    if (mult >= 2) { playWin(mult >= 2.5 ? 't2' : 't1'); playCoinDrop() }
    else if (mult === 1) playButtonTap()
    else playNearMiss()
  }

  function deal() {
    if (tooPoor || bet < MIN_BET || bet > balance) return
    if (!placeBet(bet, 'blackjack')) return
    const p = [drawCard(), drawCard()]
    const d = [drawCard(), drawCard()]
    setPlayer(p); setDealer(d); setStaked(bet); setResult(null); playButtonTap()
    const pBJ = isBlackjack(p), dBJ = isBlackjack(d)
    if (pBJ || dBJ) { setNatural(pBJ); resolve(p, d, pBJ, bet) }
    else { setNatural(false); setPhase('player') }
  }

  function hit() {
    const p = [...player, drawCard()]
    setPlayer(p); playButtonTap()
    if (handValue(p).total > 21) resolve(p, dealer, false, staked)
  }

  function stand() { playButtonTap(); resolve(player, dealer, natural, staked) }

  function double() {
    if (!canDouble || !placeBet(bet, 'blackjack')) return
    const total = staked + bet
    const p = [...player, drawCard()]
    setPlayer(p); setStaked(total); playButtonTap()
    resolve(p, dealer, false, total)
  }

  function reset() { setPhase('betting'); setPlayer([]); setDealer([]); setResult(null) }

  const playing = phase === 'player'
  const showAll = phase === 'done'

  return (
    <div style={{ minHeight: '100%', padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => navigate('/casino')} style={backBtn}>← Lobby</button>
        <div style={balancePill}>{balance.toLocaleString()} 🪙</div>
      </div>

      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#3D2B4F', margin: '6px 0 2px' }}>🃏 Blackjack</h2>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 12 }}>
        Beat the dealer to 21 without busting. Blackjack pays 3:2.
      </div>

      {phase !== 'betting' && (
        <div style={{ width: '100%', maxWidth: 420, background: 'linear-gradient(180deg,#E7F6EC 0%,#D6EFDF 100%)', border: '3px solid #B7E0C4', borderRadius: 18, padding: '12px', marginBottom: 12 }}>
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, fontWeight: 700, color: '#3E8B62', textAlign: 'center', marginBottom: 4 }}>
            DEALER {showAll ? `· ${handValue(dealer).total}` : ''}
          </div>
          <Hand cards={dealer} hideHole={playing} />
          <div style={{ height: 1, background: '#B7E0C4', margin: '10px 0' }} />
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, fontWeight: 700, color: '#3E8B62', textAlign: 'center', marginBottom: 4 }}>
            YOU · {pVal}{handValue(player).soft ? ' (soft)' : ''}
          </div>
          <Hand cards={player} />
        </div>
      )}

      <div style={{ height: 26, fontFamily: "'Fredoka', cursive", fontSize: 20, marginBottom: 8 }}>
        {result && <span style={{ color: result.mult >= 2 ? '#5CBFA0' : result.mult === 1 ? '#7B5EA7' : '#C44B6A' }}>{result.label}</span>}
      </div>

      {playing && (
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <KawaiiButton variant="primary" size="lg" fullWidth onClick={hit}>🃏 HIT</KawaiiButton>
            <KawaiiButton variant="secondary" size="lg" fullWidth onClick={stand}>✋ STAND</KawaiiButton>
          </div>
          <KawaiiButton variant="gold" size="md" fullWidth disabled={!canDouble} onClick={double}>
            {canDouble ? `2× DOUBLE (${bet.toLocaleString()} 🪙 more)` : 'DOUBLE (first move only)'}
          </KawaiiButton>
        </div>
      )}

      {(phase === 'betting' || phase === 'done') && (
        <>
          <BetBar bet={bet} setBet={setBet} balance={balance} min={MIN_BET} />
          <div style={{ marginTop: 16, width: '100%', maxWidth: 420 }}>
            <KawaiiButton variant="primary" size="lg" fullWidth disabled={tooPoor} onClick={phase === 'betting' ? deal : reset}>
              {phase === 'betting' ? (tooPoor ? 'NOT ENOUGH COINS' : `🃏 DEAL FOR ${bet.toLocaleString()} 🪙`) : '↻ PLAY AGAIN'}
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

const cardBox = {
  width: 58, height: 82, borderRadius: 10, background: '#FFFDF7', border: '2.5px solid #E6D8B8',
  boxShadow: '0 4px 0 #D8C49A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  fontFamily: "'Fredoka', cursive", flexShrink: 0,
}
const backBtn = {
  fontFamily: 'Mulish, sans-serif', fontSize: 15, fontWeight: 700, color: '#7B5EA7',
  background: 'rgba(255,255,255,0.7)', border: '2px solid #D8C4EC', borderRadius: 12, padding: '6px 12px', cursor: 'pointer',
}
const balancePill = {
  fontFamily: "'Fredoka', cursive", fontSize: 18, color: '#E0A800',
  background: '#FFF5F9', border: '2px solid #ECC0DE', borderRadius: 12, padding: '4px 12px',
}
