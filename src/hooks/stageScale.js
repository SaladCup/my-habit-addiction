import { useState, useEffect } from 'react'
import useStore from '../store/useStore'

// The fixed design resolution the whole UI is laid out at. The app scales this
// box uniformly to fit the window via TRUE PAGE ZOOM — Electron's webFrame zoom
// in the desktop app (the same mechanism Slack/VS Code use for UI scale), or
// zoom on <html> in a plain browser (the launcher). Page zoom scales layout,
// fixed overlays, and compositor layers in ONE coherent pass — unlike zoom or
// transform on a mid-tree element, which capture/clip position:fixed children
// unpredictably (the full-window-overlay and stage-edge-seam bugs).
export const DESIGN_W = 430
export const DESIGN_H = 880

const nativeZoom = typeof window !== 'undefined' && typeof window.desktop?.setZoomFactor === 'function'

// The zoom we've applied. In Electron, page zoom SHRINKS the reported CSS
// viewport (innerWidth = physical / zoom), so recovering the physical window
// size needs the current factor. Root-level CSS zoom leaves innerWidth alone
// (verified empirically).
let applied = 1

export function computeFit() {
  if (typeof window === 'undefined') return 1
  const k = nativeZoom ? applied : 1
  const physW = window.innerWidth * k
  const physH = window.innerHeight * k
  // Allow scaling up on large windows (capped) so the UI grows with the window.
  return Math.min(2.4, physW / DESIGN_W, physH / DESIGN_H)
}

function applyZoom(z) {
  if (Math.abs(z - applied) < 0.002) return
  applied = z
  if (nativeZoom) window.desktop.setZoomFactor(z)
  else document.documentElement.style.zoom = String(z)
}

// The live scale: auto fit-to-window × the user's "App size" preference. The hook
// APPLIES it as page zoom and returns the value (BeadJar3D uses it to match the
// canvas render resolution to the on-screen scale).
export function useStageScale() {
  const uiScale = useStore(s => s.settings.uiScale ?? 1)
  const [fit, setFit] = useState(computeFit)
  useEffect(() => {
    const recompute = () => setFit(computeFit())
    window.addEventListener('resize', recompute)
    const id = requestAnimationFrame(recompute)   // re-measure once after first paint
    return () => { window.removeEventListener('resize', recompute); cancelAnimationFrame(id) }
  }, [])
  const scale = fit * uiScale
  useEffect(() => { applyZoom(scale) }, [scale])
  return scale
}
