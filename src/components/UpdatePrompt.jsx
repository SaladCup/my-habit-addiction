import { useEffect, useState } from 'react'
import { KawaiiButton } from './ui'

// Snooze key: stores the version the user tapped "Later" on, so we don't nag them
// again for THAT version (a newer one will still prompt).
const SNOOZE_KEY = 'habitAddict_updateSnoozed'

// Auto-update prompt. On the desktop app it asks the public releases repo whether
// a newer version exists (via window.desktop.checkForUpdate, no token needed) and,
// if so, shows a kawaii card whose button opens the right installer to download.
// In the browser (no window.desktop) it renders nothing.
export default function UpdatePrompt() {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    let alive = true
    // DEV-only preview test hook: load with ?testupdate=0.2.0 to force the prompt.
    let test = (typeof window !== 'undefined' && window.__testUpdate) || null
    if (!test && import.meta.env?.DEV && typeof window !== 'undefined') {
      const v = new URLSearchParams(window.location.search).get('testupdate')
      if (v) test = { latestVersion: v, downloadUrl: '#' }
    }
    const d = typeof window !== 'undefined' ? window.desktop : null
    const check = test
      ? Promise.resolve({ ok: true, updateAvailable: true, currentVersion: '0.1.10', ...test })
      : (d && d.checkForUpdate ? d.checkForUpdate() : null)
    if (!check) return   // browser / non-desktop: nothing to check
    check.then(res => {
      if (!alive || !res || !res.ok || !res.updateAvailable) return
      try { if (localStorage.getItem(SNOOZE_KEY) === res.latestVersion) return } catch { /* ignore */ }
      setInfo(res)
    }).catch(() => { /* offline / rate-limited: just skip quietly */ })
    return () => { alive = false }
  }, [])

  if (!info) return null

  const onUpdate = () => {
    if (window.desktop && window.desktop.openUpdateDownload) window.desktop.openUpdateDownload(info.downloadUrl)
    setInfo(null)
  }
  const onLater = () => {
    try { localStorage.setItem(SNOOZE_KEY, info.latestVersion) } catch { /* ignore */ }
    setInfo(null)
  }

  return (
    <div style={backdrop} role="dialog" aria-modal="true" aria-label="Update available">
      <div style={card}>
        <div style={{ fontSize: 46, lineHeight: 1 }}>🎀</div>
        <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 26, color: '#3D2B4F' }}>Update available!</div>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 16, color: '#7B5EA7', lineHeight: 1.5 }}>
          Version <b>v{info.latestVersion}</b> is ready
          {info.currentVersion ? <> — you have v{info.currentVersion}</> : null}. ✨
        </div>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B8AB5', lineHeight: 1.4 }}>
          Your habits, coins &amp; streaks are kept safe.
        </div>
        <KawaiiButton variant="primary" size="lg" onClick={onUpdate} style={{ width: '100%', marginTop: 4 }}>
          💖 Update now
        </KawaiiButton>
        <KawaiiButton variant="ghost" size="sm" onClick={onLater} style={{ width: '100%' }}>
          Later
        </KawaiiButton>
      </div>
    </div>
  )
}

const backdrop = {
  position: 'fixed', inset: 0, zIndex: 600,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(61,43,79,0.45)', backdropFilter: 'blur(2px)', padding: 24,
}
const card = {
  width: '100%', maxWidth: 340,
  background: '#FFF5FB', border: '3px solid #ECC0DE', borderRadius: 24,
  boxShadow: '0 16px 50px rgba(120,90,160,0.45)',
  padding: '26px 22px', textAlign: 'center',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
}
