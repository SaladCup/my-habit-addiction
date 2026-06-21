import { useEffect } from 'react'
import { getLevel } from '../engine/audioReactive'

// The audio-reactive rainbow edge glow ("audiolink"). A rainbow ring around the
// app that continuously rotates (CSS) and pulses with the music amplitude
// (--audio-level, set here each frame). With no audio it breathes gently, so
// there's always a soft rainbow frame.
export default function AudioRainbow() {
  useEffect(() => {
    let alive = true
    let raf = 0
    let smooth = 0.12
    const root = document.documentElement
    const tick = () => {
      if (!alive) return
      const raw = getLevel()
      // gentle idle breath so it's always alive; jump up to the real level when louder
      const idle = 0.12 + 0.05 * Math.sin(performance.now() / 1500)
      const target = Math.max(idle, raw)
      smooth += (target - smooth) * 0.2
      root.style.setProperty('--audio-level', smooth.toFixed(3))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { alive = false; cancelAnimationFrame(raf); root.style.removeProperty('--audio-level') }
  }, [])

  return <div className="audio-rainbow" aria-hidden="true" />
}
