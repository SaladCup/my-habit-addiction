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

// Is the foreground app OUR app? (so covering ourselves doesn't read as "left the
// Brainrot"). 'Electron' in dev; productName / bundleId when packaged.
function isOwnApp(app) {
  if (!app) return false
  if (app.bundleId === 'com.lauren.habitaddiction') return true
  return !!app.name && /^electron$|habit addiction/i.test(app.name)
}

export default function RotBlockEnforcer() {
  const navigate = useNavigate()
  const aliveRef = useRef(false)
  const accRef = useRef(0)         // accumulated seconds-on-brainrot, for fractional draining
  const blockingRef = useRef(false)

  useEffect(() => {
    aliveRef.current = true        // MUST set true on setup (StrictMode double-mount safety)
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
      try { desktop.setOnTop?.(true) } catch { /* */ }
      try { desktop.focusSelf?.() } catch { /* */ }
      if (!String(window.location.hash).startsWith('#/blocked')) navigate('/blocked')
    }
    const releaseBlock = () => {
      if (!blockingRef.current) return
      blockingRef.current = false
      try { desktop.setOnTop?.(false) } catch { /* */ }
    }

    const tick = async () => {
      if (!aliveRef.current) return
      if (!useStore.getState().rotblock.enabled) {
        accRef.current = 0; releaseBlock()
        publish(null, false, false, 'ok')
        return
      }

      let res
      try { res = await desktop.getActiveApp() } catch { res = null }
      if (!aliveRef.current) return
      const cur = useStore.getState()
      if (!cur.rotblock.enabled) { releaseBlock(); return }   // re-check after the await

      if (!res || res.ok === false) {
        publish(cur.rbRuntime.frontApp, cur.rbRuntime.isBrainrot, false, res?.needsPermission ? 'needed' : 'unknown')
        return
      }

      const app = res.app
      const rb = cur.rotblock
      const isBrainrot = rb.targets.some(t => matchesApp(app, t))
      const broke = cur.getCoinsAvailable() <= 0 && !(rb.breakGlassUntil && rb.breakGlassUntil > Date.now())
      const blocked = isBrainrot && broke

      publish(app?.name || null, isBrainrot, isBrainrot && !blocked, 'ok')

      if (blocked) {
        accRef.current = 0
        enterBlock()
      } else if (isOwnApp(app) && broke && blockingRef.current) {
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
      if (!aliveRef.current) return
      await tick()
      if (!aliveRef.current) return
      timer = setTimeout(loop, POLL_MS)
    }
    loop()

    return () => {
      aliveRef.current = false
      if (timer) clearTimeout(timer)
      try { window.desktop?.setOnTop?.(false) } catch { /* */ }
    }
  }, [navigate])

  return null
}
