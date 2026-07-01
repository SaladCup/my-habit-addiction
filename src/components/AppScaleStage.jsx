import { useStageScale, DESIGN_W, DESIGN_H } from '../hooks/stageScale'

// ── The one scaling rule for the whole app ───────────────────────────────────
// The entire UI is laid out at a FIXED design size (DESIGN_W × DESIGN_H px) and this
// stage scales it uniformly to fit the window: scale = min(w/W, h/H) × the user's
// "App size" preference. Because EVERY hardcoded px / font lives inside this one scaled
// stage, they all scale together by one rule — no values get rewritten.
//
// CSS `zoom` (standardized 2024), NOT transform: a transform makes position:fixed
// descendants resolve against the STAGE, so every overlay backdrop (Habit-Chan,
// bead reveal, popups) only dimmed the phone card. `zoom` scales layout the same
// way but leaves fixed elements anchored to the REAL window — `inset: 0` overlays
// now cover the whole window at any size, which is how desktop apps behave
// (Electron apps like Slack/VS Code use page zoom for exactly this). The 3D
// bead-jar canvas keeps its own dpr compensation (useStageScale) — unchanged.
export default function AppScaleStage({ children }) {
  const scale = useStageScale()
  return (
    <div className="app-stage" style={{ width: DESIGN_W, height: DESIGN_H, zoom: scale }}>
      {children}
    </div>
  )
}
