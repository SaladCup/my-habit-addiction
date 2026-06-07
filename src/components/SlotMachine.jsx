import { useRef, useState, useEffect } from 'react'
import { SLOT_SYMBOLS } from '../engine/gameLogic'
import { playSpinStart, playReelStop, playLineWin, playCoinTick, playSlotWin } from '../engine/sounds'

// ── Cabinet geometry ──────────────────────────────────────────────
// Fractions measured from /ui/slot_cabinet.png (900 x 1815).
const CAB_W = 400
const CAB_H = Math.round(CAB_W / (900 / 1815))   // ≈ 807, keeps the art's aspect

// 3 reel columns: [leftFrac, widthFrac]
const COLS_F = [[0.162, 0.160], [0.419, 0.162], [0.676, 0.165]]
const ROWS = 3
const COLS = 3

// painted cell centres (for paylines / win rings / symbol centring)
const COL_CX_F = [0.242, 0.500, 0.7585]
const ROW_CY_F = [0.3295, 0.4585, 0.583]
// Reel cells spaced so each symbol lands exactly on a painted cell centre
// (equal-thirds of the tight band sat the top/bottom rows off-centre).
const CELL_H_F   = (ROW_CY_F[2] - ROW_CY_F[0]) / 2
const REEL_TOP_F = ROW_CY_F[0] - CELL_H_F / 2
const REEL_H_F   = CELL_H_F * 3

const STRIP_FILL = 30

const px = { w: (f) => f * CAB_W, h: (f) => f * CAB_H }
const COL_LEFT = COLS_F.map(c => px.w(c[0]))
const COL_W    = COLS_F.map(c => px.w(c[1]))
const REEL_TOP = px.h(REEL_TOP_F)
const REEL_H   = px.h(REEL_H_F)
const CELL_H   = REEL_H / ROWS
const cx = (c) => px.w(COL_CX_F[c])
const cy = (r) => px.h(ROW_CY_F[r])

const randomSym = () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]
const randomGrid = () =>
  Array.from({ length: ROWS }, () => Array.from({ length: COLS }, randomSym))

// ── One reel: spins vertically, lands on its 3 target symbols ──
function Reel({ target, reelIndex, colW, spinning, onStopped }) {
  const ref = useRef(null)
  const [blur, setBlur] = useState(false)
  const [strip] = useState(() => {
    const fill = Array.from({ length: STRIP_FILL }, randomSym)
    return [...fill, target[0], target[1], target[2]]
  })

  useEffect(() => {
    if (!spinning) return
    const el = ref.current
    if (!el) return
    setBlur(true)
    const finalY = -(STRIP_FILL * CELL_H)
    const dur = 1100 + reelIndex * 420
    const spin = el.animate(
      [{ transform: 'translateY(0)' }, { transform: `translateY(${finalY}px)` }],
      { duration: dur, easing: 'cubic-bezier(0.12, 0, 0.04, 1)', fill: 'forwards' },
    )
    const unblur = setTimeout(() => setBlur(false), dur - 400)
    spin.onfinish = () => {
      const bounce = el.animate(
        [
          { transform: `translateY(${finalY}px)` },
          { transform: `translateY(${finalY - 8}px)` },
          { transform: `translateY(${finalY}px)` },
        ],
        { duration: 220, easing: 'ease-out', fill: 'forwards' },
      )
      bounce.onfinish = () => { playReelStop(); onStopped() }
    }
    return () => { clearTimeout(unblur); spin.cancel() }
  }, [spinning])

  return (
    <div style={{
      width: colW, height: CELL_H * ROWS, overflow: 'hidden',
      position: 'relative',
    }}>
      {spinning && blur && (
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '35%', zIndex: 4, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.4), transparent)',
          animation: 'reel-shimmer 0.4s linear infinite',
        }} />
      )}
      <div ref={ref} style={{
        display: 'flex', flexDirection: 'column',
        filter: blur ? 'blur(4px)' : 'blur(0)',
        transition: blur ? 'none' : 'filter 400ms ease-out',
        willChange: 'transform',
      }}>
        {strip.map((s, i) => (
          <div key={i} style={{
            width: colW, height: CELL_H, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: Math.round(CELL_H * 0.56),
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))',
          }}>
            {s.emoji}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SlotMachine({ session, onComplete, jackpotPool = 0 }) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState('ready')   // ready | spinning | revealing | done
  const [reelKey, setReelKey] = useState(0)
  const [activeLines, setActiveLines] = useState([])
  const [running, setRunning] = useState(0)
  const [shaking, setShaking] = useState(false)
  const runningRef = useRef(0)
  const stoppedRef = useRef(0)
  const idleGrid = useRef(randomGrid())

  if (!session) return null

  const spinCount = session.spinCount
  const current = session.spins[index]
  const showGrid = (phase === 'spinning' || phase === 'revealing' || phase === 'done')
  const displayGrid = showGrid && current ? current.grid : idleGrid.current
  const spinsLeft = spinCount - index
  const setRun = (v) => { runningRef.current = v; setRunning(v) }

  function startSpin() {
    if (phase !== 'ready') return
    stoppedRef.current = 0
    setActiveLines([])
    setReelKey(k => k + 1)
    setPhase('spinning')
    setShaking(true)
    playSpinStart()
    setTimeout(() => setShaking(false), 360)
  }

  function onReelStopped() {
    stoppedRef.current += 1
    if (stoppedRef.current >= COLS) reveal()
  }

  async function reveal() {
    setPhase('revealing')
    const sleep = (ms) => new Promise(r => setTimeout(r, ms))
    await sleep(280)
    const spin = session.spins[index]
    const lines = spin.winningLines || []
    for (let i = 0; i < lines.length; i++) {
      setActiveLines(prev => [...prev, lines[i]])
      playLineWin(i)
      await sleep(250)
    }
    const gained = spin.isJackpot ? session.jackpotAward : spin.coins
    if (gained > 0) {
      const start = runningRef.current
      const steps = Math.min(gained, 14)
      for (let s = 1; s <= steps; s++) {
        await sleep(40)
        setRun(Math.round(start + (gained * s) / steps))
        if (s % 2) playCoinTick(s)
      }
      setRun(start + gained)
      if (spin.isJackpot) playSlotWin()
    } else {
      await sleep(280)
    }
    await sleep(spin.isJackpot || spin.isBonus ? 800 : 320)
    if (index + 1 >= spinCount) {
      setPhase('done')
      onComplete?.()
    } else {
      setIndex(index + 1)
      setActiveLines([])
      setPhase('ready')
    }
  }

  const winningCells = new Set(activeLines.flatMap(l => l.cells.map(([r, c]) => `${r},${c}`)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* ── Cabinet ── */}
      <div style={{
        position: 'relative', width: CAB_W, height: CAB_H,
        animation: shaking ? 'slot-shake 0.38s ease-out' : 'none',
        filter: 'drop-shadow(0 12px 28px rgba(196,75,106,0.32))',
      }}>
        <img src="/ui/slot_cabinet.png?v=6" alt="" draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', userSelect: 'none' }} />

        {/* Progressive jackpot pool → the "Grand Jackpot" display */}
        <div style={{
          position: 'absolute',
          left: `${0.102 * 100}%`, width: `${(0.533 - 0.102) * 100}%`,
          top: `${0.134 * 100}%`, height: `${(0.185 - 0.134) * 100}%`,  // box = actual dark screen → vertically centered
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Fredoka', cursive",
          fontSize: Math.round(CAB_H * 0.030),
          color: '#FFE9A0', textShadow: '0 0 8px rgba(255,215,0,0.75)',
          letterSpacing: '0.02em', pointerEvents: 'none',
        }}>
          💎 {jackpotPool.toLocaleString()}
        </div>

        {/* Running coin total → the "Coins" display (right of the gold heart) */}
        <div style={{
          position: 'absolute',
          left: `${0.620 * 100}%`, width: `${(0.920 - 0.620) * 100}%`,
          top: `${0.134 * 100}%`, height: `${(0.185 - 0.134) * 100}%`,  // box = dark screen → vertically centered (matches jackpot)
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Fredoka', cursive",
          fontSize: Math.round(CAB_H * 0.032),
          color: '#FFF3C4', textShadow: '0 0 7px rgba(255,215,0,0.7)',
          letterSpacing: '0.02em', pointerEvents: 'none',
        }}>
          <span key={running} style={{ animation: 'coin-pop 0.25s ease-out' }}>{running}</span>
        </div>

        {/* Reels, positioned over the painted cells */}
        {[0, 1, 2].map(c => (
          <div key={c} style={{
            position: 'absolute',
            left: COL_LEFT[c], width: COL_W[c],
            top: REEL_TOP, height: REEL_H,
          }}>
            <Reel
              key={`${reelKey}-${c}`}
              reelIndex={c}
              colW={COL_W[c]}
              spinning={phase === 'spinning'}
              target={[displayGrid[0][c], displayGrid[1][c], displayGrid[2][c]]}
              onStopped={onReelStopped}
            />
          </div>
        ))}

        {/* Payline + winning-cell overlay (covers whole cabinet) */}
        <svg viewBox={`0 0 ${CAB_W} ${CAB_H}`} width={CAB_W} height={CAB_H}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6, overflow: 'visible' }}>
          {activeLines.map((line, i) => (
            <polyline key={i}
              points={line.cells.map(([r, c]) => `${cx(c)},${cy(r)}`).join(' ')}
              fill="none" stroke="#FFC83D" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 6px rgba(255,200,60,0.95))', animation: 'payline-blink 0.5s ease-in-out infinite' }} />
          ))}
          {[...winningCells].map((key) => {
            const [r, c] = key.split(',').map(Number)
            return (
              <circle key={key} cx={cx(c)} cy={cy(r)} r={COL_W[1] * 0.46}
                fill="none" stroke="#FFD700" strokeWidth={3}
                style={{ filter: 'drop-shadow(0 0 5px rgba(255,215,0,0.8))', animation: 'payline-blink 0.5s ease-in-out infinite' }} />
            )
          })}
        </svg>

        {/* SPIN hotspot over the painted button */}
        {phase === 'ready' && (
          <button
            onClick={startSpin}
            aria-label={`Spin (${spinsLeft} left)`}
            style={{
              position: 'absolute',
              left: `${0.27 * 100}%`, width: `${0.46 * 100}%`,
              top: `${0.735 * 100}%`, height: `${0.085 * 100}%`,
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderRadius: '50%', zIndex: 8,
              animation: 'spin-hotspot-pulse 1.1s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* Spin counter + spins-left */}
      <div style={{
        fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#9B7EC8',
        letterSpacing: '0.05em', minHeight: 26, textAlign: 'center',
      }}>
        {phase === 'spinning' ? 'SPINNING…'
          : phase === 'done' ? '✦ ALL DONE ✦'
          : phase === 'ready' ? `TAP SPIN! · ${spinsLeft} left`
          : `SPIN ${Math.min(index + 1, spinCount)} / ${spinCount}`}
      </div>

      {/* Result banners (after the last spin) */}
      {phase === 'done' && session.isJackpot && (
        <div style={bannerStyle('#FFD700', '#5C3A00')}>💎 JACKPOT! +{session.jackpotAward} 💎</div>
      )}
      {phase === 'done' && session.isBonus && (
        <div style={bannerStyle('#FFE9A0', '#5C3A00')}>⭐ BONUS ROUND! ⭐</div>
      )}
      {phase === 'done' && !session.isJackpot && !session.isBonus && (
        <div style={bannerStyle('#B4E0C8', '#1A5C3A')}>✦ YOU WON {running} COINS! ✦</div>
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

function bannerStyle(bg, fg) {
  return {
    fontFamily: "'Fredoka', cursive", fontSize: 24, color: fg,
    background: bg, border: `3px solid ${fg}33`, borderRadius: 16,
    padding: '8px 22px', boxShadow: '0 4px 0 rgba(0,0,0,0.12)',
    animation: 'bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1)',
  }
}
