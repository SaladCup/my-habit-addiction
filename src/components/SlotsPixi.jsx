// Premium PixiJS (WebGL) slot machine — ornate cabinet, real vertical-scrolling reels with
// motion blur + staggered easing stops + overshoot bounce, and a win celebration (center-row
// glow pulse, symbol pulse, coin shower). Renders live in the browser (Pixi inits its first
// frame even in a hidden tab, unlike R3F).
//
// Symbols are emoji PLACEHOLDERS for now (rendered as pixiText). When Lauren's kawaii PNGs land
// in /public/casino/symbols/<name>.png, swap the pixiText for a pixiSprite — see SYMBOL_ART below.
import { useRef, useEffect, useMemo } from 'react'
import { Application, extend, useTick } from '@pixi/react'
import { Container, Graphics, Text } from 'pixi.js'
import { BlurFilter } from 'pixi.js'
import { SLOT_SYMBOLS } from '../engine/casino/slots'

extend({ Container, Graphics, Text })

const W = 360, H = 300
const N = SLOT_SYMBOLS.length
const REELS = 3
const ROWS = 3                 // visible rows per reel
const CELL = 74                // symbol cell size
const REEL_W = 88, REEL_GAP = 8
const REELS_W = REELS * REEL_W + (REELS - 1) * REEL_GAP
const MARQUEE_H = 40           // top cabinet bar (title)
const TRAY_H = 26              // bottom cabinet bar
const WIN_TOP = MARQUEE_H + 8                 // reel window top
const WIN_H = ROWS * CELL                      // reel window height
const WIN_BOTTOM = WIN_TOP + WIN_H
const REELS_X0 = (W - REELS_W) / 2
const CENTER_Y = WIN_TOP + WIN_H / 2

const LEN = 18                 // length of each reel's symbol strip
const STOP_MS = [820, 1080, 1380]   // staggered reel-stop times
const SETTLE_MS = STOP_MS[2] + 120

const reelX = i => REELS_X0 + i * (REEL_W + REEL_GAP) + REEL_W / 2
const symOf = k => SLOT_SYMBOLS[((k % N) + N) % N].e

// gentle ease-out with a small overshoot, so reels "snap" and bounce back
function easeOutBack(p) {
  const c1 = 1.70158 * 0.55, c3 = c1 + 1
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2)
}

function Scene({ reels, spinId, win3, onSettled }) {
  // 5 symbol text-nodes per reel (center ±2) — stable ref objects, mutated imperatively in the
  // ticker to avoid React churn. useMemo (not useRef) so the JSX never reads `.current` in render.
  const cellNodes = useMemo(() => Array.from({ length: REELS }, () => Array.from({ length: 5 }, () => ({ current: null }))), [])
  const blurFilters = useMemo(() => Array.from({ length: REELS }, () => new BlurFilter({ strength: 0, quality: 2 })), [])
  const highlight = useRef(null)
  const coins = useRef([])           // {x,y,vx,vy,rot,vr,life}
  const coinG = useRef(null)
  // per-reel strips + animation state
  const seq = useRef(Array.from({ length: REELS }, (_, i) =>
    Array.from({ length: LEN }, (_, k) => (k * 7 + i * 3) % N)))   // pseudo-random fixed strip
  const reelState = useRef(Array.from({ length: REELS }, () => ({ pos: 6, start: 6, final: 6, dur: 1, prev: 6 })))
  const spin = useRef({ active: false, t: 0, winT: -1 })

  // rest state: make sure the center cell shows each result symbol
  useEffect(() => {
    if (spin.current.active) return
    reelState.current.forEach((r, i) => { seq.current[i][Math.round(r.pos) % LEN] = reels[i] })
  }, [reels])

  // (re)start a spin when spinId changes
  useEffect(() => {
    if (!spinId) return
    const sp = spin.current
    sp.active = true; sp.t = 0; sp.winT = -1
    coins.current = []
    reelState.current.forEach((r, i) => {
      r.start = r.pos
      const turns = 10 + i * 4                    // more turns on later reels
      r.final = Math.ceil(r.start) + turns
      r.dur = STOP_MS[i]
      r.prev = r.start
      seq.current[i][((r.final % LEN) + LEN) % LEN] = reels[i]   // land on the result
    })
  }, [spinId])   // eslint-disable-line react-hooks/exhaustive-deps

  useTick((ticker) => {
    const sp = spin.current
    const dt = ticker.deltaMS

    if (sp.active) {
      sp.t += dt
      let allDone = true
      reelState.current.forEach((r) => {
        if (sp.t < r.dur) {
          allDone = false
          const p = sp.t / r.dur
          r.pos = r.start + (r.final - r.start) * easeOutBack(p)
        } else {
          r.pos = r.final
        }
      })
      if (allDone && sp.t >= SETTLE_MS) {
        sp.active = false
        sp.winT = win3 ? 0 : -1   // ≥0 kicks off the win celebration; <0 = no win
        onSettled?.()
      }
    }

    // render reels (position + symbol of each visible cell) + motion blur.
    // Blur is DETERMINISTIC from each reel's own spin progress (strong early, eases to 0 exactly
    // when that reel stops) — never velocity-based, so it can't get stuck mid-blur.
    reelState.current.forEach((r, i) => {
      const spinning = sp.active && sp.t < r.dur
      blurFilters[i].strength = spinning ? 4 + 12 * (1 - sp.t / r.dur) : 0
      const base = Math.floor(r.pos)
      const frac = r.pos - base
      for (let s = 0; s < 5; s++) {
        const node = cellNodes[i][s].current
        if (!node) continue
        const row = s - 2                                   // -2..+2 around center
        node.y = CENTER_Y + row * CELL - frac * CELL
        node.text = symOf(base + row)
        // pulse the center symbols on a win
        const isCenter = Math.abs(node.y - CENTER_Y) < CELL * 0.4
        const pulse = sp.winT >= 0 && isCenter ? 1 + 0.12 * Math.sin(sp.winT / 90) : 1
        node.scale.set(pulse)
      }
    })
    // hard guarantee: zero all blur whenever nothing is spinning (belt-and-suspenders)
    if (!sp.active) for (let i = 0; i < REELS; i++) blurFilters[i].strength = 0

    // win celebration: center-row glow + coin shower
    if (sp.winT >= 0) {
      sp.winT += dt
      if (highlight.current) highlight.current.alpha = 0.35 + 0.35 * Math.abs(Math.sin(sp.winT / 160))
      if (sp.winT < 1400 && coins.current.length < 26 && Math.floor(sp.winT / 55) > coins.current.length - 1) {
        coins.current.push({
          x: 40 + ((coins.current.length * 53) % (W - 80)),
          y: -10, vx: (((coins.current.length * 37) % 20) - 10) * 0.04,
          vy: 1.4 + ((coins.current.length * 13) % 10) * 0.12, rot: 0,
          vr: 0.1 + ((coins.current.length % 5) * 0.03), life: 0,
        })
      }
      coins.current.forEach(c => { c.vy += 0.05; c.x += c.vx * dt; c.y += c.vy * dt * 0.06; c.rot += c.vr; c.life += dt })
      coins.current = coins.current.filter(c => c.y < H + 20 && c.life < 2600)
    } else if (highlight.current) {
      highlight.current.alpha = 0
    }
    if (coinG.current) {
      const g = coinG.current; g.clear()
      coins.current.forEach(c => {
        const w = Math.abs(Math.cos(c.rot)) * 9 + 2      // fake 3D coin spin (width oscillates)
        g.ellipse(c.x, c.y, w, 10).fill(0xF4C542).stroke({ width: 1.5, color: 0xB8860B })
        g.ellipse(c.x, c.y, w * 0.55, 6).fill(0xFCE08A)
      })
    }
  })

  return (
    <pixiContainer>
      {/* cabinet body + soft outer shadow */}
      <pixiGraphics draw={g => {
        g.clear()
        g.roundRect(6, 8, W - 12, H - 10, 26).fill({ color: 0x2a1c3f, alpha: 0.25 })   // shadow
        g.roundRect(3, 3, W - 6, H - 6, 24).fill(0x6E4FA0)                               // cabinet
        g.roundRect(9, 9, W - 18, H - 18, 20).fill(0x4A3270)                             // inner panel
      }} />

      {/* reel wells (dark) */}
      <pixiGraphics draw={g => {
        g.clear()
        for (let i = 0; i < REELS; i++) {
          g.roundRect(reelX(i) - REEL_W / 2, WIN_TOP, REEL_W, WIN_H, 12).fill(0x1F1630)
        }
      }} />

      {/* win center-row highlight (behind symbols) */}
      <pixiGraphics ref={highlight} draw={g => {
        g.clear()
        g.roundRect(REELS_X0 - 6, CENTER_Y - CELL / 2, REELS_W + 12, CELL, 12)
          .fill({ color: 0xFFE27A, alpha: 1 })
      }} alpha={0} />

      {/* reel symbols (emoji placeholders) */}
      {Array.from({ length: REELS }).map((_, i) => (
        <pixiContainer key={i} filters={[blurFilters[i]]}>
          {Array.from({ length: 5 }).map((_, s) => (
            <pixiText
              key={s}
              ref={cellNodes[i][s]}
              text={symOf(reels[i])}
              anchor={0.5}
              x={reelX(i)}
              y={CENTER_Y + (s - 2) * CELL}
              style={{ fontSize: 50 }}
            />
          ))}
        </pixiContainer>
      ))}

      {/* cabinet face overlay — opaque bars hide reel overflow above/below the window */}
      <pixiGraphics draw={g => {
        g.clear()
        // top (marquee) + bottom (tray), drawn over the reels
        g.roundRect(9, 9, W - 18, MARQUEE_H, 16).fill(0x7B57B0)
        g.rect(9, MARQUEE_H + 1, W - 18, WIN_TOP - MARQUEE_H).fill(0x4A3270)
        g.rect(9, WIN_BOTTOM, W - 18, H - 18 - WIN_BOTTOM + 9).fill(0x4A3270)
        g.roundRect(9, H - 9 - TRAY_H, W - 18, TRAY_H, 14).fill(0x3A2658)
      }} />

      {/* gold frames + reel separators (on top) */}
      <pixiGraphics draw={g => {
        g.clear()
        g.roundRect(3, 3, W - 6, H - 6, 24).stroke({ width: 4, color: 0xE7B43B })       // outer
        g.roundRect(REELS_X0 - 5, WIN_TOP - 5, REELS_W + 10, WIN_H + 10, 14)
          .stroke({ width: 4, color: win3 ? 0xFFD54A : 0xC9A23A })                       // window
        for (let i = 0; i < REELS; i++) {
          g.roundRect(reelX(i) - REEL_W / 2, WIN_TOP, REEL_W, WIN_H, 12).stroke({ width: 2, color: 0x2A1C3F })
        }
      }} />

      {/* marquee title */}
      <pixiText text="✦ LUCKY SLOTS ✦" anchor={0.5} x={W / 2} y={9 + MARQUEE_H / 2}
        style={{ fontSize: 17, fontWeight: '700', fill: 0xFFE9A8, fontFamily: 'Fredoka, sans-serif' }} />

      {/* coin shower (top of everything) */}
      <pixiGraphics ref={coinG} />
    </pixiContainer>
  )
}

export default function SlotsPixi({ reels = [0, 1, 2], spinId = 0, win3 = false, onSettled }) {
  return (
    <Application width={W} height={H} backgroundAlpha={0} antialias>
      <Scene reels={reels} spinId={spinId} win3={win3} onSettled={onSettled} />
    </Application>
  )
}
