import { useRef, useState, useEffect } from 'react'
// Side-effect import: patches Pixi's renderer to generate shaders/uniforms WITHOUT
// new Function()/eval, using polyfills instead. REQUIRED in the packaged app — its
// hardened CSP is `script-src 'self' 'wasm-unsafe-eval'` (no 'unsafe-eval'), so Pixi's
// default eval-based codegen throws "Current environment does not allow unsafe-eval".
// (The dev launcher sends no CSP, so this is a packaged-only failure.) Must run before
// any Renderer is created — a top-level import guarantees that. Don't loosen the CSP.
import 'pixi.js/unsafe-eval'
import { Application, Assets, Graphics, loadTextures as pixiLoadTextures } from 'pixi.js'
import { gsap } from 'gsap'
import { ReelSetBuilder, SpeedPresets } from 'pixi-reels'
import { FitSpriteSymbol } from './slots/FitSpriteSymbol'
import SlotPayTable from './SlotPayTable'
import { SLOT_SYMBOLS } from '../engine/gameLogic'
import { REEL_WEIGHTS } from '../engine/slotEngine'
import { playSpinStart, playReelStop, playLineWin, playCoinTick, playSlotWin, playNearMiss } from '../engine/sounds'

// CRITICAL for the packaged app: assets are served over the custom app:// protocol.
// Pixi v8 decodes images in a Web Worker via createImageBitmap by default, and that
// worker can't fetch over the privileged app:// scheme → every texture hangs forever
// ("loading reels…" with no error). Force Pixi's plain HTMLImageElement load path —
// the same browser image pipeline that loads every OTHER image in the app fine over
// app:// (nav icons, sunburst bg, the splash webp). Harmless in the http launcher too.
pixiLoadTextures.config.preferWorkers = false
pixiLoadTextures.config.preferCreateImageBitmap = false

// ── Layout ────────────────────────────────────────────────
const REELS = 5
const ROWS  = 3
const CELL  = 70          // px square cell
const GAP   = 4           // gap between reels (and rows)
const FRAME = 10          // dark window padding inside the canvas

const CANVAS_W = REELS * CELL + (REELS - 1) * GAP + FRAME * 2
const CANVAS_H = ROWS * CELL + (ROWS - 1) * GAP + FRAME * 2

// ── Win-line drawing ──────────────────────────────────────
// Distinct color per winning line so the reel rings + the breakdown rows match.
const LINE_COLORS = ['#FFD54A', '#5CE1E6', '#FF7FB6', '#A98BFF', '#7CFF9B', '#FF9F5A', '#6BC6FF', '#FFE27A']
// Center of grid cell (row, col) in canvas px — the SVG overlay sits exactly over
// the reel canvas (same CANVAS_W×H box), so a cell center is FRAME + local center.
function cellCenter(row, col) {
  return [FRAME + col * (CELL + GAP) + CELL / 2, FRAME + row * (CELL + GAP) + CELL / 2]
}
// An SVG overlay over the reels that draws, per winning line, a glowing connector
// through the winning symbols + a ring on each. Driven by React state (the wins
// revealed so far), so the lines ACCUMULATE during the reveal and STAY on the
// settled board until the next spin clears them. Scatter bonus = rings only.
function WinLineOverlay({ wins }) {
  if (!wins?.length) return null
  return (
    <svg
      width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      style={{ position: 'absolute', left: 0, top: 0, zIndex: 2, pointerEvents: 'none' }}
    >
      {wins.map((w, i) => {
        const pts = (w.cells || []).map(([r, c]) => cellCenter(r, c))
        if (!pts.length) return null
        const color = w.color || '#FFD54A'
        const showLine = !!w.line && pts.length >= 2 && w.special !== 'bonus'
        const poly = pts.map(p => p.join(',')).join(' ')
        return (
          <g key={i}>
            {showLine && <polyline points={poly} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" opacity="0.28" />}
            {showLine && <polyline points={poly} fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />}
            {pts.map(([x, y], j) => (
              <g key={j}>
                <circle cx={x} cy={y} r={CELL * 0.46} fill="none" stroke={color} strokeWidth="8" opacity="0.28" />
                <circle cx={x} cy={y} r={CELL * 0.46} fill="none" stroke={color} strokeWidth="4" />
              </g>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

// ── Symbols / fills ───────────────────────────────────────
// The blurred spin-fill uses the real reel weights (so the spin looks like the
// result distribution). `bonus` is special-only (weight 0). The idle/resting frame
// uses non-wild, non-bonus fillers.
const FILL_WEIGHTS = Object.fromEntries(SLOT_SYMBOLS.map(s => [s.id, s.id === 'bonus' ? 0 : (REEL_WEIGHTS[s.id] || 0)]))
const IDLE_IDS = SLOT_SYMBOLS.filter(s => s.id !== 'bonus' && s.id !== 'wild').map(s => s.id)
const rndIdle = () => IDLE_IDS[Math.floor(Math.random() * IDLE_IDS.length)]
const idleFrame = () => Array.from({ length: REELS }, () => ({ visible: [rndIdle(), rndIdle(), rndIdle()] }))

// Engine grid is rows×reels of symbol OBJECTS → one ColumnTarget per reel.
function buildResultCols(grid) {
  return Array.from({ length: REELS }, (_, c) => ({
    visible: [grid[0][c].id, grid[1][c].id, grid[2][c].id],
  }))
}

// "Brewing" = a pay symbol lands on reels 0 AND 1 (wild bridges) → a combo is
// building, so tease a later reel for suspense. willWin = the spin actually pays.
function computeBrew(grid, coins) {
  const idsOn = (c) => new Set([0, 1, 2].map(r => grid[r][c].id))
  const r0 = idsOn(0), r1 = idsOn(1)
  let brewing = false
  for (const id of r0) {
    if (id === 'bonus') continue
    if (id === 'wild' || r1.has(id) || r1.has('wild')) { brewing = true; break }
  }
  return { brewing, willWin: coins > 0 }
}

// ── Shared GSAP driver: one global updateRoot, fed by the active app ticker ──
let _gsapHijacked = false
let _activeApp = null

// ── Texture cache (survives remounts) ─────────────────────
// Pre-resolve each symbol path to a FULLY-QUALIFIED url via the browser before
// handing it to Pixi — in the packaged app Pixi's own resolver drops the app:// host
// ('/slots/x.png' → 'app://slots/x.png', 404). new URL() resolves it correctly.
const _resolveAsset = (p) => new URL(p, document.baseURI).href
let _texPromise = null
function loadTextures() {
  if (!_texPromise) {
    _texPromise = (async () => {
      const out = {}
      await Promise.all(SLOT_SYMBOLS.map(async (s) => { out[s.id] = await Assets.load(_resolveAsset(s.img)) }))
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
  const skipRef    = useRef(false)   // tapping the button during reveal fast-forwards it

  const [ready, setReady]   = useState(false)
  const [index, setIndex]   = useState(0)
  const [phase, setPhase]   = useState('ready')   // ready | spinning | revealing | between | done
  const [running, setRun]   = useState(0)      // run total across the session
  const [lastWin, setLastWin] = useState(0)    // coins from the most recent spin
  const [activeWins, setActiveWins] = useState([])
  const [shaking, setShaking] = useState(false)
  const [showPays, setShowPays] = useState(false)
  const [loadError, setLoadError] = useState(null)   // surface init failures instead of hanging

  const current = session?.spins?.[index] || null

  // ── Pixi init (once) ──
  useEffect(() => {
    let cancelled = false
    let app = null
    let reelSet = null

    ;(async () => {
      try {
        const textures = await loadTextures()
        if (cancelled || !hostRef.current) return

        app = new Application()
        await app.init({
          width: CANVAS_W, height: CANVAS_H,
          backgroundAlpha: 0, antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
        })
        if (cancelled) { app.destroy(true); return }

        if (!_gsapHijacked) { gsap.ticker.remove(gsap.updateRoot); _gsapHijacked = true }
        _activeApp = app
        app.ticker.add(() => { if (_activeApp === app) gsap.updateRoot(app.ticker.lastTime / 1000) })

        hostRef.current.appendChild(app.canvas)

        const bg = new Graphics()
        bg.roundRect(0, 0, CANVAS_W, CANVAS_H, 14).fill(0x080318)
        bg.roundRect(FRAME, FRAME + CELL + GAP, CANVAS_W - FRAME * 2, CELL, 4)
          .fill({ color: 0xffc83d, alpha: 0.06 })
        app.stage.addChild(bg)

        reelSet = new ReelSetBuilder()
          .reels(REELS).visibleRows(ROWS)
          .symbolSize(CELL, CELL).symbolGap(GAP, GAP)
          .symbols((reg) => { for (const s of SLOT_SYMBOLS) reg.register(s.id, FitSpriteSymbol, { textures }) })
          .weights(FILL_WEIGHTS)
          .initialFrame(idleFrame())
          .speed('normal', SpeedPresets.NORMAL)
          .speed('turbo', SpeedPresets.TURBO)
          .ticker(app.ticker)
          .build()

        reelSet.x = FRAME
        reelSet.y = FRAME
        app.stage.addChild(reelSet)

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
      } catch (err) {
        if (!cancelled) setLoadError(String(err?.message || err))
      }
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

    setActiveWins([])
    setPhase('spinning')
    setShaking(true)
    setTimeout(() => setShaking(false), 360)
    playSpinStart()

    const brew = computeBrew(spin.grid, spin.coins)

    const spinPromise = reelSet.spin()
    if (brew.brewing) { try { reelSet.setAnticipation([3]) } catch { /* */ } }
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
    skipRef.current = false
    // Tapping the button during the reveal sets skipRef → every remaining pause is
    // skipped and the coin count jumps to the total, so you can spin again fast.
    const wait = async (ms) => { if (!skipRef.current) await sleep(ms) }
    const spin = session.spins[idx]
    const gained = spin.isJackpot ? session.jackpotAward : spin.coins
    const won = gained > 0
    setLastWin(gained)
    await wait(won ? 420 : 180)

    const wins = spin.wins || []
    if (wins.length) {
      const per = wins.length > 5 ? 360 : 620
      // Reveal each winning line one at a time (ring + connector via the SVG
      // overlay, in sync with its breakdown row). They ACCUMULATE and stay drawn
      // on the settled board — no longer cleared until the next spin.
      for (let i = 0; i < wins.length; i++) {
        const color = LINE_COLORS[i % LINE_COLORS.length]
        setActiveWins(prev => [...prev, { ...wins[i], color }])
        playLineWin(i)
        await wait(per)
      }
    }

    if (won) {
      const start = running
      if (skipRef.current) {
        setRun(start + gained)
        if (spin.isJackpot) playSlotWin()
      } else {
        const steps = Math.min(gained, 26)
        for (let s = 1; s <= steps; s++) {
          if (skipRef.current) break
          await sleep(60)
          setRun(Math.round(start + (gained * s) / steps))
          if (s % 2) playCoinTick(s)
        }
        setRun(start + gained)
        if (spin.isJackpot) playSlotWin()
      }
    }

    // Hold the win on screen; a loss advances almost immediately.
    await wait(spin.isJackpot || spin.isBonus ? 1300 : (won ? 560 : 180))
    if (idx + 1 >= spinCount) { setPhase('done'); onComplete?.() }
    else setPhase('between')
  }

  // The one spin button is ALWAYS active: it lands a spin, skips a reveal, or
  // starts the next spin — whatever moves you forward fastest.
  function onSpinButton() {
    if (phase === 'spinning') { try { reelSetRef.current?.skipSpin() } catch { /* */ } return }
    if (phase === 'revealing') { skipRef.current = true; return }
    if (phase === 'ready' || phase === 'between') startSpin()
  }

  // ── Render ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%', maxWidth: 420 }}>
      <div style={{
        width: '100%', borderRadius: 22,
        background: 'linear-gradient(180deg, #8A3358 0%, #B24E74 100%)',
        border: '2.5px solid #F0C24E',
        boxShadow: '0 0 0 1px rgba(240,200,90,0.5) inset, 0 10px 32px rgba(90,20,50,0.55)',
        padding: '14px 12px 16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        animation: shaking ? 'slot-shake 0.38s ease-out' : 'none',
      }}>

        {/* Top displays: jackpot · this spin's win · run total · pay table */}
        <div style={{ display: 'flex', gap: 6, width: '100%' }}>
          <div style={displayBox}>
            <div style={displayLabel}>★ Jackpot</div>
            <div style={{ ...displayValue, fontSize: 15 }}>💎{jackpotPool.toLocaleString()}</div>
          </div>
          <div style={displayBox}>
            <div style={displayLabel}>This spin</div>
            <div style={{ ...displayValue, color: '#FFF3C4' }}>
              <span key={lastWin} style={{ animation: 'coin-pop 0.25s ease-out', display: 'inline-block' }}>+{lastWin}</span>
            </div>
          </div>
          <div style={displayBox}>
            <div style={displayLabel}>Run total</div>
            <div style={{ ...displayValue, color: '#B7F0D2' }}>
              <span key={running} style={{ animation: 'coin-pop 0.25s ease-out', display: 'inline-block' }}>{running}</span>
            </div>
          </div>
          <button onClick={() => setShowPays(true)} aria-label="Pay table" title="Pay table" style={infoBtn}>ⓘ</button>
        </div>

        {/* Pixi reel canvas */}
        <div ref={hostRef} style={{
          width: CANVAS_W, height: CANVAS_H, position: 'relative',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: 'inset 0 2px 14px rgba(0,0,0,0.8)',
          border: '2px solid #8A3350',
        }}>
          {!ready && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '0 16px',
              fontFamily: "'Fredoka', cursive", fontSize: loadError ? 12 : 15, color: loadError ? '#FF9DB0' : '#C88BA0',
            }}>{loadError ? `reels failed: ${loadError}` : 'loading reels…'}</div>
          )}
          <WinLineOverlay wins={activeWins} />
        </div>

        {/* Spin button — ALWAYS here (above the win list) so multiple wins listing
            below can never shove it around. It's always actionable: land / skip /
            next spin. */}
        {phase === 'done' ? (
          <div style={doneLabel}>✦ ALL DONE ✦</div>
        ) : (
          <button
            onClick={onSpinButton}
            disabled={!ready}
            style={{
              ...spinBtn, opacity: ready ? 1 : 0.6,
              ...(phase === 'spinning' ? { background: 'linear-gradient(180deg,#9B7EC8,#7B5EA7)', animation: 'none' } : {}),
            }}
          >
            {phase === 'spinning' ? 'STOP ⏹'
              : phase === 'revealing' ? 'SKIP ▸'
                : phase === 'between' ? `✦ NEXT SPIN · ${spinsLeft} left`
                  : `✦ SPIN! · ${spinsLeft} left`}
          </button>
        )}

        {/* Win breakdown — BELOW the button */}
        {(phase === 'revealing' || phase === 'between' || phase === 'done') && current && (
          <div style={{
            width: '100%', background: 'rgba(255,245,253,0.96)',
            border: '2px solid #C8A0E0', borderRadius: 12, padding: '8px 12px',
            display: 'flex', flexDirection: 'column', gap: 4,
            animation: 'bounce-in 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            {activeWins.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Fredoka', cursive", fontSize: 15, color: '#3D2B4F' }}>
                <span style={{ width: 10, height: 10, borderRadius: 5, flexShrink: 0, background: w.color || '#5CBFA0', boxShadow: `0 0 6px ${w.color || '#5CBFA0'}` }} />
                {w.symbol?.img
                  ? <img src={w.symbol.img} alt={w.symbol.id} style={{ width: 22, height: 22, objectFit: 'contain' }} />
                  : <span>{w.symbol?.emoji}</span>}
                <span style={{ flex: 1 }}>
                  {w.label}{w.hasWild ? <span style={{ color: '#C77FB0', fontSize: 13 }}> · WILD ×2</span> : null}
                </span>
                <span style={{ color: w.special ? '#C99A00' : '#5CBFA0', fontWeight: 700 }}>
                  {w.special ? `${w.special === 'jackpot' ? '💎 JACKPOT' : '🎰 BONUS'}!` : `+${w.coins}`}
                </span>
              </div>
            ))}
            {current.summary && (
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#7B5EA7', textAlign: 'center', marginTop: activeWins.length ? 2 : 0 }}>
                {current.summary}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result banners */}
      {phase === 'done' && session.isJackpot && (<div style={banner('#FFD700', '#5C3A00')}>💎 JACKPOT! +{session.jackpotAward} 💎</div>)}
      {phase === 'done' && session.isBonus && (<div style={banner('#FFE9A0', '#5C3A00')}>⭐ BONUS ROUND! ⭐</div>)}
      {phase === 'done' && !session.isJackpot && !session.isBonus && (<div style={banner('#B4E0C8', '#1A5C3A')}>✦ YOU WON {running} COINS! ✦</div>)}

      {showPays && <SlotPayTable onClose={() => setShowPays(false)} />}

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
const displayBox = { flex: 1, minWidth: 0, background: 'linear-gradient(180deg, #6E5518 0%, #4E3D0F 100%)', borderRadius: 10, border: '1.5px solid #E7C55C', padding: '5px 7px', textAlign: 'center' }
const infoBtn = {
  flexShrink: 0, width: 30, alignSelf: 'stretch',
  background: 'linear-gradient(180deg, #6E5518 0%, #4E3D0F 100%)', borderRadius: 10, border: '1.5px solid #E7C55C',
  color: '#FFF0B8', fontSize: 16, cursor: 'pointer', lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const displayLabel = { fontFamily: 'Mulish, sans-serif', fontSize: 9, color: '#F4E3AC', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2, whiteSpace: 'nowrap' }
const displayValue = { fontFamily: "'Fredoka', cursive", fontSize: 16, color: '#FFE9A0', textShadow: '0 0 8px rgba(255,215,0,0.55)', letterSpacing: '0.01em' }
const doneLabel = { fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#FFD700', letterSpacing: '0.08em', padding: '10px 0' }
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
