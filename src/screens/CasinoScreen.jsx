import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { PixelPanel, CoinIcon, ScreenHeader } from '../components/ui'
import VisualNovel from '../components/VisualNovel'
import { FIRST_VISIT_CASINO } from '../content/habitChanScript'
import { useFirstVisitPopIn } from '../hooks/useFirstVisitPopIn'

const GAMES = [
  { key: 'coinflip', to: '/casino/coinflip', emoji: '🪙', name: 'Coin Flip', tag: 'Heads or tails — let it ride', live: true },
  { key: 'crash',    to: '/casino/crash',    emoji: '🚀', name: 'Crash',     tag: 'Cash out before it blows up', live: true },
  { key: 'penguin',  to: '/casino/penguin', emoji: '🐧', name: 'Penguin Cross', tag: 'Cross for more — or get hit', live: true },
  { key: 'mines',    to: '/casino/mines',   emoji: '💣', name: 'Mines',         tag: 'Dodge the bombs, bank the gems', live: true },
  { key: 'plinko',   to: '/casino/plinko', emoji: '🎯', name: 'Plinko', tag: 'Drop a bead, chase the edge', live: true },
  { key: 'hilo',     to: '/casino/hilo',   emoji: '🎴', name: 'Hi-Lo',  tag: 'Higher or lower? Bank the streak', live: true },
  { key: 'blackjack',to: '/casino/blackjack', emoji: '🃏', name: 'Blackjack', tag: 'Beat the dealer to 21', live: true },
  { key: 'slots',    to: '/casino/slots', emoji: '🎰', name: 'Slots',         tag: 'Match three, win big', live: true },
  { key: 'wheel',    to: '/casino/wheel', emoji: '🎡', name: 'Fortune Wheel', tag: 'Spin for a multiplier', live: true },
]

export default function CasinoScreen() {
  const navigate = useNavigate()
  const { getCoinsAvailable, getCasinoNet } = useStore()
  const coins = getCoinsAvailable()
  const net = getCasinoNet()
  const { show: showPopIn, dismiss: dismissPopIn } = useFirstVisitPopIn('casino')

  return (
    <div style={{ minHeight: '100%', padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {showPopIn && <VisualNovel script={FIRST_VISIT_CASINO} onComplete={dismissPopIn} onSkip={dismissPopIn} />}
      <ScreenHeader title="🎰 Casino" center style={{ marginBottom: 0 }} />

      {/* Balance you can gamble */}
      <PixelPanel color="cream" style={{ width: '100%', maxWidth: 420, textAlign: 'center', padding: '10px 16px' }}>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#7B5EA7', fontWeight: 700 }}>
          Coins to play with
        </div>
        <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 38, color: '#E0A800', lineHeight: 1.1, textShadow: '0 2px 0 rgba(200,150,0,0.25)' }}>
          {coins.toLocaleString()} <CoinIcon size={22} />
        </div>
        {net !== 0 && (
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 15, marginTop: 4, color: net > 0 ? '#5CBFA0' : '#C44B6A', fontWeight: 700 }}>
            Casino record: {net > 0 ? '+' : '−'}{Math.abs(net).toLocaleString()} <CoinIcon />
          </div>
        )}
      </PixelPanel>

      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 12, color: '#9B7EC8', textAlign: 'center', lineHeight: 1.3 }}>
        Bet your coins. Win big or lose it all — no floor. 💅
      </div>

      {/* Game grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 420 }}>
        {GAMES.map(g => (
          <button
            key={g.key}
            type="button"
            disabled={!g.live}
            onClick={() => g.live && navigate(g.to)}
            className={g.live ? 'casino-card' : undefined}
            style={{
              position: 'relative', textAlign: 'left', cursor: g.live ? 'pointer' : 'default',
              background: g.live ? 'linear-gradient(160deg, #FFFFFF 0%, #FFF0F8 100%)' : '#F3EEFA',
              border: `2.5px solid ${g.live ? '#FF9ECF' : '#DDD2EE'}`,
              borderRadius: 16, padding: '10px 12px 12px',
              boxShadow: g.live ? '0 3px 0 #E48FBE' : 'none',
              opacity: g.live ? 1 : 0.7,
              transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
            }}
          >
            <div style={{ fontSize: 28, lineHeight: 1 }}>{g.emoji === '🪙' ? <CoinIcon /> : g.emoji}</div>
            <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 19, color: '#9B3D6B', marginTop: 4 }}>{g.name}</div>
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 11.5, color: '#7B5EA7', marginTop: 2, lineHeight: 1.3 }}>{g.tag}</div>
            {!g.live && (
              <div style={{
                position: 'absolute', top: 10, right: 10, fontFamily: 'Mulish, sans-serif', fontSize: 10, fontWeight: 800,
                color: '#9B7EC8', background: '#E7DCF7', borderRadius: 8, padding: '2px 7px', letterSpacing: '0.04em',
              }}>SOON</div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
