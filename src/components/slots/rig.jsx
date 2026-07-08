/* eslint-disable react-refresh/only-export-components -- deliberate rig module:
   one component (WinLineOverlay) + the shared hooks/constants both slot machines
   consume. An HMR full-reload here is fine (the rig rebuilds cleanly). */
import { useEffect, useRef, useState } from 'react'
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
import { FitSpriteSymbol } from './FitSpriteSymbol'
import { SLOT_SYMBOLS, REEL_WEIGHTS } from '../../engine/slotEngine'
import { playReelStop } from '../../engine/sounds'

// ─────────────────────────────────────────────────────────────────────────────
// THE SHARED REEL RIG — one proven Pixi/pixi-reels core for BOTH slot machines
// (the reward "bead" slots and the casino betting slots), parameterized by CELL
// size so theater mode can scale the icons up. All the hard-won app:// and CSP
// workarounds live here exactly once.
// ─────────────────────────────────────────────────────────────────────────────

// CRITICAL for the packaged app: assets are served over the custom app:// protocol.
// Pixi v8 decodes images in a Web Worker via createImageBitmap by default, and that
// worker can't fetch over the privileged app:// scheme → every texture hangs forever
// ("loading reels…" with no error). Force Pixi's plain HTMLImageElement load path.
pixiLoadTextures.config.preferWorkers = false
pixiLoadTextures.config.preferCreateImageBitmap = false

export const REELS = 5
export const ROWS  = 3
export const GAP   = 4      // gap between reels (and rows)
export const FRAME = 10     // dark window padding inside the canvas

export const canvasW = (cell) => REELS * cell + (REELS - 1) * GAP + FRAME * 2
export const canvasH = (cell) => ROWS * cell + (ROWS - 1) * GAP + FRAME * 2

// Distinct color per winning line so the reel rings + the breakdown rows match.
export const LINE_COLORS = ['#FFD54A', '#5CE1E6', '#FF7FB6', '#A98BFF', '#7CFF9B', '#FF9F5A', '#6BC6FF', '#FFE27A']

// The blurred spin-fill uses the real reel weights (so the spin looks like the
// result distribution). `bonus` is special-only (weight 0). The idle/resting frame
// uses non-wild, non-bonus fillers.
const FILL_WEIGHTS = Object.fromEntries(SLOT_SYMBOLS.map(s => [s.id, s.id === 'bonus' ? 0 : (REEL_WEIGHTS[s.id] || 0)]))
const IDLE_IDS = SLOT_SYMBOLS.filter(s => s.id !== 'bonus' && s.id !== 'wild').map(s => s.id)
const rndIdle = () => IDLE_IDS[Math.floor(Math.random() * IDLE_IDS.length)]
const idleFrame = () => Array.from({ length: REELS }, () => ({ visible: [rndIdle(), rndIdle(), rndIdle()] }))

// Engine grid is rows×reels of symbol OBJECTS → one ColumnTarget per reel.
export function buildResultCols(grid) {
  return Array.from({ length: REELS }, (_, c) => ({
    visible: [grid[0][c].id, grid[1][c].id, grid[2][c].id],
  }))
}

// "Brewing" = a pay symbol lands on reels 0 AND 1 (wild bridges) → a combo is
// building, so tease a later reel for suspense. willWin = the spin actually pays.
export function computeBrew(grid, coins) {
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

/**
 * The Pixi reel rig as a hook. Builds the app + reel set at the given CELL size
 * (rebuilds if cell changes — happens once when theater mode measures the window).
 * → { hostRef, reelSetRef, ready, loadError }
 */
export function useReelRig(cell) {
  const hostRef    = useRef(null)
  const appRef     = useRef(null)
  const reelSetRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let cancelled = false
    let app = null
    let reelSet = null
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset for a cell-size rebuild (shows "loading reels…" while the rig reconstructs)
    setReady(false)

    ;(async () => {
      try {
        const textures = await loadTextures()
        if (cancelled || !hostRef.current) return

        const W = canvasW(cell), H = canvasH(cell)
        app = new Application()
        await app.init({
          width: W, height: H,
          backgroundAlpha: 0, antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
        })
        if (cancelled) { app.destroy(true); return }

        if (!_gsapHijacked) { gsap.ticker.remove(gsap.updateRoot); _gsapHijacked = true }
        _activeApp = app
        app.ticker.add(() => { if (_activeApp === app) gsap.updateRoot(app.ticker.lastTime / 1000) })

        hostRef.current.appendChild(app.canvas)

        const bg = new Graphics()
        bg.roundRect(0, 0, W, H, 14).fill(0x080318)
        bg.roundRect(FRAME, FRAME + cell + GAP, W - FRAME * 2, cell, 4)
          .fill({ color: 0xffc83d, alpha: 0.06 })
        app.stage.addChild(bg)

        reelSet = new ReelSetBuilder()
          .reels(REELS).visibleRows(ROWS)
          .symbolSize(cell, cell).symbolGap(GAP, GAP)
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
  }, [cell])

  return { hostRef, reelSetRef, ready, loadError }
}

// An SVG overlay over the reels that draws, per winning line, a glowing connector
// through the winning symbols + a ring on each. Driven by React state (the wins
// revealed so far), so the lines ACCUMULATE during the reveal and STAY on the
// settled board until the next spin clears them. Scatter bonus = rings only.
export function WinLineOverlay({ wins, cell }) {
  if (!wins?.length) return null
  const W = canvasW(cell), H = canvasH(cell)
  const center = (row, col) => [FRAME + col * (cell + GAP) + cell / 2, FRAME + row * (cell + GAP) + cell / 2]
  return (
    <svg
      width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position: 'absolute', left: 0, top: 0, zIndex: 2, pointerEvents: 'none' }}
    >
      {wins.map((w, i) => {
        const pts = (w.cells || []).map(([r, c]) => center(r, c))
        if (!pts.length) return null
        const color = w.color || '#FFD54A'
        const showLine = !!w.line && pts.length >= 2 && w.special !== 'bonus'
        const poly = pts.map(p => p.join(',')).join(' ')
        return (
          <g key={i}>
            {showLine && <polyline points={poly} fill="none" stroke={color} strokeWidth={cell * 0.16} strokeLinecap="round" strokeLinejoin="round" opacity="0.28" />}
            {showLine && <polyline points={poly} fill="none" stroke={color} strokeWidth={cell * 0.064} strokeLinecap="round" strokeLinejoin="round" />}
            {pts.map(([x, y], j) => (
              <g key={j}>
                <circle cx={x} cy={y} r={cell * 0.46} fill="none" stroke={color} strokeWidth={cell * 0.11} opacity="0.28" />
                <circle cx={x} cy={y} r={cell * 0.46} fill="none" stroke={color} strokeWidth={cell * 0.057} />
              </g>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

// ── Theater mode helpers ──────────────────────────────────
// The slot machines render as a full-window overlay ("theater"): pick the biggest
// CELL that fits the window with room for displays + button + win list, and ask
// the Electron shell to go landscape while the machine is open (restored on exit).
export function useTheaterCell() {
  const compute = () => {
    const vw = window.innerWidth, vh = window.innerHeight
    const byW = (vw * 0.92 - FRAME * 2 - GAP * (REELS - 1)) / REELS
    const byH = (vh * 0.52 - FRAME * 2 - GAP * (ROWS - 1)) / ROWS
    return Math.round(Math.max(64, Math.min(byW, byH, 132)))
  }
  const [cell, setCell] = useState(compute)
  useEffect(() => {
    let t = 0
    const onResize = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        const next = compute()
        // only rebuild the rig for a MEANINGFUL size change (the Electron
        // landscape resize), not 1px window nudges
        setCell(prev => (Math.abs(next - prev) > 8 ? next : prev))
      }, 180)
    }
    window.addEventListener('resize', onResize)
    return () => { clearTimeout(t); window.removeEventListener('resize', onResize) }
     
  }, [])
  return cell
}

export function useSlotsWindow() {
  useEffect(() => {
    try { window.desktop?.slotsWindow?.(true) } catch { /* */ }
    return () => { try { window.desktop?.slotsWindow?.(false) } catch { /* */ } }
  }, [])
}

// ── Shared cabinet styles (warm berry + gold) ─────────────
export const cabinetStyle = {
  borderRadius: 22,
  background: 'linear-gradient(180deg, #8A3358 0%, #B24E74 100%)',
  border: '2.5px solid #F0C24E',
  boxShadow: '0 0 0 1px rgba(240,200,90,0.5) inset, 0 10px 32px rgba(90,20,50,0.55)',
  padding: '14px 12px 16px',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
}
export const displayBox = { flex: 1, minWidth: 0, background: 'linear-gradient(180deg, #6E5518 0%, #4E3D0F 100%)', borderRadius: 10, border: '1.5px solid #E7C55C', padding: '5px 7px', textAlign: 'center' }
export const infoBtn = {
  flexShrink: 0, width: 30, alignSelf: 'stretch',
  background: 'linear-gradient(180deg, #6E5518 0%, #4E3D0F 100%)', borderRadius: 10, border: '1.5px solid #E7C55C',
  color: '#FFF0B8', fontSize: 16, cursor: 'pointer', lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
export const displayLabel = { fontFamily: 'Mulish, sans-serif', fontSize: 10, color: '#F4E3AC', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2, whiteSpace: 'nowrap' }
export const displayValue = { fontFamily: "'Fredoka', cursive", fontSize: 17, color: '#FFE9A0', textShadow: '0 0 8px rgba(255,215,0,0.55)', letterSpacing: '0.01em' }
export const spinBtn = {
  width: '100%', padding: '13px 0',
  fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#fff', letterSpacing: '0.1em',
  background: 'linear-gradient(180deg, #FF85A1 0%, #E05580 100%)',
  border: 'none', borderRadius: 14, cursor: 'pointer', userSelect: 'none',
  animation: 'spin-btn-pulse 1.1s ease-in-out infinite',
}
// Full-window theater overlay: sky stays visible but dimmed for focus.
export const theaterStyle = {
  position: 'fixed', inset: 0, zIndex: 120,
  background: 'rgba(24,10,34,0.42)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: 14, overflowY: 'auto',
}
export const winRowStyle = { display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Fredoka', cursive", fontSize: 15, color: '#3D2B4F' }
export const winPanelStyle = {
  width: '100%', background: 'rgba(255,245,253,0.96)',
  border: '2px solid #C8A0E0', borderRadius: 12, padding: '8px 12px',
  display: 'flex', flexDirection: 'column', gap: 4,
  animation: 'bounce-in 0.3s cubic-bezier(0.34,1.56,0.64,1)',
}
