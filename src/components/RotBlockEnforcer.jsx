import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'

// The real enforcer (DESKTOP ONLY). On a self-scheduling ~2s loop it asks the
// native shell which app is in front; if it's one of your Brainrots it drains
// coins at your rate, and when you hit zero (no Break Glass) it covers the
// Brainrot with the lock screen (window pulled on top). Inert in a browser
// (window.desktop is undefined). Renders nothing.
//
// Design notes (from review): a setTimeout CHAIN (not setInterval) means a slow
// getActiveApp can never overlap-tick → no double-drain / focus storm. The block
// is a transition-latched "cover on top" — we focus + setAlwaysOnTop ONCE on
// entering the block, then hold; we never re-steal focus every tick. Because
// covering ourselves makes US the foreground app, we treat "front app is us,
// still broke, already blocking" as a HOLD (don't release) so it can't oscillate.
const POLL_MS = 2000

function matchesApp(app, target) {
  if (!app || target.kind !== 'app') return false
  const m = (target.match || '').trim().toLowerCase()
  if (m.length < 2) return false
  const bundle = (app.bundleId || '').toLowerCase()
  const name = (app.name || '').toLowerCase()
  if (bundle === m || name === m) return true
  // substring match only for longer strings, so a 2-char target can't over-match
  return m.length >= 4 && !!name && name.includes(m)
}

// Browsers whose WINDOW TITLE we'll keyword-match (a fallback for Firefox, which
// doesn't expose the tab URL like Chrome/Safari/Edge/Brave/Opera/Vivaldi do).
const BROWSER_RE = /firefox|mozilla|chrome|chromium|safari|edge|brave|opera|vivaldi|tor browser|\barc\b|browser/i

// Match a SITE Brainrot two ways (both, so it's added capability, not a swap):
//   1) by the active tab URL (browsers that expose it) — precise hostname match.
//   2) by the window TITLE keyword (Firefox & any browser) — the page title almost
//      always contains the site name, e.g. "… - YouTube". Gated to browser windows
//      so a random app titled "youtube notes" can't trip it.
function matchesSite(app, target) {
  if (!app || target.kind !== 'site') return false
  const m = (target.match || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  if (m.length < 3) return false

  // 1) URL hostname match
  if (app.url) {
    let host
    try { host = new URL(app.url).hostname.toLowerCase().replace(/^www\./, '') } catch { host = '' }
    if (host) {
      if (m.includes('.')) { if (host === m || host.endsWith('.' + m)) return true }
      else if (host.split('.').includes(m)) return true
    }
  }

  // 2) Title keyword match (e.g. target "youtube.com" → keyword "youtube")
  if (app.title && BROWSER_RE.test(app.name || '')) {
    const keyword = m.includes('.') ? m.split('.')[0] : m
    if (keyword.length >= 3 && app.title.toLowerCase().includes(keyword)) return true
  }

  return false
}

function matchesTarget(app, target) {
  return target.kind === 'site' ? matchesSite(app, target) : matchesApp(app, target)
}

// Is the foreground app OUR app? (so covering ourselves doesn't read as "left the
// Brainrot"). 'Electron' in dev; productName / bundleId when packaged.
function isOwnApp(app) {
  if (!app) return false
  if (app.bundleId === 'com.lauren.habitaddiction') return true
  return !!app.name && /^electron$|habit addiction/i.test(app.name)
}

export default function RotBlockEnforcer() {
  const navigate = useNavigate()
  const accRef = useRef(0)         // accumulated seconds-on-brainrot, for fractional draining
  const blockingRef = useRef(false)

  // One-time cleanup: drop any "self" Brainrot (e.g. the habit app captured by
  // mistake), which would otherwise let the app block/trap itself.
  useEffect(() => {
    const st = useStore.getState()
    const bad = st.rotblock.targets.filter(t =>
      /com\.lauren\.habitaddiction/i.test(t.match || '') || /habit addiction/i.test(t.label || ''))
    bad.forEach(t => st.rbRemoveTarget(t.id))
  }, [])

  useEffect(() => {
    let alive = true               // per-effect-run liveness token (own your own cancellation)
    const desktop = (typeof window !== 'undefined') ? window.desktop : null
    if (!desktop?.isDesktop || !desktop.getActiveApp) return   // off-desktop = inert

    let timer = null
    let lastKey = ''               // de-dupe rbRuntime writes (avoid a 2s re-render heartbeat)

    const publish = (frontApp, isBrainrot, draining, permission) => {
      const key = `${frontApp}|${isBrainrot}|${draining}|${permission}`
      if (key === lastKey) return
      lastKey = key
      useStore.getState().rbSetRuntime({ frontApp, isBrainrot, draining, permission })
    }

    const enterBlock = () => {
      if (blockingRef.current) return        // act ONCE on the transition
      blockingRef.current = true
      // Grow the (phone-narrow) window to FILL the screen so the Brainrot is fully
      // covered and unclickable — not just stacked in front with the video showing
      // around the edges. Falls back to plain on-top+focus if cover isn't available.
      try { if (desktop.cover) desktop.cover(true); else { desktop.setOnTop?.(true); desktop.focusSelf?.() } } catch { /* */ }
      if (!String(window.location.hash).startsWith('#/blocked')) navigate('/blocked')
    }
    const releaseBlock = () => {
      if (!blockingRef.current) return
      blockingRef.current = false
      try { if (desktop.cover) desktop.cover(false); else desktop.setOnTop?.(false) } catch { /* */ }
      // Pop the lock route on the genuine block->release transition so the UI can't
      // be left stranded on /blocked after the cover is dropped.
      if (String(window.location.hash).startsWith('#/blocked')) navigate('/rotblock')
    }

    const tick = async () => {
      if (!alive) return
      if (!useStore.getState().rotblock.enabled) {
        accRef.current = 0; releaseBlock()
        publish(null, false, false, 'ok')
        return
      }

      let res
      try { res = await desktop.getActiveApp() } catch { res = null }
      if (!alive) return
      const cur = useStore.getState()
      if (!cur.rotblock.enabled) { releaseBlock(); return }   // re-check after the await

      if (!res || res.ok === false) {
        // Front app is unreadable (e.g. Accessibility revoked). Don't strand a held
        // block: re-evaluate broke independently so earning coins / finishing Break
        // Glass still lifts the always-on-top cover regardless of permission state.
        const stillBroke = cur.getCoinsAvailable() <= 0 && !(cur.rotblock.breakGlassUntil && cur.rotblock.breakGlassUntil > Date.now())
        if (!stillBroke) releaseBlock()
        publish(cur.rbRuntime.frontApp, cur.rbRuntime.isBrainrot, false, res?.needsPermission ? 'needed' : 'unknown')
        return
      }

      const app = res.app
      const rb = cur.rotblock
      // "Test a block" arms this for ~30s: it just PRETENDS you're out of coins, so
      // switching to a real Brainrot (e.g. YouTube) covers it — demonstrating the
      // actual behavior, instead of covering the habit app you clicked from.
      const testBlock = (cur.rbRuntime.testBlockUntil || 0) > Date.now()
      // HARD GUARD: the habit app can never be a Brainrot (so it can't block itself
      // and trap the user — e.g. if it was accidentally added via Capture).
      const isBrainrot = !isOwnApp(app) && rb.targets.some(t => matchesTarget(app, t))
      const broke = cur.getCoinsAvailable() <= 0 && !(rb.breakGlassUntil && rb.breakGlassUntil > Date.now())
      const blocked = isBrainrot && (broke || testBlock)

      publish(app?.name || null, isBrainrot, isBrainrot && !blocked, 'ok')

      if (blocked) {
        accRef.current = 0
        enterBlock()
      } else if (isOwnApp(app) && (broke || testBlock) && blockingRef.current) {
        // We covered the Brainrot, so WE are now in front — hold the block (don't
        // release, don't re-focus) until they earn coins / Break Glass / disable.
      } else {
        releaseBlock()
        if (isBrainrot) {
          accRef.current += POLL_MS / 1000
          const secPer = cur.settings.secondsPerCoin > 0 ? cur.settings.secondsPerCoin : 2
          const n = Math.floor(accRef.current / secPer)
          if (n > 0) { cur.rbDrain(n, app?.name || 'brainrot'); accRef.current -= n * secPer }
        } else {
          accRef.current = 0
        }
      }
    }

    // self-scheduling loop — next tick only AFTER the current one resolves (no overlap)
    const loop = async () => {
      if (!alive) return
      await tick()
      if (!alive) return
      timer = setTimeout(loop, POLL_MS)
    }
    loop()

    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      blockingRef.current = false   // drop the latch too, so a fresh run re-asserts the cover when still blocked
      try { if (window.desktop?.cover) window.desktop.cover(false); else window.desktop?.setOnTop?.(false) } catch { /* */ }
    }
  }, [navigate])

  return null
}
