import { useEffect, useMemo, useRef } from 'react'
import BeadDisplay from './ui/BeadDisplay'

// The wallet beads, orbiting the jar instead of sitting in a bar. Beads are
// grouped by color; each color-cluster orbits the jar slowly while its own beads
// circle one another (a little epicycle), so you can see at a glance what you've
// got. Tap any bead to open the full wallet. Positions are driven by rAF so the
// beads stay upright (we only translate them, never rotate the art).
const BEAD = 26            // px — small, so the rest of the home UI keeps its room
const MAX_PER_GROUP = 6    // cap a color-cluster; overflow shows a "+N" chip
const SPEED_BIG = 0.16     // rad/s — slow trip around the jar
const SPEED_SMALL = 0.7    // rad/s — beads circling within a color cluster
// Orbit hugs the glass silhouette: centered on the glass (a touch above the box
// center) with radii just outside the jar, as fractions of the jar box.
const RX_FRAC = 0.435
const RY_FRAC = 0.385
const CY_FRAC = 0.41       // orbit center y (glass center sits above box center)
const CLUSTER_R = 13       // how far apart same-color beads sit while circling

export default function OrbitingWallet({ wallet, getBeadColor, onOpen }) {
  const containerRef = useRef(null)
  const nodeRefs = useRef(new Map())   // item key → DOM node
  const layoutRef = useRef(null)       // live layout the rAF reads each frame

  // Group beads by color (gold is its own group).
  const groups = useMemo(() => {
    const map = new Map()
    for (const b of wallet) {
      const key = b.isGold ? 'gold' : `s${b.slot}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(b)
    }
    return [...map.values()]
  }, [wallet])

  // Flatten to render items, capping each cluster and adding a "+N" chip if over.
  const { items, counts } = useMemo(() => {
    const out = []
    const cnt = {}
    groups.forEach((beads, gi) => {
      const show = beads.length <= MAX_PER_GROUP ? beads : beads.slice(0, MAX_PER_GROUP - 1)
      show.forEach((b, bi) => out.push({ key: b.id, bead: b, gi, bi }))
      if (beads.length > MAX_PER_GROUP) out.push({ key: `more-${gi}`, chip: beads.length - (MAX_PER_GROUP - 1), gi, bi: show.length })
      cnt[gi] = out.filter(o => o.gi === gi).length
    })
    return { items: out, counts: cnt }
  }, [groups])

  // keep the live layout fresh for the animation loop (updated off-render)
  useEffect(() => {
    layoutRef.current = { items, counts, G: groups.length || 1 }
  }, [items, counts, groups.length])

  useEffect(() => {
    let raf
    const frame = (t) => {
      const c = containerRef.current
      const layout = layoutRef.current
      if (c && layout) {
        const w = c.clientWidth, h = c.clientHeight
        const cx = w / 2, cy = h * CY_FRAC
        const Rx = Math.max(36, w * RX_FRAC), Ry = Math.max(36, h * RY_FRAC)
        const sec = t / 1000
        const { items, counts, G } = layout
        for (const it of items) {
          const el = nodeRefs.current.get(it.key)
          if (!el) continue
          const n = counts[it.gi] || 1
          const big = (it.gi / G) * Math.PI * 2 + sec * SPEED_BIG
          const gx = cx + Rx * Math.cos(big)
          const gy = cy + Ry * Math.sin(big)
          const small = (it.bi / n) * Math.PI * 2 + sec * SPEED_SMALL
          const sr = n > 1 ? CLUSTER_R : 0
          const x = gx + sr * Math.cos(small) - BEAD / 2
          const y = gy + sr * Math.sin(small) - BEAD / 2
          el.style.transform = `translate(${x}px, ${y}px)`
        }
        c.style.opacity = '1'   // reveal once everything's been positioned
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!wallet.length) return null

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 6, opacity: 0, transition: 'opacity 300ms ease' }}>
      {items.map(it => (
        <div
          key={it.key}
          ref={el => { if (el) nodeRefs.current.set(it.key, el); else nodeRefs.current.delete(it.key) }}
          style={{ position: 'absolute', left: 0, top: 0, willChange: 'transform', pointerEvents: 'auto' }}
        >
          {it.chip ? (
            <button onClick={onOpen} aria-label={`${it.chip} more beads — open wallet`} style={chipStyle}>+{it.chip}</button>
          ) : (
            <button onClick={onOpen} aria-label="Open bead wallet" style={beadBtn}>
              <BeadDisplay color={getBeadColor(it.bead.slot, it.bead.isGold)} slot={it.bead.slot} isGold={it.bead.isGold}
                style={{ width: BEAD, height: BEAD }} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

const beadBtn = { background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'block', lineHeight: 0 }
const chipStyle = {
  width: BEAD, height: BEAD, borderRadius: '50%', cursor: 'pointer',
  background: 'rgba(255,245,251,0.95)', border: '2px solid #ECC0DE', color: '#9B3D6B',
  fontFamily: "'Fredoka', cursive", fontSize: 12, lineHeight: 1, padding: 0,
  boxShadow: '0 2px 6px rgba(155,126,200,0.3)',
}
