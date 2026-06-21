import { useRef, useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react'
import { buildWheelSegments, getWheelStopAngle } from '../engine/gameLogic'
import { playSpinStart, playNearMiss, playWin, playWheelTick } from '../engine/sounds'

// ── Layout ──
// The decorative rim / hub / pointer are PNG art (public/ui/wheel_*.png).
// Only the colored value segments are drawn dynamically in SVG and spin
// underneath the static gold ring, so prize values can still scale by tier.
const BOX = 480                            // wheel container (px) — fills most of the phone width
const CX = BOX / 2, CY = BOX / 2            // SVG center
const R = Math.round(BOX * 0.444)          // segment radius — tucks just under the rim's inner lip
const R_TEXT = Math.round(BOX * 0.345)     // label center radius (labels run radially along the spoke)
const HUB = Math.round(BOX * 0.25)         // center-cap display size
const POINTER_W = Math.round(BOX * 0.20)   // pointer display width (smaller triangle)
const POINTER_TOP = -Math.round(BOX * 0.045)// how far the pointer pokes above the wheel

// Themed wedge colors: T1 pink, T2 lavender, T3 mint; Bonus gold, Jackpot bright gold.
const WEDGE_CFG = {
  t1:      { fill: '#FFC2D2', stroke: '#FF8FB0', text: '#7A2040' },
  t2:      { fill: '#D2BEEC', stroke: '#9B7EC8', text: '#3D1A6E' },
  t3:      { fill: '#AEE3CC', stroke: '#5CBFA0', text: '#12533A' },
  bonus:   { fill: '#FFE39A', stroke: '#E8B53A', text: '#6B4A00' },
  jackpot: { fill: '#FFD23F', stroke: '#E0A800', text: '#5C3A00' },
}

// Wedge label = the coins it pays (tiers), or the word (bonus/jackpot).
function wedgeLabel(seg) {
  if (seg.type === 'bonus') return 'BONUS'
  if (seg.type === 'jackpot') return 'JACKPOT'
  return String(seg.coins)
}
function wedgeFont(seg) {
  if (seg.type === 'jackpot') return 11
  if (seg.type === 'bonus') return 12
  return 16   // coin numbers
}

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

const Wheel = forwardRef(function Wheel(
  { activeTier = 1, awardedResult, rawResult, isNearMiss, onDone },
  ref
) {
  // Wheel layout depends on the unlocked tier (locked tiers merge down).
  const segments = useMemo(() => buildWheelSegments(activeTier), [activeTier])

  const wrapRef = useRef(null)
  const pointerRef = useRef(null)
  const rotRef = useRef(0)
  const trackingRef = useRef(false)
  const aliveRef = useRef(false)
  const [spinning, setSpinning] = useState(false)
  const [done, setDone] = useState(false)

  // Stop the rAF tick loop + guard async post-spin setState if we unmount mid-spin.
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; trackingRef.current = false } }, [])

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

  // Which VISIBLE wedge sits under the top pointer at wheel-frame angle `a`?
  // Uses the actual (merged) segments so we tick once per REAL boundary — not per
  // 50-slot grid step, which made big merged wedges (e.g. Tier 1) click nonstop.
  function segmentUnderPointer(a) {
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i]
      if ((a >= s.startAngle && a < s.endAngle) ||
          (a - 360 >= s.startAngle && a - 360 < s.endAngle)) return i   // handles the wrap-around wedge
    }
    return -1
  }

  function startPointerTracking() {
    let lastSegIndex = -1
    let lastTickTime = 0
    trackingRef.current = true

    function track() {
      if (!trackingRef.current) return
      const el = wrapRef.current
      if (!el) { requestAnimationFrame(track); return }

      const mat = new DOMMatrixReadOnly(window.getComputedStyle(el).transform)
      // atan2(b, a) = clockwise rotation; the wheel-frame angle under the fixed
      // top pointer is (360 − rotation).
      const rot = ((Math.atan2(mat.b, mat.a) * 180 / Math.PI) + 360) % 360
      const segIndex = segmentUnderPointer((360 - rot) % 360)
      const now = performance.now()

      // Tick only when the wedge under the pointer actually CHANGES (a real boundary).
      if (segIndex !== lastSegIndex && lastSegIndex !== -1 && segIndex !== -1 && now - lastTickTime > 40) {
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
      awardedResult, rawResult || awardedResult, isNearMiss, segments
    )
    const start = rotRef.current

    startPointerTracking()

    if (isNearMiss && nearMissAngle != null) {
      const a1 = el.animate(
        [{ transform: `rotate(${start}deg)` }, { transform: `rotate(${nearMissAngle}deg)` }],
        { duration: 11000, easing: 'cubic-bezier(0.16, 0.8, 0.2, 1)', fill: 'forwards' }
      )
      await a1.finished
      trackingRef.current = false // stop ticking before near-miss snap
      playNearMiss()
      const a2 = el.animate(
        [{ transform: `rotate(${nearMissAngle}deg)` }, { transform: `rotate(${stopAngle}deg)` }],
        { duration: 900, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' }
      )
      await a2.finished
    } else {
      // Phase 1: long, suspenseful deceleration — a quick whip up front, then a
      // long, increasingly slow crawl that nearly stops dead (overshoots by a hair).
      // Overshoot must stay INSIDE the winning wedge: wedges are 9° wide and the
      // stop point is 0.30–0.70 in (≥2.7° from an edge) — a 4° overshoot used to
      // cross into the neighbouring wedge and tick, then silently settle back.
      const overshoot = stopAngle + 1.5
      const a1 = el.animate(
        [{ transform: `rotate(${start}deg)` }, { transform: `rotate(${overshoot}deg)` }],
        { duration: 13500, easing: 'cubic-bezier(0.16, 0.8, 0.2, 1)', fill: 'forwards' }
      )
      await a1.finished
      trackingRef.current = false // stop ticking before spring settle

      // Phase 2: gentle settle back to the exact target (soft stop, no hard snap;
      // monotonic easing — a bouncy bezier could re-cross the wedge line)
      const a2 = el.animate(
        [{ transform: `rotate(${overshoot}deg)` }, { transform: `rotate(${stopAngle}deg)` }],
        { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
      )
      await a2.finished
    }

    if (!aliveRef.current) return   // unmounted mid-spin — don't setState/onDone on a dead component

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
            {/* Soft disc behind the wedges so any seam under the rim reads as wheel, not background */}
            <circle cx={CX} cy={CY} r={R} fill="#F3E3FA" />

            {segments.map((seg, i) => {
              const cfg = WEDGE_CFG[seg.type] || WEDGE_CFG.t1
              const [tx, ty] = polar(CX, CY, R_TEXT, seg.midAngle)

              return (
                <g key={i}>
                  <path
                    d={wedge(CX, CY, R, seg.startAngle, seg.endAngle)}
                    fill={cfg.fill}
                    stroke={cfg.stroke}
                    strokeWidth={1.5}
                  />
                  <text
                    x={tx} y={ty}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={wedgeFont(seg)}
                    fontFamily="'Fredoka', cursive"
                    fontWeight={700}
                    fill={cfg.text}
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth={2}
                    paintOrder="stroke"
                    transform={`rotate(${seg.midAngle - 90}, ${tx}, ${ty})`}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {wedgeLabel(seg)}
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
          position: 'absolute', top: POINTER_TOP, left: '50%', transform: 'translateX(-50%)',
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
