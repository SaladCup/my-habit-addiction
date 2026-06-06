import { useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { buildWheelSegments, getWheelStopAngle } from '../engine/gameLogic'
import { playSpinStart, playNearMiss, playWin, playWheelTick } from '../engine/sounds'

// ── Layout ──
// The decorative rim / hub / pointer are PNG art (public/ui/wheel_*.png).
// Only the colored value segments are drawn dynamically in SVG and spin
// underneath the static gold ring, so prize values can still scale by tier.
const BOX = 320                    // wheel container (px)
const CX = 160, CY = 160           // SVG center
const R = 142                      // segment radius — tucks just under the rim's inner lip
const R_TEXT = 104                 // label radius (safely inside the ring)
const HUB = 80                     // center-cap display size
const POINTER_W = 78               // pointer display width

const TIER_CFG = {
  t1:      { fill: '#FFB7C5', stroke: '#FF85A1', text: '#7A2040', label: 'T1',    fontSize: 15 },
  t2:      { fill: '#C8B4E0', stroke: '#9B7EC8', text: '#3D1A6E', label: 'T2',    fontSize: 15 },
  t3:      { fill: '#B4E0C8', stroke: '#5CBFA0', text: '#1A5C3A', label: 'T3',    fontSize: 15 },
  bonus:   { fill: '#FFE9A0', stroke: '#F5C44B', text: '#5C3A00', label: 'BONUS', fontSize: 11 },
  jackpot: { fill: '#FFD700', stroke: '#E6B800', text: '#5C3A00', label: '💎',    fontSize: 17 },
}

const TIER_ORDER = { t1: 1, t2: 2, t3: 3, bonus: 99, jackpot: 99 }

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)]
}

function wedge(cx, cy, r, start, end) {
  const [x1, y1] = polar(cx, cy, r, start)
  const [x2, y2] = polar(cx, cy, r, end)
  const large = end - start > 180 ? 1 : 0
  return `M${cx},${cy} L${x1},${y1} A${r},${r},0,${large},1,${x2},${y2}Z`
}

const SEGMENTS = buildWheelSegments()
const SEG_SIZE = 360 / SEGMENTS.length // for pointer-tick boundary detection

const Wheel = forwardRef(function Wheel(
  { activeTier = 1, awardedResult, rawResult, isNearMiss, onDone },
  ref
) {
  const wrapRef = useRef(null)
  const pointerRef = useRef(null)
  const rotRef = useRef(0)
  const trackingRef = useRef(false)
  const [spinning, setSpinning] = useState(false)
  const [done, setDone] = useState(false)

  useImperativeHandle(ref, () => ({ spin: doSpin }))

  function triggerPointerTick() {
    playWheelTick()
    const el = pointerRef.current
    if (!el) return
    // Restart the CSS animation by removing and re-applying it
    el.style.animation = 'none'
    void el.offsetWidth // force reflow
    el.style.animation = 'wheel-peg-tick 175ms ease-out forwards'
  }

  function startPointerTracking() {
    let lastSegIndex = -1
    let lastTickTime = 0
    trackingRef.current = true

    function track() {
      if (!trackingRef.current) return
      const el = wrapRef.current
      if (!el) { requestAnimationFrame(track); return }

      const style = window.getComputedStyle(el)
      const mat = new DOMMatrixReadOnly(style.transform)
      // atan2(b, a) gives the clockwise rotation angle
      const angleDeg = ((Math.atan2(mat.b, mat.a) * 180 / Math.PI) + 360) % 360
      const segIndex = Math.floor(angleDeg / SEG_SIZE)
      const now = performance.now()

      if (segIndex !== lastSegIndex && lastSegIndex !== -1 && now - lastTickTime > 60) {
        triggerPointerTick()
        lastTickTime = now
      }
      lastSegIndex = segIndex
      requestAnimationFrame(track)
    }
    requestAnimationFrame(track)
  }

  async function doSpin() {
    if (spinning || !awardedResult) return
    setSpinning(true)
    setDone(false)
    playSpinStart()

    const el = wrapRef.current
    if (!el) return

    const { stopAngle, nearMissAngle } = getWheelStopAngle(
      awardedResult, rawResult || awardedResult, isNearMiss, SEGMENTS
    )
    const start = rotRef.current

    startPointerTracking()

    if (isNearMiss && nearMissAngle != null) {
      const a1 = el.animate(
        [{ transform: `rotate(${start}deg)` }, { transform: `rotate(${nearMissAngle}deg)` }],
        { duration: 4600, easing: 'cubic-bezier(0.2, 0.0, 0.1, 1.0)', fill: 'forwards' }
      )
      await a1.finished
      trackingRef.current = false // stop ticking before near-miss snap
      playNearMiss()
      const a2 = el.animate(
        [{ transform: `rotate(${nearMissAngle}deg)` }, { transform: `rotate(${stopAngle}deg)` }],
        { duration: 650, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' }
      )
      await a2.finished
    } else {
      // Phase 1: decelerate to slight overshoot past target
      const overshoot = stopAngle + 8
      const a1 = el.animate(
        [{ transform: `rotate(${start}deg)` }, { transform: `rotate(${overshoot}deg)` }],
        { duration: 5000, easing: 'cubic-bezier(0.25, 0.05, 0.08, 1.0)', fill: 'forwards' }
      )
      await a1.finished
      trackingRef.current = false // stop ticking before spring settle

      // Phase 2: spring settle back to exact target
      const a2 = el.animate(
        [{ transform: `rotate(${overshoot}deg)` }, { transform: `rotate(${stopAngle}deg)` }],
        { duration: 360, easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)', fill: 'forwards' }
      )
      await a2.finished
    }

    const final = stopAngle % 360
    el.getAnimations().forEach(a => a.cancel())
    el.style.transform = `rotate(${final}deg)`
    rotRef.current = final

    // Reset pointer to resting position
    if (pointerRef.current) {
      pointerRef.current.style.animation = 'none'
    }

    setSpinning(false)
    setDone(true)
    playWin(awardedResult)
    onDone?.()
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Wheel stage (pointer pokes above the box, so overflow stays visible) */}
      <div style={{ position: 'relative', width: BOX, height: BOX }}>

        {/* Spinning value segments (underneath the gold ring) */}
        <div
          ref={wrapRef}
          style={{
            position: 'absolute', inset: 0,
            transformOrigin: '50% 50%',
            zIndex: 1,
          }}
        >
          <svg viewBox={`0 0 ${BOX} ${BOX}`} width={BOX} height={BOX} style={{ display: 'block', overflow: 'visible' }}>
            <defs>
              <pattern id="whl-stripes" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width={2.5} height={5} fill="white" opacity={0.4} />
              </pattern>
            </defs>

            {/* Soft disc behind the wedges so any seam under the rim reads as wheel, not background */}
            <circle cx={CX} cy={CY} r={R} fill="#F3E3FA" />

            {SEGMENTS.map((seg, i) => {
              const cfg = TIER_CFG[seg.type] || TIER_CFG.t1
              const tierNum = TIER_ORDER[seg.type] || 1
              const inactive = tierNum < 99 && tierNum > activeTier
              const [tx, ty] = polar(CX, CY, R_TEXT, seg.midAngle)

              return (
                <g key={i} opacity={inactive ? 0.42 : 1}>
                  <path
                    d={wedge(CX, CY, R, seg.startAngle, seg.endAngle)}
                    fill={cfg.fill}
                    stroke={cfg.stroke}
                    strokeWidth={1.2}
                  />
                  {inactive && (
                    <path
                      d={wedge(CX, CY, R, seg.startAngle, seg.endAngle)}
                      fill="url(#whl-stripes)"
                    />
                  )}
                  <text
                    x={tx} y={ty}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={cfg.fontSize}
                    fontFamily="'Fredoka', cursive"
                    fontWeight={600}
                    fill={cfg.text}
                    stroke="rgba(255,255,255,0.75)"
                    strokeWidth={2.5}
                    paintOrder="stroke"
                    transform={`rotate(${seg.midAngle}, ${tx}, ${ty})`}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {cfg.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Static ornate gold rim (frames the spinning segments) */}
        <img
          src="/ui/wheel_rim.png"
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            zIndex: 3, pointerEvents: 'none',
            filter: 'drop-shadow(0 10px 22px rgba(155,126,200,0.40))',
          }}
        />

        {/* Static center hub (heart-gem medallion) */}
        <img
          src="/ui/wheel_hub.png"
          alt=""
          style={{
            position: 'absolute', left: '50%', top: '50%',
            width: HUB, height: HUB, transform: 'translate(-50%, -50%)',
            zIndex: 4, pointerEvents: 'none',
          }}
        />

        {/* Pointer at top, pivots from its top edge on each tick. Wrapper handles
            horizontal centering so the tick animation can own `transform`. */}
        <div style={{
          position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)',
          width: POINTER_W, zIndex: 5, pointerEvents: 'none',
        }}>
          <img
            ref={pointerRef}
            src="/ui/wheel_pointer.png"
            alt=""
            style={{
              width: '100%', display: 'block',
              transformOrigin: '50% 0%',
              filter: 'drop-shadow(0 3px 6px rgba(155,126,200,0.5))',
            }}
          />
        </div>
      </div>

      {/* Status */}
      {spinning && (
        <div style={{
          fontFamily: "'Fredoka', cursive",
          fontSize: 28, color: '#9B7EC8',
          animation: 'twinkle 0.6s ease-in-out infinite',
        }}>
          SPINNING...
        </div>
      )}
      {done && !spinning && (
        <div style={{
          fontFamily: "'Fredoka', cursive",
          fontSize: 28, color: '#5CBFA0',
        }}>
          ✓ DONE!
        </div>
      )}
    </div>
  )
})

export default Wheel
