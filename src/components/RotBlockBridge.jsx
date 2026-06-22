import { useEffect } from 'react'
import useStore from '../store/useStore'

// Pushes the live RotBlock state (SITE targets + coins + Break Glass) to the
// desktop bridge server every couple of seconds, so the browser extension can
// read it and enforce site blocking as part of the coin economy. Also applies
// coin drains the extension reports (time spent on a Brainrot site). Desktop-only
// and renders nothing; inert in a browser.
export default function RotBlockBridge() {
  useEffect(() => {
    const desktop = (typeof window !== 'undefined') ? window.desktop : null
    if (!desktop?.isDesktop || !desktop.rbPublishState) return

    const publish = () => {
      const s = useStore.getState()
      try {
        desktop.rbPublishState({
          enabled: !!s.rotblock?.enabled,
          coins: s.getCoinsAvailable(),
          breakGlassUntil: s.rotblock?.breakGlassUntil || 0,
          secondsPerCoin: s.settings?.secondsPerCoin || 2,
          testBlockUntil: s.rbRuntime?.testBlockUntil || 0,
          // Only SITE targets — native apps stay with the desktop full-screen cover.
          siteTargets: (s.rotblock?.targets || [])
            .filter(t => t.kind === 'site')
            .map(t => ({ id: t.id, label: t.label, match: t.match })),
        })
      } catch { /* bridge optional — never let it break the app */ }
    }

    publish()                                 // push once immediately
    const iv = setInterval(publish, 2000)     // keep coins / Break-Glass timer fresh

    // The extension reports time-on-Brainrot as whole coins to spend.
    const offDrain = desktop.onRbDrain?.(({ coins, host }) => {
      const n = Math.floor(Number(coins) || 0)
      if (n > 0) { try { useStore.getState().rbDrain(n, host || 'site') } catch { /* */ } }
    })

    return () => { clearInterval(iv); offDrain?.() }
  }, [])

  return null
}
