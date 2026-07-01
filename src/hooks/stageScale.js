import { useState, useEffect } from 'react'
import useStore from '../store/useStore'

// The fixed design resolution the whole UI is laid out at. AppScaleStage scales this
// box uniformly to fit the window; everything inside (px, the overlays, the jar) is
// sized in this stage space.
export const DESIGN_W = 430
export const DESIGN_H = 880

export function computeFit() {
  if (typeof window === 'undefined') return 1
  // Fit to the window, and allow scaling UP on large windows so the UI "scales
  // out" from center instead of sitting tiny in the middle (capped so it never
  // gets absurd on a huge display). On a wide window it fits by height, so the
  // background sky still shows down the sides.
  return Math.min(2.4, window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H)
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
