import { useState } from 'react'
import useStore from '../store/useStore'
import { KawaiiButton, PixelPanel } from '../components/ui'

// Format a number of seconds as a friendly duration.
function fmtTime(sec) {
  const m = Math.round(sec / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

export default function SpendScreen() {
  const { coinLog, settings, spendCoins, getCoinsAvailable } = useStore()
  const coins = getCoinsAvailable()
  const { moneyPerCoin, secondsPerCoin, coinName, timeActivity } = settings

  const [dollars, setDollars] = useState('')
  const [note, setNote] = useState('')

  const moneyOn = moneyPerCoin > 0
  const spendCoinsForDollars = moneyOn ? Math.round(Number(dollars || 0) / moneyPerCoin) : 0
  const canLog = moneyOn && spendCoinsForDollars > 0 && spendCoinsForDollars <= coins

  function handleLog() {
    if (!canLog) return
    spendCoins(spendCoinsForDollars, note.trim() || 'guilt-free treat')
    setDollars(''); setNote('')
  }

  const spends = coinLog.filter(e => e.type === 'spent').slice().reverse().slice(0, 8)

  return (
    <div style={{ minHeight: '100%', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 34, color: '#3D2B4F', textAlign: 'center' }}>
        💸 Spend
      </h2>

      {/* Balance */}
      <PixelPanel color="cream" style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 18, color: '#7B5EA7', fontWeight: 700 }}>
          You have
        </div>
        <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 44, color: '#E0A800', lineHeight: 1.1, textShadow: '0 2px 0 rgba(200,150,0,0.25)' }}>
          {coins.toLocaleString()} <span style={{ fontSize: 24 }}>🪙</span>
        </div>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 16, color: '#7B5EA7', marginTop: 4 }}>
          {coinName}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
          {moneyOn && (
            <div>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 26, color: '#5CBFA0' }}>
                ${(coins * moneyPerCoin).toFixed(2)}
              </div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B8AB5' }}>guilt-free $</div>
            </div>
          )}
          {secondsPerCoin > 0 && (
            <div>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 26, color: '#9B7EC8' }}>
                {fmtTime(coins * secondsPerCoin)}
              </div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B8AB5' }}>{timeActivity}</div>
            </div>
          )}
        </div>
      </PixelPanel>

      {/* Log a treat */}
      {moneyOn ? (
        <PixelPanel color="lavender" style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#3D2B4F', textAlign: 'center', marginBottom: 12 }}>
            Cash in a treat 🎀
          </div>
          <label style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#7B5EA7', fontWeight: 700 }}>
            How much did you spend?
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 12px' }}>
            <span style={{ fontFamily: "'Fredoka', cursive", fontSize: 24, color: '#3D2B4F' }}>$</span>
            <input
              type="number" min="0" step="0.50" inputMode="decimal"
              value={dollars} onChange={e => setDollars(e.target.value)}
              placeholder="5.00"
              style={inputStyle}
            />
          </div>
          <input
            type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="What did you treat yourself to?"
            style={{ ...inputStyle, width: '100%', marginBottom: 12 }}
          />
          {spendCoinsForDollars > 0 && (
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: canLog ? '#7B5EA7' : '#D4607A', textAlign: 'center', marginBottom: 10 }}>
              {canLog
                ? `That's ${spendCoinsForDollars.toLocaleString()} ${coinName} 🪙`
                : `Not enough ${coinName} — you have ${coins.toLocaleString()}`}
            </div>
          )}
          <KawaiiButton variant="primary" size="lg" onClick={handleLog} disabled={!canLog} style={{ width: '100%' }}>
            💸 Log it
          </KawaiiButton>
        </PixelPanel>
      ) : (
        <PixelPanel color="lavender" style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 15, color: '#7B5EA7' }}>
            Turn on a money value per coin in <strong>Settings</strong> to log guilt-free spending here.
          </div>
        </PixelPanel>
      )}

      {/* History */}
      {spends.length > 0 && (
        <PixelPanel color="cream" style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 18, color: '#3D2B4F', marginBottom: 8 }}>
            Recent treats
          </div>
          {spends.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(155,126,200,0.15)' }}>
              <div>
                <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 15, color: '#3D2B4F' }}>{e.note || 'treat'}</div>
                <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 12, color: '#9B8AB5' }}>
                  {new Date(e.timestamp).toLocaleDateString()}
                </div>
              </div>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 16, color: '#D4607A' }}>
                −{e.amount.toLocaleString()} 🪙
              </div>
            </div>
          ))}
        </PixelPanel>
      )}

      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 12, color: '#9B8AB5', textAlign: 'center', maxWidth: 360 }}>
        Coming later: block distracting apps when you run low on {coinName}. ✨
      </div>
    </div>
  )
}

const inputStyle = {
  flex: 1,
  fontFamily: 'Mulish, sans-serif',
  fontSize: 18,
  padding: '10px 12px',
  borderRadius: 12,
  border: '2px solid #C8B4E0',
  background: '#FFF',
  color: '#3D2B4F',
  outline: 'none',
}
