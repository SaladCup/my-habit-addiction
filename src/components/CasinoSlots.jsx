import { useRef, useState, useLayoutEffect, useEffect } from 'react'
import { SLOT_SYMBOLS } from '../engine/casino/slots'
import { playReelStop } from '../engine/sounds'

// Casino Slots in the REAL cabinet (the same /ui/slot_cabinet.png art + reel feel
// as the habit-loop SlotMachine), but single-payline match-3 driven by the casino
// engine. Geometry fractions measured from the 900x1815 cabinet art.
const CAB_W = 360
const CAB_H = Math.round(CAB_W / (900 / 1815))   // keeps the art's aspect

const COLS_F   = [[0.162, 0.160], [0.419, 0.162], [0.676, 0.165]]   // [leftFrac, widthFrac]
const COL_CX_F = [0.242, 0.500, 0.7585]
const ROW_CY_F = [0.3295, 0.4585, 0.583]
const ROWS = 3
const CELL_H_F   = (ROW_CY_F[2] - ROW_CY_F[0]) / 2
const REEL_TOP_F = ROW_CY_F[0] - CELL_H_F / 2
const REEL_H_F   = CELL_H_F * 3

const px = { w: (f) => f * CAB_W, h: (f) => f * CAB_H }
const COL_LEFT = COLS_F.map(c => px.w(c[0]))
const COL_W    = COLS_F.map(c => px.w(c[1]))
const REEL_TOP = px.h(REEL_TOP_F)
const REEL_H   = px.h(REEL_H_F)
const CELL_H   = REEL_H / ROWS
const cx = (c) => px.w(COL_CX_F[c])
const cy = (r) => px.h(ROW_CY_F[r])

// Researched real-slot cadence (same as the habit SlotMachine): all reels spin at
// one speed and lock left→right; the last reel travels farther (stops later), and
// LONGER still when a line is brewing — the near-miss tension is pure timing.
const REEL_SPEED   = 30
const SPIN_BASE_MS = 1150
const STOP_GAP_MS  = 640
const LAST_GAP_MS  = 980
const BREW_EXTRA_MS = 720
const SNAP_MS      = 250
const REEL_MAX_FILL = 110
const reelSpinTime = (i, isLast, brewing) =>
  isLast ? SPIN_BASE_MS + STOP_GAP_MS + LAST_GAP_MS + (brewing ? BREW_EXTRA_MS : 0)
         : SPIN_BASE_MS + i * STOP_GAP_MS
const reelFill = (ms) => Math.min(REEL_MAX_FILL, Math.max(18, Math.round((ms / 1000) * REEL_SPEED)))

const EMOJI = SLOT_SYMBOLS.map(s => s.e)
const randEmoji = () => EMOJI[Math.floor(Math.random() * EMOJI.length)]

// One reel: scrolls TOP→BOTTOM at a steady blurred speed, then locks with a subtle
// impact bounce, landing the result symbol on the MIDDLE row (the payline).
function Reel({ target, reelIndex, isLast, brewing, spinning, onStopped }) {
  const ref = useRef(null)
  const animRef = useRef(null)
  const [blur, setBlur] = useState(false)
  const spinTime = reelSpinTime(reelIndex, isLast, brewing)
  const fill = reelFill(spinTime)
  // strip top→bottom: filler, [top, MIDDLE=result, bottom], then spin fillers.
  const [strip] = useState(() => [
    randEmoji(), target[0], target[1], target[2],
    ...Array.from({ length: fill }, randEmoji),
  ])
  const finalY = -CELL_H                      // window shows strip[1..3]
  const startY = -((fill + 1) * CELL_H)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (!spinning) { el.style.transform = `translateY(${finalY}px)`; return }
    el.style.transform = `translateY(${startY}px)`
    // eslint-disable-next-line react-hooks/set-state-in-effect -- blur brackets the WAAPI scroll
    setBlur(true)
    const preY = finalY - CELL_H * 0.5
    const cancel = () => { try { const a = animRef.current; if (a && a.playState === 'running') a.cancel() } catch { /* */ } }
    const stopHere = () => { el.style.transform = `translateY(${finalY}px)`; setBlur(false); playReelStop(); onStopped() }
    const settle = (fromY, duration) => {
      const over = Math.max(4, CELL_H * 0.13)
      const a = el.animate(
        [
          { transform: `translateY(${fromY}px)`,         easing: 'cubic-bezier(0.33, 0, 0.30, 1)' },
          { transform: `translateY(${finalY + over}px)`, offset: 0.62, easing: 'ease-out' },
          { transform: `translateY(${finalY}px)`,        offset: 1,    easing: 'ease-in-out' },
        ],
        { duration, fill: 'forwards' },
      )
      animRef.current = a
      a.onfinish = stopHere
    }
    const scroll = el.animate(
      [{ transform: `translateY(${startY}px)` }, { transform: `translateY(${preY}px)` }],
      { duration: spinTime, easing: 'linear', fill: 'forwards' },
    )
    animRef.current = scroll
    scroll.onfinish = () => { setBlur(false); settle(preY, SNAP_MS + 60) }
    return cancel
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per spin; geometry/callbacks stable for its lifetime
  }, [spinning])

  return (
    <div style={{ width: COL_W[reelIndex], height: CELL_H * ROWS, overflow: 'hidden', position: 'relative', filter: blur ? 'blur(4px)' : 'none' }}>
      {spinning && blur && (
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '35%', zIndex: 4, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.4), transparent)',
          animation: 'reel-shimmer 0.4s linear infinite',
        }} />
      )}
      <div ref={ref} style={{ display: 'flex', flexDirection: 'column', willChange: 'transform' }}>
        {strip.map((e, i) => (
          <div key={i} style={{
            width: COL_W[reelIndex], height: CELL_H, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: Math.round(CELL_H * 0.56), textShadow: '0 1px 2px rgba(0,0,0,0.45)',
          }}>{e}</div>
        ))}
      </div>
    </div>
  )
}

export default function CasinoSlots({ reels, spinId, win3, bet = 0, lastWin = 0, canSpin, onSpin, onSettled }) {
  const [spinning, setSpinning] = useState(false)
  const [reelKey, setReelKey] = useState(0)
  const stoppedRef = useRef(0)
  const idle = useRef([randEmoji(), randEmoji(), randEmoji()])

  // A new spinId means: spin. (spinId 0 = initial idle, no spin.)
  useEffect(() => {
    if (!spinId) return
    stoppedRef.current = 0
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot spin trigger off the parent's spinId
    setReelKey(k => k + 1)
    setSpinning(true)
  }, [spinId])

  function onReelStopped() {
    stoppedRef.current += 1
    if (stoppedRef.current >= 3) { setSpinning(false); onSettled?.() }
  }

  // While idle, show the last-landed result; pre-first-spin show a random idle row.
  const showResult = spinId > 0
  const mid = showResult ? reels.map(i => EMOJI[i]) : idle.current
  const brewing = showResult && reels[0] === reels[1]   // first two match → last reel teases longer

  return (
    <div style={{
      position: 'relative', width: CAB_W, height: CAB_H,
      filter: 'drop-shadow(0 12px 28px rgba(196,75,106,0.32))',
    }}>
      <img src="/ui/slot_cabinet.png?v=6" alt="" draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', userSelect: 'none' }} />

      {/* top-left screen = BET, top-right = last WIN */}
      <div style={topScreen(0.102, 0.533)}>BET {bet.toLocaleString()}</div>
      <div style={topScreen(0.620, 0.920)}>
        <span key={lastWin} style={{ animation: 'coin-pop 0.25s ease-out' }}>WIN {lastWin.toLocaleString()}</span>
      </div>

      {/* reels over the painted cells */}
      {[0, 1, 2].map(c => (
        <div key={c} style={{ position: 'absolute', left: COL_LEFT[c], width: COL_W[c], top: REEL_TOP, height: REEL_H }}>
          <Reel
            key={`${reelKey}-${c}`}
            reelIndex={c}
            isLast={c === 2}
            brewing={c === 2 ? brewing : false}
            spinning={spinning}
            target={[randEmoji(), mid[c], randEmoji()]}
            onStopped={onReelStopped}
          />
        </div>
      ))}

      {/* win highlight on the middle payline */}
      {win3 && !spinning && (
        <svg viewBox={`0 0 ${CAB_W} ${CAB_H}`} width={CAB_W} height={CAB_H}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6, overflow: 'visible' }}>
          <polyline points={[0, 1, 2].map(c => `${cx(c)},${cy(1)}`).join(' ')}
            fill="none" stroke="#FFC83D" strokeWidth={7} strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 6px rgba(255,200,60,0.95))', animation: 'payline-blink 0.5s ease-in-out infinite' }} />
          {[0, 1, 2].map(c => (
            <circle key={c} cx={cx(c)} cy={cy(1)} r={COL_W[1] * 0.46}
              fill="none" stroke="#FFD700" strokeWidth={3}
              style={{ filter: 'drop-shadow(0 0 5px rgba(255,215,0,0.8))', animation: 'payline-blink 0.5s ease-in-out infinite' }} />
          ))}
        </svg>
      )}

      {/* SPIN hotspot over the painted button */}
      {canSpin && !spinning && (
        <button onClick={onSpin} aria-label="Spin"
          style={{
            position: 'absolute', left: '27%', width: '46%', top: '73.5%', height: '8.5%',
            background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '50%', zIndex: 8,
            animation: 'spin-hotspot-pulse 1.1s ease-in-out infinite',
          }} />
      )}

      <style>{`
        @keyframes spin-hotspot-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
          50%      { box-shadow: 0 0 22px 6px rgba(255,255,255,0.55); }
        }
      `}</style>
    </div>
  )
}

function topScreen(leftF, rightF) {
  return {
    position: 'absolute',
    left: `${leftF * 100}%`, width: `${(rightF - leftF) * 100}%`,
    top: '13.4%', height: '5.1%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Fredoka', cursive", fontSize: Math.round(CAB_H * 0.026),
    color: '#FFE9A0', textShadow: '0 0 8px rgba(255,215,0,0.7)', letterSpacing: '0.02em', pointerEvents: 'none',
  }
}
