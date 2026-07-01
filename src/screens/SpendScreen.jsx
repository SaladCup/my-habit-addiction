import { useState, useEffect } from 'react'
import useNow from '../hooks/useNow'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { KawaiiButton, PixelPanel, CoinIcon } from '../components/ui'
import VisualNovel from '../components/VisualNovel'
import { FIRST_VISIT_SPEND } from '../content/habitChanScript'
import { useFirstVisitPopIn } from '../hooks/useFirstVisitPopIn'

// Format a number of seconds as a friendly duration.
function fmtTime(sec) {
  const m = Math.round(sec / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

export default function SpendScreen() {
  const navigate = useNavigate()
  const { coinLog, settings, spendCoins, getCoinsAvailable, rotblock } = useStore()
  const coins = getCoinsAvailable()
  const rbOn = !!rotblock?.enabled
  const rbCount = rotblock?.targets?.length || 0
  const now = useNow(10000)
  const bgActive = rotblock?.breakGlassUntil && rotblock.breakGlassUntil > now
  const rbBlocked = rbOn && coins <= 0 && !bgActive   // out of coins (the RotBlock screen shows live Break-Glass status)
  const { moneyPerCoin, secondsPerCoin, timeActivity } = settings
  const coinName = 'coins'

  const [dollars, setDollars] = useState('')
  const [note, setNote] = useState('')
  const [toast, setToast] = useState(null)

  // Success toast auto-dismisses (the form clearing alone read as "did it work?").
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const moneyOn = moneyPerCoin > 0
  const spendCoinsForDollars = moneyOn ? Math.round(Number(dollars || 0) / moneyPerCoin) : 0
  const canLog = moneyOn && spendCoinsForDollars > 0 && spendCoinsForDollars <= coins

  function handleLog() {
    if (!canLog) return
    spendCoins(spendCoinsForDollars, note.trim() || 'guilt-free treat')
    setToast(`✓ Treat logged — ${spendCoinsForDollars.toLocaleString()} coins 💖`)
    setDollars(''); setNote('')
  }

  const spends = coinLog.filter(e => e.type === 'spent' && !/^(casino|rotblock):/.test(e.note || '')).slice().reverse().slice(0, 8)
  const { show: showPopIn, dismiss: dismissPopIn } = useFirstVisitPopIn('spend')

  return (
    <div style={{ minHeight: '100%', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      {showPopIn && <VisualNovel script={FIRST_VISIT_SPEND} onComplete={dismissPopIn} onSkip={dismissPopIn} />}
      {toast && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 96, transform: 'translateX(-50%)', zIndex: 400,
          fontFamily: "'Fredoka', cursive", fontSize: 17, color: '#1A5C3A',
          background: '#B4E0C8', border: '2px solid #5CBFA0', borderRadius: 999,
          padding: '8px 20px', boxShadow: '0 4px 14px rgba(60,120,90,0.35)',
          animation: 'bounce-in 0.3s cubic-bezier(0.34,1.56,0.64,1)', pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 34, color: '#3D2B4F', textAlign: 'center' }}>
        💸 Spend
      </h2>

      {/* Balance */}
      <PixelPanel color="cream" style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 18, color: '#7B5EA7', fontWeight: 700 }}>
          You have
        </div>
        <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 44, color: '#E0A800', lineHeight: 1.1, textShadow: '0 2px 0 rgba(200,150,0,0.25)' }}>
          {coins.toLocaleString()} <CoinIcon size={24} />
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
                ? <>That's {spendCoinsForDollars.toLocaleString()} {coinName} <CoinIcon /></>
                : `Not enough ${coinName} — you have ${coins.toLocaleString()}`}
            </div>
          )}
          <KawaiiButton variant="primary" size="sm" onClick={handleLog} disabled={!canLog} style={{ width: '100%' }}>
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
                −{(e.amount || 0).toLocaleString()} <CoinIcon />
              </div>
            </div>
          ))}
        </PixelPanel>
      )}

      {/* RotBlock — gate distracting apps/sites behind your coins. Lives here under Spend. */}
      <PixelPanel color="lavender" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#3D2B4F' }}>🧠 RotBlock</div>
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: rbBlocked ? '#C44B6A' : '#7B5EA7', marginTop: 2, lineHeight: 1.45 }}>
            {rbOn
              ? (rbBlocked
                  ? `🔒 Out of coins — ${rbCount} ${rbCount === 1 ? 'Brainrot' : 'Brainrots'} locked`
                  : `🛡️ On · ${rbCount} ${rbCount === 1 ? 'Brainrot' : 'Brainrots'} guarded`)
              : <>Block distracting apps &amp; sites when you run low on {coinName}.</>}
          </div>
        </div>
        <KawaiiButton variant="primary" size="sm" onClick={() => navigate('/rotblock')} style={{ width: '100%', marginTop: 8 }}>
          {rbOn ? 'Manage RotBlock →' : 'Set up RotBlock →'}
        </KawaiiButton>
      </PixelPanel>
    </div>
  )
}

const inputStyle = {
  flex: 1,
  fontFamily: 'Mulish, sans-serif',
  fontSize: 15,
  padding: '7px 10px',
  borderRadius: 10,
  border: '2px solid #C8B4E0',
  background: '#FFF',
  color: '#3D2B4F',
  outline: 'none',
}
