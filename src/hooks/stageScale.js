import { useState, useEffect } from 'react'
import useStore from '../store/useStore'

// The fixed design resolution the whole UI is laid out at. AppScaleStage scales this
// box uniformly to fit the window; everything inside (px, the overlays, the jar) is
// sized in this stage space.
export const DESIGN_W = 430
export const DESIGN_H = 880

export function computeFit() {
  if (typeof window === 'undefined') return 1
  // Cap at 1.0 — never scale up beyond the design size on large desktop windows.
  return Math.min(1, window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H)
}

// The live stage scale: auto fit-to-window × the user's "App size" fine-tune (1 = fit).
// Used by AppScaleStage (the transform) and by the 3D jar (to match its render
// resolution to the on-screen scale, since CSS-scaling a canvas blurs it).
export function useStageScale() {
  const uiScale = useStore(s => s.settings.uiScale ?? 1)
  const [fit, setFit] = useState(computeFit)
  useEffect(() => {
    const recompute = () => setFit(computeFit())
    window.addEventListener('resize', recompute)
    const id = requestAnimationFrame(recompute)   // re-measure once after first paint
    return () => { window.removeEventListener('resize', recompute); cancelAnimationFrame(id) }
  }, [])
  return fit * uiScale
}
