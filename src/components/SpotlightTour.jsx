import { useState, useEffect } from 'react'
import HabitChanSprite from './HabitChanSprite'
import { DESIGN_W, DESIGN_H } from '../hooks/stageScale'

// Coach-mark tour with a staged reveal:
//   1. you see the screen as-is, then it FOGS OUT (dim + blur fade in)
//   2. the target nav icon appears highlighted, then LIFTS up to the lower-middle,
//      growing big (below where the dialogue box lands)
//   3. as it arrives, Habit-Chan (top) + the dialogue box (middle) ease in
// Tap to advance; each next step re-flies the next icon. steps = [{ target, icon, pose, text }].
export default function SpotlightTour({ steps, onComplete, name = 'Habit-Chan' }) {
  const safe = Array.isArray(steps) && steps.length ? steps : []
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)   // nav target in the STAGE's own px space (not viewport)
  const step = safe[Math.min(i, safe.length - 1)] || { pose: 'happy', text: '' }

  useEffect(() => {
    function measure() {
      const el = document.querySelector(`[data-tour="${step.target}"]`)
      const stage = document.querySelector('.app-stage')
      if (!el || !stage) { setRect(null); return }
      const sr = stage.getBoundingClientRect()
      const nr = el.getBoundingClientRect()
      const scale = sr.width / DESIGN_W || 1   // the stage's current CSS scale
      // Convert the nav icon's viewport rect into the stage's own (unscaled) px space, so
      // the lifted icon positions correctly INSIDE the transformed stage.
      setRect({
        left: (nr.left - sr.left) / scale,
        top: (nr.top - sr.top) / scale,
        width: nr.width / scale,
        height: nr.height / scale,
      })
    }
    measure()
    const t = setTimeout(measure, 60)
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); window.removeEventListener('resize', measure) }
  }, [step.target])

  function advance() {
    if (i + 1 < safe.length) setI(v => v + 1)
    else onComplete?.()
  }

  // The icon flies from its real nav spot up to the LOWER-MIDDLE (below the box) + grows —
  // all in the stage's own px space (DESIGN_W × DESIGN_H).
  const iconBig = Math.min(DESIGN_W * 0.42, 172)
  const cx = DESIGN_W / 2
  const cy = DESIGN_H * 0.77
  let liftVars = null
  if (rect) {
    const nx = rect.left + rect.width / 2
    const ny = rect.top + rect.height / 2
    liftVars = {
      '--nav-dx': (nx - cx) + 'px',
      '--nav-dy': (ny - cy) + 'px',
      '--nav-scale': rect.width / iconBig || 0.4,
    }
  }
  const first = i === 0

  return (
    <div style={overlay} onClick={advance} role="dialog" aria-modal="true" aria-label={`${name}: ${step.text}`}>
      {/* Fog: homepage shows clear, then the dim + blur fade in (once). */}
      <div style={fogBg} />

      {/* Habit-Chan on TOP — centered in the space above the box; eases in with the box. */}
      <div style={chanWrap}>
        <HabitChanSprite pose={step.pose} charPx={300} bounce={false} />
      </div>

      {/* The highlighted icon — appears at the nav, then lifts to the lower-middle, growing. */}
      {rect && (
        <div
          key={i}
          style={{
            position: 'fixed', left: cx, top: cy, width: iconBig, height: iconBig,
            marginLeft: -iconBig / 2, marginTop: -iconBig / 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 3, ...liftVars,
            animation: `tour-lift2 ${first ? '1s' : '0.78s'} cubic-bezier(0.34,1,0.38,1) ${first ? '0.5s' : '0s'} both`,
          }}
        >
          <div style={glowRing} />
          <img src={step.icon} alt="" style={highlightIcon} />
        </div>
      )}

      {/* Dialogue box in the MIDDLE — eases in with Habit-Chan. */}
      <div style={box}>
        <div style={namePill}>{name} ✨</div>
        <div style={textStyle}>{step.text}</div>
        <div style={progress}>{i + 1} / {safe.length} · tap to continue ▸</div>
      </div>
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0, zIndex: 850,
  cursor: 'pointer', userSelect: 'none', overflow: 'hidden',
}
const fogBg = {
  position: 'fixed', inset: 0, zIndex: 0,
  background: 'rgba(40,26,58,0.82)',
  backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
  animation: 'tour-fog 0.55s ease 0.15s both',
}
const chanWrap = {
  position: 'fixed', top: 44, left: 0, right: 0,
  display: 'flex', justifyContent: 'center', zIndex: 2, pointerEvents: 'none',
  animation: 'tour-soft 0.5s ease 1.35s both',
}
const glowRing = {
  position: 'absolute', width: '170%', height: '170%', borderRadius: '50%',
  background: 'radial-gradient(closest-side, rgba(255,180,220,0.7), rgba(200,164,232,0.32) 60%, transparent 72%)',
  animation: 'tour-glow 1.5s ease-in-out infinite',
}
const highlightIcon = {
  position: 'relative', width: '100%', height: '100%', objectFit: 'contain',
  filter: 'drop-shadow(0 0 16px rgba(255,133,161,0.95)) drop-shadow(0 8px 16px rgba(120,90,160,0.6))',
}
const box = {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 'calc(100% - 44px)', maxWidth: 318, zIndex: 4,
  background: '#FFF5FB', border: '2.5px solid #ECC0DE', borderRadius: 18,
  boxShadow: '0 12px 34px rgba(60,30,80,0.5)',
  padding: '15px 15px 11px',
  animation: 'tour-soft 0.5s ease 1.35s both',
}
const namePill = {
  position: 'absolute', top: -14, left: 16,
  fontFamily: "'Fredoka', cursive", fontSize: 16, color: '#fff',
  background: 'linear-gradient(90deg,#FF85A1,#C8A4E8)',
  borderRadius: 999, padding: '2px 13px', boxShadow: '0 3px 0 #D4607A',
}
const textStyle = {
  fontFamily: 'Mulish, sans-serif', fontSize: 16.5, lineHeight: 1.45, color: '#3D2B4F', marginTop: 7, minHeight: 40,
}
const progress = {
  fontFamily: 'Mulish, sans-serif', fontSize: 12, color: '#B9A7D6', textAlign: 'right', marginTop: 5,
}
