import { useEffect, useMemo, useState, useRef, useLayoutEffect, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { FloatingDecor, BeadDisplay } from '../components/ui'
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

  const [release, setRelease] = useState(0)   // # of 3D marbles dropped so far
  const [popped, setPopped]   = useState(0)   // # of PNG beads that have popped
  const [stage, setStage]     = useState('lineup')   // 'lineup' (title up) → 'dropping'

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

  // The choreography: swoop-in → title fades → pop+drop each bead → pick a game.
  useEffect(() => {
    if (!validEntry) { navigate('/', { replace: true }); return }
    let cancelled = false
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    ;(async () => {
      await sleep(900)                       // beads swoop in & line up under the title
      if (cancelled) return
      setStage('dropping')                   // gold CASH IN title fades away
      await sleep(500)
      for (let i = 0; i < cashed.length; i++) {
        if (cancelled) return
        await sleep(i === 0 ? 300 : 900)     // slow, savor-able pacing between pops
        setPopped(i + 1)                     // PNG i pops & vanishes
        await sleep(150)                     // burst, THEN the marble appears to fall from it
        setRelease(i + 1)                    // 3D marble i drops into the jar
      }
      await sleep(1400)                      // let the last marble land
      if (cancelled) return
      markJarSeen()                          // the cashed beads are now part of the pile
      navigate('/spin')
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!validEntry) return null

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <FloatingDecor />

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

      {/* Cashed bead PNGs — swoop in over the neck, glow, then pop one by one */}
      <div style={{
        position: 'absolute', top: '25%', left: 0, right: 0, zIndex: 11,
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14,
        pointerEvents: 'none',
      }}>
        {cashed.map((b, i) => {
          const color = getBeadColor(b.slot, b.isGold)
          const glow = b.isGold ? '#FFD700' : color
          return (
            <div key={b.id} style={{ animation: `cashSwoop 0.6s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.13}s both` }}>
              <div style={{ animation: i < popped ? 'cashPop 0.3s ease-out forwards' : 'cashBeadFloat 2.4s ease-in-out infinite' }}>
                <BeadDisplay
                  color={color} slot={b.slot} isGold={b.isGold}
                  style={{ width: 64, height: 64, boxShadow: `0 0 16px ${glow}, 0 0 34px ${glow}aa` }}
                />
              </div>
            </div>
          )
        })}
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
        @keyframes cashPop {
          0%   { transform: scale(1);   opacity: 1; }
          45%  { transform: scale(1.55); opacity: 1; filter: brightness(1.5); }
          100% { transform: scale(0.15); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
