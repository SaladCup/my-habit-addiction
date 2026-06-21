import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import useNow from '../hooks/useNow'
import { KawaiiButton, PixelPanel } from '../components/ui'

const desktop = (typeof window !== 'undefined' && window.desktop) ? window.desktop : null

function fmtTime(sec) {
  const m = Math.floor(sec / 60)
  if (m < 1) return `${Math.max(0, Math.round(sec))} sec`
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

const labelStyle = { fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#7B5EA7', display: 'block', marginBottom: 6 }
const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: 19,
  fontFamily: 'Mulish, sans-serif', color: '#3D2B4F', background: '#fff',
  border: '2px solid #ECC0DE', borderRadius: 12, outline: 'none', marginBottom: 10,
}

export default function RotBlockScreen() {
  const navigate = useNavigate()
  const rotblock = useStore(s => s.rotblock)
  const settings = useStore(s => s.settings)
  const coins = useStore(s => s.getCoinsAvailable())
  const rbRuntime = useStore(s => s.rbRuntime)
  const { rbSetEnabled, rbAddTarget, rbRemoveTarget, rbSetRuntime } = useStore.getState()

  const [kind, setKind] = useState('app')   // 'app' | 'site'
  const [text, setText] = useState('')
  const [capMsg, setCapMsg] = useState('')
  const [screenStatus, setScreenStatus] = useState('granted')   // Screen Recording (for Firefox titles)

  useEffect(() => {
    if (!desktop?.getScreenStatus) return
    let alive = true
    desktop.getScreenStatus().then(s => { if (alive) setScreenStatus(s) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const hasSiteTargets = rotblock.targets.some(t => t.kind === 'site')

  const now = useNow(1000)   // keep the Break Glass countdown / lock banner fresh
  const secPerCoin = settings.secondsPerCoin || 2
  const freeTimeSec = coins * secPerCoin
  const bgActive = rotblock.breakGlassUntil && rotblock.breakGlassUntil > now
  const bgMinsLeft = bgActive ? Math.ceil((rotblock.breakGlassUntil - now) / 60000) : 0
  const blocked = rotblock.enabled && !bgActive && coins <= 0

  function addManual() {
    const t = text.trim()
    if (!t) return
    if (/com\.lauren\.habitaddiction/i.test(t) || /habit addiction/i.test(t)) {
      setCapMsg('You can’t block this app itself 🙃')
      return
    }
    rbAddTarget({ label: t, kind, match: t })
    setText('')
  }

  async function captureApp() {
    setCapMsg('Looking at the front app…')
    if (!desktop?.getActiveApp) { setCapMsg('Capture only works in the desktop app.'); return }
    try {
      const res = await desktop.getActiveApp()
      if (res?.ok && res.app?.name) {
        const self = /com\.lauren\.habitaddiction/i.test(res.app.bundleId || '') || /habit addiction/i.test(res.app.name)
        if (self) { setCapMsg('That’s this app 🙃 — switch to the app you want to block first, then capture.'); return }
        rbAddTarget({ label: res.app.name, kind: 'app', match: res.app.bundleId || res.app.name })
        setCapMsg(`Added “${res.app.name}”.`)
      } else if (res?.needsPermission) {
        setCapMsg('Grant Accessibility (System Settings › Privacy & Security › Accessibility), then try again.')
      } else {
        setCapMsg('Couldn’t read the front app. Add it by name instead.')
      }
    } catch {
      setCapMsg('Couldn’t read the front app. Add it by name instead.')
    }
  }

  return (
    <div style={{ minHeight: '100%', padding: '22px 16px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 32, color: '#3D2B4F', margin: 0 }}>🧠 RotBlock</h2>
      <p style={{ fontFamily: 'Mulish, sans-serif', fontSize: 17, color: '#9B7EC8', maxWidth: 330, textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
        Pick your <b>Brainrots</b> — the apps or sites that eat your time. Using one spends your coins. Run out and it locks until you earn more.
      </p>

      {!desktop && (
        <div style={{ background: '#FFF4E0', border: '2px solid #F3D08A', borderRadius: 14, padding: '12px 16px', maxWidth: 360, fontFamily: 'Mulish, sans-serif', fontSize: 16, color: '#8A6A1E', textAlign: 'center' }}>
          Real blocking runs in the <b>desktop app</b>. Here in the browser you can set it all up and try the flow.
        </div>
      )}

      {/* STATUS */}
      <PixelPanel color="mint" title="STATUS" style={{ width: '100%', maxWidth: 380, marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#3D2B4F' }}>
            {rotblock.enabled ? '🛡️ RotBlock on' : '💤 RotBlock off'}
          </span>
          <KawaiiButton variant={rotblock.enabled ? 'secondary' : 'mint'} size="sm" onClick={() => rbSetEnabled(!rotblock.enabled)}>
            {rotblock.enabled ? 'TURN OFF' : 'TURN ON'}
          </KawaiiButton>
        </div>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 18, color: '#3D2B4F' }}>
          Free time banked: <b>{fmtTime(freeTimeSec)}</b> <span style={{ color: '#B79DD6' }}>({coins} coins)</span>
        </div>
        {bgActive && (
          <div style={{ marginTop: 8, color: '#2E7D52', fontFamily: 'Mulish, sans-serif', fontSize: 17 }}>
            🔓 Break Glass active — unlocked for ~{bgMinsLeft} more min
          </div>
        )}
        {blocked && !bgActive && (
          <div style={{ marginTop: 8, color: '#C44B6A', fontFamily: 'Mulish, sans-serif', fontSize: 17, fontWeight: 700 }}>
            🔒 Out of time — Brainrots are locked
          </div>
        )}
        {desktop && rotblock.enabled && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #BFE3D2', fontFamily: 'Mulish, sans-serif', fontSize: 16, color: '#3D2B4F' }}>
            {rbRuntime.permission === 'needed' ? (
              <span style={{ color: '#C44B6A' }}>⚠️ Can’t see the front app yet — grant Accessibility below.</span>
            ) : (
              <>👀 In front: <b>{rbRuntime.frontApp || '—'}</b>
                {rbRuntime.isBrainrot
                  ? (rbRuntime.draining
                      ? <span style={{ color: '#C9883C' }}> · ⏳ draining…</span>
                      : <span style={{ color: '#C44B6A' }}> · 🔒 blocked</span>)
                  : <span style={{ color: '#5CBFA0' }}> · ✓ not a Brainrot</span>}
              </>
            )}
          </div>
        )}
        {/* Only show the grant helper when the permission is actually missing — the
            silent trust check makes 'needed' reliable now, so this no longer nags
            once you're set up. */}
        {desktop?.platform === 'darwin' && desktop.openAccessibilitySettings && rbRuntime.permission === 'needed' && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #BFE3D2' }}>
            <KawaiiButton variant="secondary" size="sm" fullWidth onClick={() => desktop.openAccessibilitySettings()}>
              ⚙️ Open Accessibility Settings
            </KawaiiButton>
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginTop: 8, lineHeight: 1.4 }}>
              RotBlock needs this to see your front app &amp; browser tab. Add <b>My Habit Addiction</b>, turn it on, then fully quit &amp; reopen.
            </div>
          </div>
        )}
      </PixelPanel>

      {/* YOUR BRAINROTS */}
      <PixelPanel color="cream" title="YOUR BRAINROTS" style={{ width: '100%', maxWidth: 380 }}>
        {rotblock.targets.length === 0 ? (
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 17, color: '#B79DD6', textAlign: 'center', padding: '6px 0 12px' }}>
            None yet — add the first one below.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {rotblock.targets.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF5FB', border: '2px solid #ECC0DE', borderRadius: 12, padding: '8px 12px' }}>
                <span style={{ fontFamily: 'Mulish, sans-serif', fontSize: 18, color: '#3D2B4F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.kind === 'site' ? '🌐' : '📦'} {t.label}
                </span>
                <button onClick={() => rbRemoveTarget(t.id)} aria-label={`Remove ${t.label}`}
                  style={{ background: 'none', border: 'none', color: '#C44B6A', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* add a Brainrot */}
        <label style={labelStyle}>ADD A BRAINROT</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <KawaiiButton variant={kind === 'app' ? 'secondary' : 'ghost'} size="sm" onClick={() => setKind('app')}>📦 App</KawaiiButton>
          <KawaiiButton variant={kind === 'site' ? 'secondary' : 'ghost'} size="sm" onClick={() => setKind('site')}>🌐 Website</KawaiiButton>
        </div>
        <input
          style={inputStyle}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addManual() }}
          placeholder={kind === 'site' ? 'e.g. youtube.com' : 'e.g. Steam, or a game name'}
        />
        {kind === 'site' && (
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', margin: '0 0 10px', lineHeight: 1.4 }}>
            Matched by URL in Chrome, Safari, Edge, Brave, Opera &amp; Vivaldi — and by tab title in <b>Firefox</b> (enable Screen Recording below).
          </div>
        )}
        <KawaiiButton variant="primary" size="md" fullWidth onClick={addManual}>+ Add Brainrot</KawaiiButton>

        {/* Firefox & title matching needs Screen Recording (macOS). Only nudge when
            it'd actually help: a site Brainrot exists and the permission isn't granted. */}
        {desktop?.platform === 'darwin' && hasSiteTargets && screenStatus !== 'granted' && desktop.openScreenRecordingSettings && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #ECC0DE' }}>
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 8, lineHeight: 1.45 }}>
              🦊 To block sites in <b>Firefox</b>, RotBlock reads the tab title — which needs <b>Screen Recording</b>. (Other browsers already work via the URL.)
            </div>
            <KawaiiButton variant="secondary" size="sm" fullWidth onClick={() => desktop.openScreenRecordingSettings()}>
              🎬 Enable Firefox blocking
            </KawaiiButton>
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 12, color: '#B79DD6', marginTop: 6, lineHeight: 1.4 }}>
              Add <b>My Habit Addiction</b>, turn it on, then fully quit &amp; reopen.
            </div>
          </div>
        )}

        {desktop && (
          <>
            <KawaiiButton variant="mint" size="md" fullWidth onClick={captureApp} style={{ marginTop: 10 }}>
              🎯 Capture the app in front
            </KawaiiButton>
            {capMsg && <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 15, color: '#9B7EC8', marginTop: 8, textAlign: 'center' }}>{capMsg}</div>}
          </>
        )}
      </PixelPanel>

      {/* SEE IT IN ACTION — one honest demo: pop the real lock screen on demand. */}
      <PixelPanel color="sky" title="SEE IT IN ACTION" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 16, color: '#3D2B4F', marginBottom: 12, lineHeight: 1.5 }}>
          Curious what a block looks like? This pops the lock screen in front of you — exactly what happens when you run out of coins on a Brainrot. You can end it anytime.
        </div>
        <KawaiiButton variant="secondary" size="lg" fullWidth
          onClick={() => { rbSetRuntime({ testBlockUntil: Date.now() + 120000 }); navigate('/blocked') }}>
          🔒 Test a block
        </KawaiiButton>
      </PixelPanel>

      <KawaiiButton variant="ghost" size="md" onClick={() => navigate('/spend')}>← Back to Spend</KawaiiButton>
    </div>
  )
}
