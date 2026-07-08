import { useNavigate, useLocation } from 'react-router-dom'
import useStore from '../store/useStore'
import { CoinIcon } from './ui'

// Always-visible wallet at the top right: beads in hand + coins. On every main
// screen (hidden during immersive flows — games, reveals, cash-in — which have
// their own displays). Tapping beads opens the wallet; tapping coins opens Spend.
const HIDE_ON = ['/meet', '/tour', '/cash-in', '/spin', '/bonus', '/reward', '/break-glass', '/blocked',
  '/casino/coinflip', '/casino/crash', '/casino/penguin', '/casino/mines', '/casino/plinko',
  '/casino/hilo', '/casino/blackjack', '/casino/slots', '/casino/wheel']

export default function StatusHUD() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const beads = useStore(s => s.wallet.length)
  const coins = useStore(s => s.getCoinsAvailable())
  if (HIDE_ON.includes(pathname)) return null

  return (
    <div style={{
      position: 'absolute', top: 10, right: 12, zIndex: 60,
      display: 'flex', gap: 6, pointerEvents: 'auto',
    }}>
      <button onClick={() => navigate('/wallet')} aria-label={`${beads} beads in hand — open wallet`} style={pill}>
        <img src="/beads/bead-6.png" alt="" draggable={false}
          style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
        <span style={num}>{beads}</span>
      </button>
      <button onClick={() => navigate('/spend')} aria-label={`${coins} coins — open spend`} style={pill}>
        <CoinIcon size={13} />
        <span style={num}>{coins.toLocaleString()}</span>
      </button>
    </div>
  )
}

const pill = {
  display: 'flex', alignItems: 'center', gap: 5,
  background: 'rgba(255,248,252,0.92)', border: '2px solid #ECC0DE', borderRadius: 999,
  padding: '4px 10px', cursor: 'pointer',
  boxShadow: '0 2px 0 #DBA9CD, 0 3px 8px rgba(155,126,200,0.25)',
}
const num = { fontFamily: "'Fredoka', cursive", fontSize: 14, color: '#5A2E4A', lineHeight: 1 }
