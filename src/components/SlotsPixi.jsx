// PixiJS (WebGL) slot machine embedded in React via @pixi/react v8. The result symbols
// render statically (so they're verifiable); the cycling spin runs on the Pixi ticker
// (live only — like any rAF animation). Symbol text is mutated imperatively in useTick
// so spinning doesn't thrash React state.
import { useRef, useEffect } from 'react'
import { Application, extend, useTick } from '@pixi/react'
import { Container, Graphics, Text } from 'pixi.js'
import { SLOT_SYMBOLS } from '../engine/casino/slots'

extend({ Container, Graphics, Text })

const W = 330, H = 200, N = SLOT_SYMBOLS.length
const REEL_W = 90, REEL_H = 154, REEL_GAP = 10
const REEL_X = i => W / 2 + (i - 1) * (REEL_W + REEL_GAP)
const STOP_MS = [800, 1150, 1500]   // staggered reel stops
const CYCLE_MS = 70                  // symbol change cadence while spinning
const symOf = k => SLOT_SYMBOLS[((k % N) + N) % N].e

function Scene({ reels, spinId, win3 }) {
  const t0 = useRef(null), t1 = useRef(null), t2 = useRef(null)
  const refs = [t0, t1, t2]
  const st = useRef({ id: 0, t: 0 })
  useEffect(() => { st.current = { id: spinId, t: 0 } }, [spinId])   // (re)start on a new spin

  useTick((ticker) => {
    const s = st.current
    if (!s.id || s.t > STOP_MS[2] + 80) {
      refs.forEach((r, i) => { if (r.current) r.current.text = symOf(reels[i]) })   // hold the result
      return
    }
    s.t += ticker.deltaMS
    const step = Math.floor(s.t / CYCLE_MS)
    refs.forEach((r, i) => {
      if (!r.current) return
      r.current.text = s.t < STOP_MS[i] ? symOf(step + i * 2) : symOf(reels[i])
    })
  })

  return (
    <pixiContainer>
      <pixiGraphics draw={g => {
        g.clear()
        g.roundRect(3, 3, W - 6, H - 6, 18).fill(0x3d2b4f).stroke({ width: 5, color: win3 ? 0xf2c94c : 0xe0a800 })
      }} />
      {[0, 1, 2].map(i => (
        <pixiContainer key={i} x={REEL_X(i)} y={H / 2}>
          <pixiGraphics draw={g => {
            g.clear()
            g.roundRect(-REEL_W / 2, -REEL_H / 2, REEL_W, REEL_H, 12).fill(0xfff8fc)
            if (win3) g.roundRect(-REEL_W / 2, -REEL_H / 2, REEL_W, REEL_H, 12).stroke({ width: 4, color: 0xf2c94c })
          }} />
          <pixiText ref={refs[i]} text={symOf(reels[i])} anchor={0.5} style={{ fontSize: 60 }} />
        </pixiContainer>
      ))}
    </pixiContainer>
  )
}

export default function SlotsPixi({ reels = [0, 1, 2], spinId = 0, win3 = false }) {
  return (
    <Application width={W} height={H} backgroundAlpha={0} antialias>
      <Scene reels={reels} spinId={spinId} win3={win3} />
    </Application>
  )
}
