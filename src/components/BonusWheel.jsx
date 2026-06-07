import { useRef, useEffect, useState } from 'react'
import { buildBonusSegments } from '../engine/gameLogic'

// ── Layout (mirrors the main Wheel) ──
// Decorative rim / hub / pointer are PNG art (public/ui/bonus_*.png); the 5
// weighted prize slices are drawn dynamically in SVG and spin underneath.
const BOX = 440                            // bigger than before (was 300)
const CX = BOX / 2, CY = BOX / 2
const R = Math.round(BOX * 0.444)          // slice radius — tucks just under the rim's inner lip
const R_TEXT = Math.round(BOX * 0.31)      // label radius (inside the ring, outside the hub)
const HUB = Math.round(BOX * 0.34)         // center-cap display size
const POINTER_W = Math.round(BOX * 0.22)   // pointer display width
const POINTER_TOP = -Math.round(BOX * 0.05)

const SEGMENTS = buildBonusSegments()

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

export default function BonusWheel({ stopAngle, result, onDone }) {
  const wrapRef = useRef(null)
  const [spun, setSpun] = useState(false)

  useEffect(() => {
    if (stopAngle == null || spun) return
    setSpun(true)
    const el = wrapRef.current
    if (!el) return

    const anim = el.animate(
      [{ transform: 'rotate(0deg)' }, { transform: `rotate(${stopAngle}deg)` }],
      { duration: 6500, easing: 'cubic-bezier(0.18, 0.04, 0.05, 1.0)', fill: 'forwards' }
    )
    anim.onfinish = () => {
      const final = stopAngle % 360
      el.getAnimations().forEach(a => a.cancel())
      el.style.transform = `rotate(${final}deg)`
      onDone?.()
    }
  }, [stopAngle])

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Wheel stage (pointer pokes above the box) */}
      <div style={{ position: 'relative', width: BOX, height: BOX }}>

        {/* Spinning prize slices (underneath the gold ring) */}
        <div
          ref={wrapRef}
          style={{ position: 'absolute', inset: 0, transformOrigin: '50% 50%', zIndex: 1 }}
        >
          <svg viewBox={`0 0 ${BOX} ${BOX}`} width={BOX} height={BOX} style={{ display: 'block', overflow: 'visible' }}>
            {/* soft disc so any seam under the rim reads as wheel, not background */}
            <circle cx={CX} cy={CY} r={R} fill="#FBE9F4" />

            {SEGMENTS.map((seg, i) => {
              const [tx, ty] = polar(CX, CY, R_TEXT, seg.midAngle)
              return (
                <g key={i}>
                  <path
                    d={wedge(CX, CY, R, seg.startAngle, seg.endAngle)}
                    fill={seg.color}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    opacity={0.9}
                  />
                  <text
                    x={tx} y={ty}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={seg.value === 'free' ? 17 : 21}
                    fontFamily="'Fredoka', cursive"
                    fontWeight={700}
                    fill="#3D2B4F"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth={2.6}
                    paintOrder="stroke"
                    transform={`rotate(${seg.midAngle - 90}, ${tx}, ${ty})`}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {seg.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Static ornate rim */}
        <img
          src="/ui/bonus_rim.png"
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            zIndex: 3, pointerEvents: 'none',
            filter: 'drop-shadow(0 9px 20px rgba(255,133,161,0.35))',
          }}
        />

        {/* Static center hub */}
        <img
          src="/ui/bonus_hub.png"
          alt=""
          style={{
            position: 'absolute', left: '50%', top: '50%',
            width: HUB, height: HUB, transform: 'translate(-50%, -50%)',
            zIndex: 4, pointerEvents: 'none',
          }}
        />

        {/* Pointer at top */}
        <div style={{
          position: 'absolute', top: POINTER_TOP, left: '50%', transform: 'translateX(-50%)',
          width: POINTER_W, zIndex: 5, pointerEvents: 'none',
        }}>
          <img
            src="/ui/bonus_pointer.png"
            alt=""
            style={{ width: '100%', display: 'block', filter: 'drop-shadow(0 3px 6px rgba(255,133,161,0.5))' }}
          />
        </div>
      </div>

      {result && (
        <div style={{
          fontFamily: "'Fredoka', cursive",
          fontSize: 27, color: '#FF85A1',
          background: '#FFF0F8',
          border: '2px solid #FF85A1',
          borderRadius: 12,
          padding: '6px 14px',
          boxShadow: '0 2px 0 #D4607A',
        }}>
          {SEGMENTS.find(s => s.value === result)?.label ?? result}
        </div>
      )}
    </div>
  )
}
