import { POSE_FIT } from '../content/habitChanScript'

// Renders a Habit-Chan pose NORMALIZED so the character is a consistent apparent size
// and her feet sit on a consistent baseline — regardless of how each PNG was drawn.
// The wrapper's BOTTOM edge is the feet baseline. `charVh` = target character height
// (in vh). Bounces in ONCE on mount (no key → swapping `pose` just changes the PNG,
// she stays a consistent being).
const DEFAULT_FIT = { fillH: 0.83, feet: 0.03 }

// charPx = target character height in PX (the overlays live inside the fixed-px scale
// stage, so we size in stage px — not vh, which would be viewport-relative and mismatch).
export default function HabitChanSprite({ pose, charPx = 380, style, bounce = true }) {
  const fit = POSE_FIT[pose] || DEFAULT_FIT
  const imgH = charPx / fit.fillH        // render the PNG taller/shorter so the character ≈ charPx
  const feetDrop = imgH * fit.feet       // shove the PNG down so its feet land on the baseline

  return (
    <div
      style={{
        position: 'relative', width: '100%', height: `${charPx}px`,
        pointerEvents: 'none',
        animation: bounce ? 'bounce-in 0.45s cubic-bezier(0.34,1.56,0.64,1)' : undefined,
        ...style,
      }}
    >
      <img
        src={`/habitchan/${pose}.png`}
        alt=""
        onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
        style={{
          position: 'absolute', left: '50%', bottom: `${-feetDrop}px`,
          transform: 'translateX(-50%)',
          height: `${imgH}px`, width: 'auto', objectFit: 'contain',
          filter: 'drop-shadow(0 12px 26px rgba(40,20,60,0.5))',
        }}
      />
    </div>
  )
}
