import { useEffect, useMemo, useState, useRef, useLayoutEffect, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { BeadDisplay, KawaiiButton } from '../components/ui'
import { playBeadDraw } from '../engine/sounds'
import VisualNovel from '../components/VisualNovel'
import { FIRST_VISIT_CASHIN } from '../content/habitChanScript'
import { useFirstVisitPopIn } from '../hooks/useFirstVisitPopIn'
// Same 3D jar as Home — so the beads you drop here are the SAME beads waiting in
// the jar when you come back from the game.
const BeadJar3D = lazy(() => import('../components/BeadJar3D'))

const JAR_RATIO = 200 / 291   // BeadJar3D canvas aspect

// The "beads going into the jar" screen: the jar fills the screen, the cashed
// bead PNGs glow over the neck, then one at a time each pops and — at that
// instant — its 3D marble drops into the jar. When all are in → pick your game.
export default function CashInScreen() {
  const navigate = useNavigate()
  const { session, jarBeads, jarSeenCount, getBeadColor, markJarSeen } = useStore()
  const cashed = useMemo(() => session.cashedBeads || [], [session.cashedBeads])

  // Only reachable straight from a cash-in (cashInBeads set phase + cashedBeads).
  const [validEntry] = useState(() => session.phase === 'cashIn' && (session.cashedBeads?.length > 0))

  const [dropped, setDropped] = useState([])  // ids of beads the player has tapped in
  const release = dropped.length              // # of 3D marbles dropped = beads tapped in
  const { show: showPopIn, dismiss: dismissPopIn } = useFirstVisitPopIn('cashin')
  const [stage, setStage]     = useState('lineup')   // 'lineup' (title up) → 'tapping'
  const [done, setDone]       = useState(false)      // all in — linger; tap to go on

  const wrapRef = useRef(null)
  const [dims, setDims] = useState(null)

  const beads3d = useMemo(
    () => jarBeads.map(b => ({ id: b.id, color: getBeadColor(b.slot, b.isGold), isGold: b.isGold, isRainbow: b.isRainbow })),
    [jarBeads, getBeadColor]
  )

  // Size the jar as big as fits the screen (height-constrained on tall phones).
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const W = el.clientWidth, H = el.clientHeight
    let w = Math.min(W * 0.98, 460)
    let h = w / JAR_RATIO
    if (h > H * 0.84) { h = H * 0.84; w = h * JAR_RATIO }
    setDims({ w: Math.round(w), h: Math.round(h) })
  }, [])

  // Swoop the beads in, then hand control to the player: the title fades and the
  // beads become tappable (stage 'tapping').
  useEffect(() => {
    if (!validEntry) { navigate('/', { replace: true }); return }
    let cancelled = false
    const t = setTimeout(() => { if (!cancelled) setStage('tapping') }, 900)
    return () => { cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once every bead has been tapped in, let the last marble land, then settle the
  // jar and reveal "Select Game".
  useEffect(() => {
    if (dropped.length > 0 && dropped.length === cashed.length) {
      const t = setTimeout(() => { markJarSeen(); setDone(true) }, 1500)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropped.length, cashed.length])

  // Tapping a bead pops it and drops its marble into the jar.
  function dropBead(b) {
    if (stage !== 'tapping') return
    setDropped(prev => prev.includes(b.id) ? prev : [...prev, b.id])
    playBeadDraw(b.isGold ? 'gold' : b.isRainbow ? 'rainbow' : null)
  }

  if (!validEntry) return null

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {showPopIn && <VisualNovel script={FIRST_VISIT_CASHIN} onComplete={dismissPopIn} onSkip={dismissPopIn} />}
      {/* Big jar, centred — the SAME jar/beads as Home */}
      {dims && (
        <div style={{ position: 'absolute', left: '50%', top: '55%', transform: 'translate(-50%, -50%)', zIndex: 5 }}>
          <Suspense fallback={null}>
            <BeadJar3D beads={beads3d} seenCount={jarSeenCount} release={release} onSeen={markJarSeen}
              width={dims.w} height={dims.h} />
          </Suspense>
        </div>
      )}

      {/* Gold CASH IN title (fades out once the dropping begins) */}
      <div style={{
        position: 'absolute', top: '7%', left: 0, right: 0, textAlign: 'center', zIndex: 10,
        opacity: stage === 'lineup' ? 1 : 0,
        transform: stage === 'lineup' ? 'translateY(0)' : 'translateY(-14px)',
        transition: 'opacity 500ms ease, transform 500ms ease',
        pointerEvents: 'none',
      }}>
        <div style={{
          display: 'inline-block',
          fontFamily: "'Fredoka', cursive", fontSize: 40, letterSpacing: '0.06em',
          color: '#FFE9A0',
          background: 'linear-gradient(180deg, #FFF6C8 0%, #F5C44B 55%, #E6A800 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          textShadow: '0 2px 0 rgba(184,150,12,0.25)',
          filter: 'drop-shadow(0 3px 10px rgba(245,196,75,0.6))',
        }}>
          ✦ CASH IN ✦
        </div>
      </div>

      {/* Cashed bead PNGs — swoop in over the neck, glow, and wait to be tapped.
          Tapping one pops it and drops its marble into the jar. */}
      <div style={{
        position: 'absolute', top: '25%', left: 0, right: 0, zIndex: 11,
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14,
        pointerEvents: 'none',
      }}>
        {cashed.map((b, i) => {
          const color = getBeadColor(b.slot, b.isGold)
          const glow = b.isGold ? '#FFD700' : color
          const isDropped = dropped.includes(b.id)
          const tappable = stage === 'tapping' && !isDropped
          return (
            <div key={b.id} style={{ animation: `cashSwoop 0.6s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.13}s both`, pointerEvents: tappable ? 'auto' : 'none' }}>
              <button
                onClick={() => dropBead(b)}
                disabled={!tappable}
                aria-label="Drop bead into the jar"
                style={{ background: 'none', border: 'none', padding: 0, cursor: tappable ? 'pointer' : 'default' }}
              >
                <div style={{ animation: isDropped ? 'cashPop 0.3s ease-out forwards' : (tappable ? 'cashTapPulse 1.1s ease-in-out infinite' : 'cashBeadFloat 2.4s ease-in-out infinite') }}>
                  <BeadDisplay
                    color={color} slot={b.slot} isGold={b.isGold}
                    style={{ width: 64, height: 64, boxShadow: tappable ? `0 0 20px ${glow}, 0 0 44px ${glow}` : `0 0 16px ${glow}, 0 0 34px ${glow}aa` }}
                  />
                </div>
              </button>
            </div>
          )
        })}
      </div>

      {/* Tap prompt — shown while there are still beads to drop in */}
      <div style={{
        position: 'absolute', top: '40%', left: 0, right: 0, textAlign: 'center', zIndex: 11,
        pointerEvents: 'none',
        opacity: stage === 'tapping' && !done ? 1 : 0,
        transition: 'opacity 400ms ease',
      }}>
        <span style={{
          fontFamily: "'Fredoka', cursive", fontSize: 17, color: '#9B3D6B',
          background: 'rgba(255,245,251,0.9)', padding: '5px 16px', borderRadius: 999,
          boxShadow: '0 2px 8px rgba(155,126,200,0.25)',
        }}>
          👆 Tap each bead to drop it in! {dropped.length}/{cashed.length}
        </span>
      </div>

      {/* Once everything's in the jar: linger so you can admire it, then tap to
          go pick your game (no auto-advance). */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: '4%', zIndex: 14,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
        padding: '0 24px',
        opacity: done ? 1 : 0,
        transform: done ? 'translateY(0)' : 'translateY(18px)',
        transition: 'opacity 550ms ease, transform 550ms cubic-bezier(0.34,1.56,0.64,1)',
        pointerEvents: done ? 'auto' : 'none',
      }}>
        <div style={{
          fontFamily: 'Mulish, sans-serif', fontSize: 15, fontWeight: 800, color: '#9B3D6B',
          background: 'rgba(255,245,251,0.82)', padding: '4px 14px', borderRadius: 999,
          boxShadow: '0 2px 8px rgba(155,126,200,0.25)',
        }}>
          ✨ Beads added to your jar! ✨
        </div>
        <div style={{ width: '100%', maxWidth: 300 }}>
          <KawaiiButton variant="primary" size="lg" fullWidth onClick={() => navigate('/spin')}>
            ✦ Select Game →
          </KawaiiButton>
        </div>
      </div>

      <style>{`
        @keyframes cashSwoop {
          from { opacity: 0; transform: translateY(-34px) scale(0.4); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cashBeadFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-5px); }
        }
        @keyframes cashTapPulse {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-5px) scale(1.08); }
        }
        @keyframes cashPop {
          0%   { transform: scale(1);   opacity: 1; }
          45%  { transform: scale(1.55); opacity: 1; filter: brightness(1.5); }
          100% { transform: scale(0.15); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
