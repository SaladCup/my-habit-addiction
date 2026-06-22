import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import useNow from '../hooks/useNow'
import { KawaiiButton } from '../components/ui'

function fmtTime(sec) {
  const m = Math.floor(sec / 60)
  if (m < 1) return `${Math.max(0, Math.round(sec))} sec`
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

// The lock screen — shown when a Brainrot is opened with no free time left.
// Two honest ways back: earn more (do a habit) or the Break Glass override.
// Also shown on demand by the "Test a block" button (testBlock), so the user can
// SEE what a block looks like even when they have coins.
export default function BlockedScreen() {
  const navigate = useNavigate()
  const coins = useStore(s => s.getCoinsAvailable())
  const settings = useStore(s => s.settings)
  const rotblock = useStore(s => s.rotblock)
  const rbRuntime = useStore(s => s.rbRuntime)
  const freeTimeSec = coins * (settings.secondsPerCoin || 2)

  const now = useNow(1000)   // lock/clear flip must feel immediate
  const bgActive = rotblock.breakGlassUntil && rotblock.breakGlassUntil > now
  const testBlock = (rbRuntime.testBlockUntil || 0) > now
  const hasTime = !testBlock && (coins > 0 || bgActive)

  const endTest = () => {
    useStore.getState().rbSetRuntime({ testBlockUntil: 0 })
    try {
      if (window.desktop?.cover) window.desktop.cover(false)
      else if (window.desktop?.setOnTop) window.desktop.setOnTop(false)
    } catch { /* */ }
    navigate('/rotblock')
  }

  return (
    <div style={{
      // Full-viewport cover: fills the whole screen with the same purple (no
      // lavender margins / no card framing), sitting above everything.
      position: 'fixed', inset: 0, zIndex: 1000,
      padding: '32px 22px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 18,
      background: 'linear-gradient(180deg,#2E2440,#4A2E54)',
    }}>
      {/* Soft red whisper-glow hugging the screen edge — replaces the rainbow on the
          lock screen (a faint, blurry, translucent sliver). Only when actually
          locked/blocked (not on the "you're clear" state). Styles in global.css. */}
      {!hasTime && <div className="block-red-edge" aria-hidden="true"><div className="block-red-edge__ring" /></div>}
      <div style={{
        position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', textAlign: 'center', gap: 18, width: '100%', maxWidth: 360,
      }}>
      <div style={{ fontSize: 84 }}>{hasTime ? '🔓' : '🔒'}</div>
      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 34, color: '#FFE3F1', margin: 0 }}>
        {hasTime ? 'You’re clear' : 'Brainrot locked'}
      </h2>

      {testBlock ? (
        <>
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#FFD27A', letterSpacing: '0.08em', fontWeight: 700 }}>
            👀 PREVIEW
          </div>
          <p style={{ fontFamily: 'Mulish, sans-serif', fontSize: 19, color: '#E9D6F5', maxWidth: 330, lineHeight: 1.5, margin: 0 }}>
            This is what a block looks like. When you’re on a Brainrot with <b>0 coins</b>, this screen pops in front of it until you earn more time or Break Glass.
          </p>
          <KawaiiButton variant="primary" size="lg" onClick={endTest}>✓ End preview</KawaiiButton>
        </>
      ) : hasTime ? (
        <>
          <p style={{ fontFamily: 'Mulish, sans-serif', fontSize: 19, color: '#E9D6F5', maxWidth: 320, lineHeight: 1.5, margin: 0 }}>
            {bgActive
              ? 'Break Glass is active — you’re unlocked for now.'
              : <>You’ve got <b>{fmtTime(freeTimeSec)}</b> of free time banked. Enjoy it — it’s yours.</>}
          </p>
          <KawaiiButton variant="primary" size="lg" onClick={() => navigate(-1)}>Let me in →</KawaiiButton>
        </>
      ) : (
        <>
          <p style={{ fontFamily: 'Mulish, sans-serif', fontSize: 19, color: '#E9D6F5', maxWidth: 320, lineHeight: 1.5, margin: 0 }}>
            You’re out of free time. Earn more by doing a habit — or break the glass if you really need in.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6, width: '100%', maxWidth: 300 }}>
            <KawaiiButton variant="mint" size="lg" fullWidth onClick={() => navigate('/')}>
              ✅ Do a habit, earn time
            </KawaiiButton>
            <KawaiiButton variant="secondary" size="lg" fullWidth onClick={() => navigate('/break-glass')}>
              🔨 Break Glass
            </KawaiiButton>
          </div>
        </>
      )}
      </div>
    </div>
  )
}
