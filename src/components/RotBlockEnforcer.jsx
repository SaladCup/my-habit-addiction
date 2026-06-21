import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'

// The real enforcer (DESKTOP ONLY). Every POLL_MS it asks the native shell which
// app is in front; if it's one of your Brainrots it drains coins at your rate,
// and when you hit zero (with no Break Glass window) it pulls the lock screen to
// the front. Inert in a browser (window.desktop is undefined). Renders nothing.
const POLL_MS = 2000

function matchesApp(app, target) {
  if (!app || target.kind !== 'app') return false
  const m = (target.match || '').trim().toLowerCase()
  if (m.length < 2) return false
  const bundle = (app.bundleId || '').toLowerCase()
  const name = (app.name || '').toLowerCase()
  return bundle === m || name === m || (name && name.includes(m))
}

export default function RotBlockEnforcer() {
  const navigate = useNavigate()
  const aliveRef = useRef(false)
  const accRef = useRef(0)        // accumulated seconds-on-brainrot, for fractional draining
  const blockingRef = useRef(false)

  useEffect(() => {
    aliveRef.current = true       // MUST set true on setup (StrictMode double-mount safety)
    const desktop = (typeof window !== 'undefined') ? window.desktop : null
    if (!desktop?.isDesktop || !desktop.getActiveApp) return   // off-desktop = inert

    const tick = async () => {
      if (!aliveRef.current) return
      const s = useStore.getState()
      const rb = s.rotblock

      if (!rb.enabled) {
        accRef.current = 0
        blockingRef.current = false
        s.rbSetRuntime({ frontApp: null, isBrainrot: false, draining: false })
        return
      }

      let res
      try { res = await desktop.getActiveApp() } catch { res = null }
      if (!aliveRef.current) return
      const cur = useStore.getState()

      if (!res || res.ok === false) {
        cur.rbSetRuntime({ permission: res?.needsPermission ? 'needed' : 'unknown', draining: false })
        return
      }

      const app = res.app
      const isBrainrot = rb.targets.some(t => matchesApp(app, t))
      const coins = cur.getCoinsAvailable()
      const bgActive = rb.breakGlassUntil && rb.breakGlassUntil > Date.now()
      const blocked = isBrainrot && coins <= 0 && !bgActive

      cur.rbSetRuntime({
        frontApp: app?.name || null,
        isBrainrot,
        draining: isBrainrot && !blocked,
        permission: 'ok',
      })

      if (blocked) {
        accRef.current = 0
        try { desktop.focusSelf() } catch { /* */ }   // pull the lock screen to the front
        if (!blockingRef.current) { blockingRef.current = true; navigate('/blocked') }
      } else if (isBrainrot) {
        blockingRef.current = false
        accRef.current += POLL_MS / 1000
        const secPer = cur.settings.secondsPerCoin || 2
        const n = Math.floor(accRef.current / secPer)
        if (n > 0) { cur.rbDrain(n, app?.name || 'brainrot'); accRef.current -= n * secPer }
      } else {
        blockingRef.current = false
        accRef.current = 0
      }
    }

    const timer = setInterval(tick, POLL_MS)
    tick()
    return () => {
      aliveRef.current = false
      clearInterval(timer)
      try { window.desktop?.setOnTop?.(false) } catch { /* */ }
    }
  }, [navigate])

  return null
}
