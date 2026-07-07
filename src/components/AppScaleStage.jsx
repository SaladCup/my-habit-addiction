import { useStageScale, DESIGN_W, DESIGN_H } from '../hooks/stageScale'

// ── The one scaling rule for the whole app ───────────────────────────────────
// The entire UI is laid out at a FIXED design size (DESIGN_W × DESIGN_H px). The
// useStageScale hook applies TRUE PAGE ZOOM (Electron webFrame zoom in the app,
// <html> zoom in a plain browser) so the whole page — this stage, the sky, every
// fixed overlay, every compositor layer — scales together in one coherent pass.
// This stage is now just the design-size layout box, centered by #root.
//
// (History: scaling used to live HERE as transform → element zoom. Both scale a
// mid-tree element, and position:fixed children get captured/clipped against it
// unpredictably — the card-only overlay backdrops and the stage-edge sky seam.
// Page zoom is the mechanism desktop apps actually use, and has neither bug.)
export default function AppScaleStage({ children }) {
  useStageScale()   // applies the page zoom; re-applies on resize / App-size changes
  return (
    <div className="app-stage" style={{ width: DESIGN_W, height: DESIGN_H }}>
      {children}
    </div>
  )
}
