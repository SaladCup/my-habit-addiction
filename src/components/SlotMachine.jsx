import { useRef, useState, useEffect } from 'react'
import { SLOT_SYMBOLS } from '../engine/gameLogic'
import { playSpinStart, playReelStop, playLineWin, playCoinTick, playSlotWin, playNearMiss } from '../engine/sounds'

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

// ── Reel timing (researched real-slot cadence) ─────────────────────────────
// Real machines spin all reels at the SAME visible speed, then lock them in
// sequence at ~equal "rhythmic" intervals (documented as less fatiguing → longer
// play), with a longer HOLD before the final reel for anticipation. Sources:
// patents on "rhythmic reels" (US 8,047,910) & "stopping order for anticipation"
// (US 8,342,934); On Mag "The Slow Spin Effect" (≈250–500ms reveal pauses,
// 300–500ms hold before the last reel lands).
const REEL_SPEED   = 34     // symbols scrolled per second (blurred) — the visible spin speed
const SPIN_BASE_MS = 1150   // reel 0 spins this long before it locks
const STOP_GAP_MS  = 640    // each later reel locks this much after the previous (the "pause")
const LAST_HOLD_MS = 420    // extra anticipation hold before the FINAL reel drops
const SNAP_MS      = 250    // the decisive settle ("ka-chunk")
const reelSpinTime = (i) => SPIN_BASE_MS + i * STOP_GAP_MS
const reelFill     = (i) => Math.max(18, Math.round((reelSpinTime(i) / 1000) * REEL_SPEED))

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

// A "brewing line" on the first two reels (a row where col0 === col1) lets the
// LAST reel tease — show the would-be-winning symbol sliding toward the line, then
// roll one cell past it to the real (non-matching) symbol. Only fires on an actual
// near-miss row (col2 differs); real wins just land cleanly (that's the payoff).
function computeTease(grid) {
  for (let r = 0; r < ROWS; r++) {
    const a = grid[r][0], b = grid[r][1], cc = grid[r][2]
    if (a && b && a.id === b.id && cc && cc.id !== a.id) {
      return { active: true, symbol: a }
    }
  }
  return null
}

// ── One reel: spins at a steady blurred speed (unreadable), then locks. Reels
// lock left→right at equal intervals; the LAST reel holds for anticipation, and
// can TEASE — the would-be winner hangs on the line, then rolls off to the miss.
function Reel({ target, reelIndex, colW, spinning, onStopped, tease, isLast }) {
  const ref = useRef(null)
  const animRef = useRef(null)
  const [blur, setBlur] = useState(false)
  const teased = !!tease?.active
  const fill = reelFill(reelIndex)
  const [strip] = useState(() => {
    const cells = Array.from({ length: fill }, randomSym)
    // teased reel gets the would-be-winning symbol spliced one cell ABOVE the
    // targets, so it slides through the window right before the miss lands.
    return teased
      ? [...cells, tease.symbol, target[0], target[1], target[2]]
      : [...cells, target[0], target[1], target[2]]
  })

  useEffect(() => {
    if (!spinning) return
    const el = ref.current
    if (!el) return
    setBlur(true)
    const base   = fill + (teased ? 1 : 0)
    const finalY = -(base * CELL_H)
    const preY   = finalY + CELL_H * 0.5          // reels 0/1: half a cell short → quick snap
    const holdY  = finalY + CELL_H                // last reel: one FULL cell short → a clean,
                                                  // ALIGNED anticipation hold (no half-row jank)
    const spinTime = reelSpinTime(reelIndex)
    const cancel = () => { try { const a = animRef.current; if (a && a.playState === 'running') a.cancel() } catch {} }
    const stopHere = () => {
      el.style.transform = `translateY(${finalY}px)`   // pin landed position so a later cancel() can't revert it
      setBlur(false); playReelStop(); onStopped()
    }
    // Land with a subtle impact BOUNCE: travel in, drive a hair PAST the stop,
    // rebound a touch, then settle — the satisfying "clunk" real reels have.
    const settle = (fromY, duration) => {
      const over = Math.max(4, CELL_H * 0.15)     // overshoot past the stop
      const reb  = Math.max(2, CELL_H * 0.055)    // small rebound the other way
      const a = el.animate(
        [
          { transform: `translateY(${fromY}px)`,          offset: 0 },
          { transform: `translateY(${finalY - over}px)`,  offset: 0.55 },   // impact (past rest)
          { transform: `translateY(${finalY + reb}px)`,   offset: 0.80 },   // rebound
          { transform: `translateY(${finalY}px)`,         offset: 1 },      // settle
        ],
        { duration, easing: 'cubic-bezier(0.22, 0.68, 0.30, 1)', fill: 'forwards' },
      )
      animRef.current = a
      a.onfinish = stopHere
    }

    // 1) Steady blurred scroll at a CONSTANT speed (same on every reel; later reels
    //    just travel farther so they lock later — the rhythmic stop cadence). The
    //    final reel stops one FULL cell short (holdY) for a clean anticipation hold.
    const scroll = el.animate(
      [{ transform: 'translateY(0)' }, { transform: `translateY(${isLast ? holdY : preY}px)` }],
      { duration: spinTime, easing: 'linear', fill: 'forwards' },
    )
    animRef.current = scroll
    scroll.onfinish = () => {
      setBlur(false)
      if (!isLast) { settle(preY, SNAP_MS + 60); return }   // reels 0/1: snap in with a bounce
      // Final reel: hold one symbol short (cleanly aligned), then roll the last
      // symbol into place — bouncing on impact. Teased = the would-be winner is
      // sitting there and rolls OFF to the miss; otherwise the real symbol clicks in.
      const hold = el.animate(
        [{ transform: `translateY(${holdY}px)` }, { transform: `translateY(${holdY}px)` }],
        { duration: teased ? 600 : LAST_HOLD_MS, fill: 'forwards' },
      )
      animRef.current = hold
      hold.onfinish = () => {
        if (teased) playNearMiss()                // the "awww" as the near-symbol rolls away
        settle(holdY, 460)                        // roll ONE clean cell in, bounce on impact
      }
    }
    return cancel
  }, [spinning])

  return (
    <div style={{
      width: colW, height: CELL_H * ROWS, overflow: 'hidden',
      position: 'relative',
      // Blur the small CLIPPED window (not the ~4000px-tall strip) — far cheaper
      // per frame, which fixes the last reel (the tallest strip) stuttering.
      filter: blur ? 'blur(4px)' : 'none',
      transition: blur ? 'none' : 'filter 110ms ease-out',
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
  // 'between' = a spin just revealed; its result + explanation stay up until SPIN is tapped.
  const showGrid = ['spinning', 'revealing', 'between', 'done'].includes(phase)
  const displayGrid = showGrid && current ? current.grid : idleGrid.current
  const spinsLeft = phase === 'between' ? spinCount - index - 1 : spinCount - index
  const setRun = (v) => { runningRef.current = v; setRunning(v) }
  // The last reel teases when a line is brewing on the first two reels (near-miss).
  const teaseInfo = phase === 'spinning' && current ? computeTease(current.grid) : null

  function startSpin() {
    if (phase !== 'ready' && phase !== 'between') return
    if (phase === 'between') setIndex(i => i + 1)   // advance to the next spin now (was deferred so the result stayed up)
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
    await sleep(550)                                  // beat of suspense after reels land
    const spin = session.spins[index]
    const lines = spin.winningLines || []
    for (let i = 0; i < lines.length; i++) {
      setActiveLines(prev => [...prev, lines[i]])
      playLineWin(i)
      await sleep(440)                                // reveal each winning line one at a time
    }
    const gained = spin.isJackpot ? session.jackpotAward : spin.coins
    if (gained > 0) {
      const start = runningRef.current
      const steps = Math.min(gained, 26)
      for (let s = 1; s <= steps; s++) {
        await sleep(70)                               // slower, satisfying coin count-up
        setRun(Math.round(start + (gained * s) / steps))
        if (s % 2) playCoinTick(s)
      }
      setRun(start + gained)
      if (spin.isJackpot) playSlotWin()
    } else {
      await sleep(450)
    }
    await sleep(spin.isJackpot || spin.isBonus ? 1500 : 650)
    if (index + 1 >= spinCount) {
      setPhase('done')
      onComplete?.()
    } else {
      // Keep this spin's grid + explanation up; SPIN advances to the next one.
      setPhase('between')
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
              tease={c === 2 ? teaseInfo : null}
              isLast={c === COLS - 1}
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

        {/* Win breakdown + "why", overlaid above the SPIN button — stays up until next spin */}
        {(phase === 'revealing' || phase === 'between' || phase === 'done') && current && (
          <div style={{
            position: 'absolute', left: '8%', right: '8%', bottom: '28%', zIndex: 7,
            background: 'rgba(255,248,253,0.96)', border: '2px solid #E3B7D6',
            borderRadius: 14, padding: '7px 11px', boxShadow: '0 3px 0 #D9A6CC',
            display: 'flex', flexDirection: 'column', gap: 3, pointerEvents: 'none',
            animation: 'bounce-in 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            {activeLines.map((l, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: "'Fredoka', cursive", fontSize: 16, color: '#3D2B4F',
                animation: 'bounce-in 0.32s cubic-bezier(0.34,1.56,0.64,1)',
              }}>
                <span style={{ fontSize: 17, letterSpacing: '1px' }}>{l.symbol.emoji}{l.symbol.emoji}{l.symbol.emoji}</span>
                <span style={{ flex: 1 }}>{l.label}</span>
                <span style={{ color: l.special ? '#C99A00' : '#5CBFA0', fontWeight: 700 }}>
                  {l.special ? `${l.special === 'jackpot' ? 'JACKPOT' : 'BONUS'}!` : `+${l.coins}`}
                </span>
              </div>
            ))}
            {current.summary && (
              <div style={{
                fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#7B5EA7',
                textAlign: 'center', marginTop: activeLines.length ? 3 : 0, lineHeight: 1.25,
              }}>
                {current.summary}
              </div>
            )}
          </div>
        )}

        {/* SPIN hotspot over the painted button */}
        {(phase === 'ready' || phase === 'between') && (
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
          : phase === 'between' ? `TAP SPIN FOR NEXT · ${spinsLeft} left`
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
