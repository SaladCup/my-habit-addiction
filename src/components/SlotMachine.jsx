import { useRef, useState, useEffect } from 'react'
import { Application, Assets, Graphics } from 'pixi.js'
import { gsap } from 'gsap'
import { ReelSetBuilder, SpeedPresets } from 'pixi-reels'
import { FitSpriteSymbol } from './slots/FitSpriteSymbol'
import { SLOT_SYMBOLS } from '../engine/gameLogic'
import { playSpinStart, playReelStop, playLineWin, playCoinTick, playSlotWin, playNearMiss } from '../engine/sounds'

// ── Layout ────────────────────────────────────────────────
const REELS        = 5
const ROWS         = 3
const CORE_OFFSET  = 1          // engine col c  →  display reel c + 1
const CELL         = 70         // px square cell
const GAP          = 4          // gap between reels (and rows)
const FRAME        = 10         // dark window padding inside the canvas

const CANVAS_W = REELS * CELL + (REELS - 1) * GAP + FRAME * 2
const CANVAS_H = ROWS * CELL + (ROWS - 1) * GAP + FRAME * 2

// ── Symbols ───────────────────────────────────────────────
// Decorative outer reels + the blurred spin-fill only ever show fillers
// (t1–t3). Bonus/jackpot are placed deliberately via setResult, never random.
const FILLER_IDS = SLOT_SYMBOLS.filter(s => ['t1', 't2', 't3'].includes(s.tier)).map(s => s.id)
// Symbols missing from .weights() default to 10, so bonus/gold would otherwise
// flash by during the spin and on the resting frame. Force them to 0 — they only
// ever appear when deliberately placed via setResult (jackpot/bonus sessions).
const FILL_WEIGHTS = Object.fromEntries(
  SLOT_SYMBOLS.map(s => [s.id, FILLER_IDS.includes(s.id) ? s.weight : 0]),
)
const rndFillerId = () => FILLER_IDS[Math.floor(Math.random() * FILLER_IDS.length)]
const fillerFrame = () => Array.from({ length: REELS }, () => ({ visible: [rndFillerId(), rndFillerId(), rndFillerId()] }))

// Engine 3×3 grid (cells are symbol objects) → 5 ColumnTargets, top-to-bottom.
function buildResultCols(grid) {
  const cols = []
  for (let d = 0; d < REELS; d++) {
    const coreCol = d - CORE_OFFSET
    if (coreCol < 0 || coreCol > 2) {
      cols.push({ visible: [rndFillerId(), rndFillerId(), rndFillerId()] })
    } else {
      cols.push({ visible: [grid[0][coreCol].id, grid[1][coreCol].id, grid[2][coreCol].id] })
    }
  }
  return cols
}

// "Brewing" = first two core reels match on any row → tease the deciding reel.
function computeBrewing(grid) {
  for (let r = 0; r < ROWS; r++) {
    const a = grid[r][0], b = grid[r][1]
    if (a && b && a.id === b.id) {
      return { brewing: true, willWin: !!(grid[r][2] && grid[r][2].id === a.id) }
    }
  }
  return { brewing: false, willWin: false }
}

// ── Shared GSAP driver: one global updateRoot, fed by the active app ticker ──
let _gsapHijacked = false
let _activeApp = null

// ── Texture cache (survives remounts) ─────────────────────
let _texPromise = null
function loadTextures() {
  if (!_texPromise) {
    _texPromise = (async () => {
      const out = {}
      await Promise.all(SLOT_SYMBOLS.map(async (s) => { out[s.id] = await Assets.load(s.img) }))
      return out
    })()
  }
  return _texPromise
}

// ── SlotMachine ───────────────────────────────────────────
export default function SlotMachine({ session, onComplete, jackpotPool = 0 }) {
  const hostRef    = useRef(null)
  const appRef     = useRef(null)
  const reelSetRef = useRef(null)

  const [ready, setReady]   = useState(false)
  const [index, setIndex]   = useState(0)
  const [phase, setPhase]   = useState('ready')   // ready | spinning | revealing | between | done
  const [running, setRun]   = useState(0)
  const [activeLines, setActiveLines] = useState([])
  const [shaking, setShaking] = useState(false)

  const current = session?.spins?.[index] || null

  // ── Pixi init (once) ──
  useEffect(() => {
    let cancelled = false
    let app = null
    let reelSet = null

    ;(async () => {
      const textures = await loadTextures()
      if (cancelled || !hostRef.current) return

      app = new Application()
      await app.init({
        width: CANVAS_W, height: CANVAS_H,
        backgroundAlpha: 0, antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
      })
      if (cancelled) { app.destroy(true); return }

      // Drive GSAP from the active Pixi ticker (pixi-reels animates via GSAP).
      if (!_gsapHijacked) { gsap.ticker.remove(gsap.updateRoot); _gsapHijacked = true }
      _activeApp = app
      app.ticker.add(() => { if (_activeApp === app) gsap.updateRoot(app.ticker.lastTime / 1000) })

      hostRef.current.appendChild(app.canvas)

      // Dark reel window + middle-row payline band, drawn behind the reels.
      const bg = new Graphics()
      bg.roundRect(0, 0, CANVAS_W, CANVAS_H, 14).fill(0x080318)
      bg.roundRect(FRAME, FRAME + CELL + GAP, CANVAS_W - FRAME * 2, CELL, 4)
        .fill({ color: 0xffc83d, alpha: 0.06 })
      app.stage.addChild(bg)

      reelSet = new ReelSetBuilder()
        .reels(REELS).visibleRows(ROWS)
        .symbolSize(CELL, CELL).symbolGap(GAP, GAP)
        .symbols((reg) => {
          for (const s of SLOT_SYMBOLS) reg.register(s.id, FitSpriteSymbol, { textures })
        })
        .weights(FILL_WEIGHTS)
        .initialFrame(fillerFrame())
        .speed('normal', SpeedPresets.NORMAL)
        .speed('turbo', SpeedPresets.TURBO)
        .ticker(app.ticker)
        .build()

      reelSet.x = FRAME
      reelSet.y = FRAME
      app.stage.addChild(reelSet)

      // Blur each cell while its reel spins; crisp on landing. Per-reel phase.
      for (const reel of reelSet.reels) {
        reel.events.on('phase:enter', (name) => {
          const on = name === 'spin'
          for (let row = 0; row < ROWS; row++) {
            const sym = reel.getSymbolAt(row)
            if (sym && typeof sym.setBlurred === 'function') sym.setBlurred(on)
          }
        })
      }
      reelSet.events.on('spin:reelLanded', () => playReelStop())

      appRef.current = app
      reelSetRef.current = reelSet
      setReady(true)
    })()

    return () => {
      cancelled = true
      try { reelSetRef.current?.destroy?.() } catch { /* */ }
      const a = appRef.current
      if (a) { if (_activeApp === a) _activeApp = null; try { a.destroy(true) } catch { /* */ } }
      appRef.current = null
      reelSetRef.current = null
    }
  }, [])

  if (!session) return null

  const spinCount = session.spinCount
  const spinsLeft = phase === 'between' ? spinCount - index - 1 : spinCount - index

  // ── Spin one ──
  async function startSpin() {
    const reelSet = reelSetRef.current
    if (!reelSet) return
    if (phase === 'spinning') { try { reelSet.skipSpin() } catch { /* */ } return }
    if (phase !== 'ready' && phase !== 'between') return

    const idx = phase === 'between' ? index + 1 : index
    if (phase === 'between') setIndex(idx)
    const spin = session.spins[idx]

    setActiveLines([])
    setPhase('spinning')
    setShaking(true)
    setTimeout(() => setShaking(false), 360)
    playSpinStart()

    try { reelSet.spotlight.hide() } catch { /* */ }

    const brew = computeBrewing(spin.grid)

    const spinPromise = reelSet.spin()
    if (brew.brewing) { try { reelSet.setAnticipation([3]) } catch { /* */ } }
    // Small settle so the spin never feels instant even though we know the result.
    await new Promise(r => setTimeout(r, 240))
    reelSet.setResult(buildResultCols(spin.grid))
    await spinPromise

    if (brew.brewing && !brew.willWin) playNearMiss()
    reveal(idx)
  }

  // ── Reveal wins, count coins, advance ──
  async function reveal(idx) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms))
    setPhase('revealing')
    const spin = session.spins[idx]
    const reelSet = reelSetRef.current
    await sleep(420)

    const lines = spin.winningLines || []
    if (lines.length && reelSet) {
      const winLines = lines.map(l => ({
        positions: l.cells.map(([r, c]) => ({ reelIndex: c + CORE_OFFSET, rowIndex: r })),
      }))
      try { reelSet.spotlight.cycle(winLines, { displayDuration: 900, gapDuration: 180, cycles: 1 }) } catch { /* */ }
      for (let i = 0; i < lines.length; i++) {
        setActiveLines(prev => [...prev, lines[i]])
        playLineWin(i)
        await sleep(360)
      }
    }

    const gained = spin.isJackpot ? session.jackpotAward : spin.coins
    if (gained > 0) {
      const start = running
      const steps = Math.min(gained, 26)
      for (let s = 1; s <= steps; s++) {
        await sleep(60)
        setRun(Math.round(start + (gained * s) / steps))
        if (s % 2) playCoinTick(s)
      }
      setRun(start + gained)
      if (spin.isJackpot) playSlotWin()
    } else {
      await sleep(380)
    }

    await sleep(spin.isJackpot || spin.isBonus ? 1300 : 560)
    try { reelSetRef.current?.spotlight.hide() } catch { /* */ }
    if (idx + 1 >= spinCount) { setPhase('done'); onComplete?.() }
    else setPhase('between')
  }

  // ── Render ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%', maxWidth: 420 }}>
      <div style={{
        width: '100%', borderRadius: 22,
        background: 'linear-gradient(180deg, #1A0A2E 0%, #2D1055 100%)',
        border: '2.5px solid #6B3FA0',
        boxShadow: '0 0 0 1px rgba(155,126,200,0.3) inset, 0 10px 32px rgba(40,8,90,0.7)',
        padding: '14px 12px 16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        animation: shaking ? 'slot-shake 0.38s ease-out' : 'none',
      }}>

        {/* Top displays */}
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <div style={displayBox}>
            <div style={displayLabel}>★ JACKPOT ★</div>
            <div style={{ ...displayValue, fontSize: 17 }}>💎 {jackpotPool.toLocaleString()}</div>
          </div>
          <div style={displayBox}>
            <div style={displayLabel}>coins won</div>
            <div style={{ ...displayValue, color: '#FFF3C4' }}>
              <span key={running} style={{ animation: 'coin-pop 0.25s ease-out', display: 'inline-block' }}>{running}</span>
            </div>
          </div>
        </div>

        {/* Pixi reel canvas */}
        <div ref={hostRef} style={{
          width: CANVAS_W, height: CANVAS_H, position: 'relative',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: 'inset 0 2px 14px rgba(0,0,0,0.8)',
          border: '2px solid #3A1560',
        }}>
          {!ready && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Fredoka', cursive", fontSize: 15, color: '#6B4FA0',
            }}>loading reels…</div>
          )}
        </div>

        {/* Win breakdown */}
        {(phase === 'revealing' || phase === 'between' || phase === 'done') && current && (
          <div style={{
            width: '100%', background: 'rgba(255,245,253,0.96)',
            border: '2px solid #C8A0E0', borderRadius: 12, padding: '8px 12px',
            display: 'flex', flexDirection: 'column', gap: 4,
            animation: 'bounce-in 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            {activeLines.map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Fredoka', cursive", fontSize: 15, color: '#3D2B4F' }}>
                {l.symbol.img
                  ? <img src={l.symbol.img} alt={l.symbol.id} style={{ width: 22, height: 22, objectFit: 'contain' }} />
                  : <span>{l.symbol.emoji}</span>}
                <span style={{ flex: 1 }}>{l.label}</span>
                <span style={{ color: l.special ? '#C99A00' : '#5CBFA0', fontWeight: 700 }}>
                  {l.special ? `${l.special === 'jackpot' ? '💎 JACKPOT' : '🎰 BONUS'}!` : `+${l.coins}`}
                </span>
              </div>
            ))}
            {current.summary && (
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#7B5EA7', textAlign: 'center', marginTop: activeLines.length ? 2 : 0 }}>
                {current.summary}
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        {(phase === 'ready' || phase === 'between') && (
          <button onClick={startSpin} disabled={!ready} style={{ ...spinBtn, opacity: ready ? 1 : 0.5 }}>
            {phase === 'between' ? `✦ NEXT SPIN · ${spinsLeft} left` : `✦ SPIN! · ${spinsLeft} left`}
          </button>
        )}
        {phase === 'spinning' && (
          <button onClick={startSpin} style={{ ...spinBtn, background: 'linear-gradient(180deg,#9B7EC8,#7B5EA7)' }}>
            STOP ⏹
          </button>
        )}
        {phase === 'done' && (
          <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#FFD700', letterSpacing: '0.08em' }}>
            ✦ ALL DONE ✦
          </div>
        )}
      </div>

      {/* Result banners */}
      {phase === 'done' && session.isJackpot && (<div style={banner('#FFD700', '#5C3A00')}>💎 JACKPOT! +{session.jackpotAward} 💎</div>)}
      {phase === 'done' && session.isBonus && (<div style={banner('#FFE9A0', '#5C3A00')}>⭐ BONUS ROUND! ⭐</div>)}
      {phase === 'done' && !session.isJackpot && !session.isBonus && (<div style={banner('#B4E0C8', '#1A5C3A')}>✦ YOU WON {running} COINS! ✦</div>)}

      <style>{`
        @keyframes spin-btn-pulse {
          0%, 100% { box-shadow: 0 5px 0 #9A2550, 0 8px 20px rgba(224,85,128,0.4); }
          50%       { box-shadow: 0 5px 0 #9A2550, 0 8px 28px rgba(224,85,128,0.7); }
        }
      `}</style>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────
const displayBox = { flex: 1, background: '#0D0520', borderRadius: 10, border: '1.5px solid #3A1560', padding: '6px 10px', textAlign: 'center' }
const displayLabel = { fontFamily: 'Mulish, sans-serif', fontSize: 10, color: '#6B4FA0', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }
const displayValue = { fontFamily: "'Fredoka', cursive", fontSize: 19, color: '#FFE9A0', textShadow: '0 0 8px rgba(255,215,0,0.55)', letterSpacing: '0.02em' }
const spinBtn = {
  width: '100%', padding: '13px 0',
  fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#fff', letterSpacing: '0.1em',
  background: 'linear-gradient(180deg, #FF85A1 0%, #E05580 100%)',
  border: 'none', borderRadius: 14, cursor: 'pointer', userSelect: 'none',
  animation: 'spin-btn-pulse 1.1s ease-in-out infinite',
}
function banner(bg, fg) {
  return {
    fontFamily: "'Fredoka', cursive", fontSize: 22, color: fg,
    background: bg, border: `3px solid ${fg}33`, borderRadius: 14,
    padding: '7px 20px', boxShadow: '0 4px 0 rgba(0,0,0,0.12)',
    animation: 'bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1)',
  }
}
