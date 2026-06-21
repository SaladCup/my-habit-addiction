import { useEffect } from 'react'
import { getLevel } from '../engine/audioReactive'

const IDLE = 0.12   // resting level: a soft, always-present rainbow frame

// The audio-reactive rainbow edge glow ("audiolink"). A rainbow ring around the
// app card that continuously rotates (CSS) and pulses with the music amplitude
// (--audio-level, set here each frame). With no audio it breathes gently, so
// there's always a soft rainbow frame.
export default function AudioRainbow() {
  useEffect(() => {
    const root = document.documentElement

    // Respect reduced-motion: hold a soft STATIC frame — no per-frame pulsing
    // (the CSS disables the spin under the same query). One less moving thing.
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      root.style.setProperty('--audio-level', String(IDLE))
      return
    }

    let alive = true
    let raf = 0
    let smooth = IDLE
    const tick = () => {
      if (!alive) return
      const raw = getLevel()
      // gentle idle breath so it's always alive; jump up to the real level when louder
      const idle = IDLE + 0.05 * Math.sin(performance.now() / 1500)
      const target = Math.max(idle, raw)
      smooth += (target - smooth) * 0.2
      root.style.setProperty('--audio-level', smooth.toFixed(3))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // On cleanup, settle to the idle floor rather than removing the var (so the
    // ring stays soft instead of snapping to its CSS fallback) — defensive; this
    // component is mounted for the app's lifetime.
    return () => { alive = false; cancelAnimationFrame(raf); root.style.setProperty('--audio-level', String(IDLE)) }
  }, [])

  // Wrapper carries the blur; the inner ring carries the masked rainbow band.
  // Blur on the PARENT applies AFTER the child's mask, so the band's EDGES go
  // soft/blurry (a blur on the masked element itself would be re-sharpened by
  // the mask and only soften the colors, not the edges).
  return (
    <div className="audio-rainbow" aria-hidden="true">
      <div className="audio-rainbow__ring" />
    </div>
  )
}
