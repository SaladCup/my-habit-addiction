import { useRef, useEffect, useState } from 'react'
import { buildBonusSegments } from '../engine/gameLogic'

const CX = 100, CY = 100, R = 88, R_TEXT = 65
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
      { duration: 3200, easing: 'cubic-bezier(0.25, 0.05, 0.08, 1.0)', fill: 'forwards' }
    )
    anim.onfinish = () => {
      const final = stopAngle % 360
      el.getAnimations().forEach(a => a.cancel())
      el.style.transform = `rotate(${final}deg)`
      onDone?.()
    }
  }, [stopAngle])

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 40, color: '#FF85A1', filter: 'drop-shadow(0 1px 4px rgba(255,133,161,0.5))' }}>▼</div>

      <div
        ref={wrapRef}
        style={{
          width: 300, height: 300,
          transformOrigin: '50% 50%',
          borderRadius: '50%',
          boxShadow: '0 6px 24px rgba(255,133,161,0.35)',
        }}
      >
        <svg viewBox="0 0 200 200" width={300} height={300} style={{ display: 'block' }}>
          {/* Rim */}
          <circle cx={CX} cy={CY} r={R + 7} fill="#FFE0EC" stroke="#FF85A1" strokeWidth={4} />

          {SEGMENTS.map((seg, i) => {
            const start = seg.startAngle
            const end = seg.endAngle
            const mid = seg.midAngle
            const [tx, ty] = polar(CX, CY, R_TEXT, mid)
            return (
              <g key={i}>
                <path
                  d={wedge(CX, CY, R, start, end)}
                  fill={seg.color}
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth={1.5}
                />
                <text
                  x={tx} y={ty}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fontFamily="'Fredoka', cursive"
                  fill="#3D2B4F"
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth={2.5}
                  paintOrder="stroke"
                  transform={`rotate(${mid}, ${tx}, ${ty})`}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {seg.label}
                </text>
              </g>
            )
          })}

          {/* Center */}
          <circle cx={CX} cy={CY} r={18} fill="#FFF0F8" stroke="#FF85A1" strokeWidth={2.5} />
          <text x={CX} y={CY + 1} textAnchor="middle" dominantBaseline="central" fontSize={14} style={{ userSelect: 'none' }}>
            🎁
          </text>
        </svg>
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
