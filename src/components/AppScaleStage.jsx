import { useStageScale, DESIGN_W, DESIGN_H } from '../hooks/stageScale'

// ── The one scaling rule for the whole app ───────────────────────────────────
// The entire UI is laid out at a FIXED design size (DESIGN_W × DESIGN_H px) and this
// stage scales it uniformly to fit the window: scale = min(w/W, h/H) × the user's
// "App size" preference. Because EVERY hardcoded px / font lives inside this one scaled
// stage, they all scale together by one rule — no values get rewritten.
//
// A CSS transform here also makes position:fixed/absolute descendants resolve against
// THIS stage instead of the viewport, so overlays (tour, modals, popups) line up with
// the card automatically. The 3D bead-jar canvas is handled separately (its own dpr) —
// CSS-scaling a canvas would blur it.
export default function AppScaleStage({ children }) {
  const scale = useStageScale()
  return (
    <div className="app-stage" style={{ width: DESIGN_W, height: DESIGN_H, transform: `scale(${scale})` }}>
      {children}
    </div>
  )
}
