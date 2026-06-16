import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { PixelPanel } from '../components/ui'

const GAMES = [
  { key: 'coinflip', to: '/casino/coinflip', emoji: '🪙', name: 'Coin Flip', tag: 'Heads or tails — let it ride', live: true },
  { key: 'crash',    to: '/casino/crash',    emoji: '🚀', name: 'Crash',     tag: 'Cash out before it blows up', live: true },
  { key: 'penguin',  to: '/casino/penguin', emoji: '🐧', name: 'Penguin Cross', tag: 'Cross for more — or get hit', live: true },
  { key: 'mines',    to: '/casino/mines',   emoji: '💣', name: 'Mines',         tag: 'Dodge the bombs, bank the gems', live: true },
  { key: 'plinko',   to: '/casino/plinko', emoji: '🎯', name: 'Plinko', tag: 'Drop a bead, chase the edge', live: true },
  { key: 'hilo',     to: '/casino/hilo',   emoji: '🎴', name: 'Hi-Lo',  tag: 'Higher or lower? Bank the streak', live: true },
  { key: 'limbo',    to: '/casino/limbo',  emoji: '📈', name: 'Limbo',  tag: 'Roll over your target to win', live: true },
  { key: 'blackjack',to: '/casino/blackjack', emoji: '🃏', name: 'Blackjack', tag: 'Beat the dealer to 21', live: true },
]

export default function CasinoScreen() {
  const navigate = useNavigate()
  const { getCoinsAvailable, getCasinoNet } = useStore()
  const coins = getCoinsAvailable()
  const net = getCasinoNet()

  return (
    <div style={{ minHeight: '100%', padding: '24px 16px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 34, color: '#3D2B4F', textAlign: 'center', margin: 0 }}>
        🎰 Casino
      </h2>

      {/* Balance you can gamble */}
      <PixelPanel color="cream" style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 16, color: '#7B5EA7', fontWeight: 700 }}>
          Coins to play with
        </div>
        <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 44, color: '#E0A800', lineHeight: 1.1, textShadow: '0 2px 0 rgba(200,150,0,0.25)' }}>
          {coins.toLocaleString()} <span style={{ fontSize: 24 }}>🪙</span>
        </div>
        {net !== 0 && (
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 15, marginTop: 4, color: net > 0 ? '#5CBFA0' : '#C44B6A', fontWeight: 700 }}>
            Casino record: {net > 0 ? '+' : '−'}{Math.abs(net).toLocaleString()} 🪙
          </div>
        )}
      </PixelPanel>

      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', textAlign: 'center', maxWidth: 360, lineHeight: 1.45 }}>
        Bet the coins you earned. You might win big — or lose it all. No refunds, no floor. 💅
      </div>

      {/* Game grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 420 }}>
        {GAMES.map(g => (
          <button
            key={g.key}
            type="button"
            disabled={!g.live}
            onClick={() => g.live && navigate(g.to)}
            style={{
              position: 'relative', textAlign: 'left', cursor: g.live ? 'pointer' : 'default',
              background: g.live ? 'linear-gradient(160deg, #FFFFFF 0%, #FFF0F8 100%)' : '#F3EEFA',
              border: `2.5px solid ${g.live ? '#FF9ECF' : '#DDD2EE'}`,
              borderRadius: 18, padding: '14px 14px 16px',
              boxShadow: g.live ? '0 4px 0 #E48FBE' : 'none',
              opacity: g.live ? 1 : 0.7,
            }}
          >
            <div style={{ fontSize: 34, lineHeight: 1 }}>{g.emoji}</div>
            <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 21, color: '#9B3D6B', marginTop: 6 }}>{g.name}</div>
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 12.5, color: '#7B5EA7', marginTop: 2, lineHeight: 1.35 }}>{g.tag}</div>
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
