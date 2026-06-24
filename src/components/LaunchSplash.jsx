import { useEffect, useState } from 'react'

// Launch animation (~4s): the animated "My Habit Addiction" title springs in with a
// magical pop over an OPAQUE dreamy background, holds (sparkling), then the whole
// splash blurs + fades away to reveal the home screen.
//
// IMPORTANT: the animated title is an ANIMATED WEBP (title-animation.webp) shown via
// <img>, NOT a <video>. In the packaged app, assets are served over the custom app://
// protocol, whose handler returns whole files with HTTP 200 and no Range support —
// and Chromium media elements (<video>/<audio>) REQUIRE range requests, so a <video>
// silently fails to load over app:// (same gotcha that broke the bg music). An
// animated WebP decodes through the IMAGE pipeline (like the slot PNGs), which needs
// no range support, so it loads + animates fine over app://.
//
// The title's logo is fully formed from frame 1 — its animation is ambient sparkle,
// not a fly-in — so a short window never cuts anything off. The magical pop is a CSS
// scale entrance on top. Opaque background (solid fill under the sunburst image) means
// home never flashes underneath before the splash covers.
// Tunable phases (total ≈ POP + PAUSE + EXIT):
const POP_MS   = 1900  // pop entrance arc: small → swell past full → dip → bounce → settle
const PAUSE_MS = 2000  // fully-settled hold, so you can take the whole logo in
const EXIT_MS  = 1000  // blur + fade reveal of home
const HOLD_MS  = POP_MS + PAUSE_MS   // mount → exit begins

export default function LaunchSplash() {
  const [phase, setPhase] = useState('show')   // 'show' → 'exit' → 'gone'

  useEffect(() => {
    const tExit = setTimeout(() => setPhase('exit'), HOLD_MS)
    const tGone = setTimeout(() => setPhase('gone'), HOLD_MS + EXIT_MS)
    return () => { clearTimeout(tExit); clearTimeout(tGone) }
  }, [])

  if (phase === 'gone') return null
  const exiting = phase === 'exit'

  return (
    <div
      className="bg-sunburst"
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        // Solid fill UNDER the sunburst image so the splash is opaque on the very
        // first paint — home can never flash through before the image loads.
        backgroundColor: '#E9D7F2',
        // On exit the whole splash blurs + fades, dissolving away to reveal home.
        opacity: exiting ? 0 : 1,
        filter: exiting ? 'blur(16px)' : 'blur(0px)',
        transition: `opacity ${EXIT_MS}ms ease, filter ${EXIT_MS}ms ease`,
        pointerEvents: exiting ? 'none' : 'auto',
        willChange: 'opacity, filter',
      }}
    >
      <img
        src="/title-animation.webp"
        alt="My Habit Addiction"
        draggable={false}
        style={{
          width: '90%', maxWidth: 430, height: 'auto', display: 'block',
          // "Magical pop" — springs up with a soft overshoot, then a DAMPED settle
          // (1.18 → 0.96 → 1.02 → 1.0) so the end glides smoothly into place. A
          // non-springy ease keeps the final step from wobbling past size. The webp
          // plays its sparkle/shimmer underneath this scale entrance.
          animation: `splash-pop ${POP_MS}ms cubic-bezier(0.33,0.85,0.4,1) both`,
          willChange: 'transform, opacity',
        }}
      />

      <style>{`
        @keyframes splash-pop {
          0%   { opacity: 0; transform: scale(0.35); }   /* start small */
          45%  { opacity: 1; transform: scale(1.18); }   /* swell in BIG (overshoot) */
          68%  { transform: scale(0.96); }               /* setback dip */
          86%  { transform: scale(1.02); }               /* bounce back */
          100% { transform: scale(1); }                  /* settle — smooth landing */
        }
      `}</style>
    </div>
  )
}
