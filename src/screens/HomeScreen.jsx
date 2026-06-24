import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useStore from '../store/useStore'
import { cashInGroupForBead } from '../engine/gameLogic'
import { BeadDisplay, KawaiiButton } from '../components/ui'
import { playBeadDraw } from '../engine/sounds'
import HabitChanSprite from '../components/HabitChanSprite'
import VisualNovel from '../components/VisualNovel'
import { REACTION_GOLD_BEAD } from '../content/habitChanScript'
// 3D physics jar (lazy: three.js/rapier only load once Home renders it)
const BeadJar3D = lazy(() => import('../components/BeadJar3D'))

const IDLE_LINES = [
  "Do the thing! 🌟",
  "Your streak is waiting ✨",
  "One habit at a time 💪",
  "You've got this! 🌸",
]
// Computed once at module load — changes per page reload (roughly daily). Using
// day+month avoids Date.now() which the react-hooks/purity rule flags in render.
const _d = new Date()
const DAILY_IDLE_LINE = IDLE_LINES[(_d.getDate() + _d.getMonth() * 31) % IDLE_LINES.length]

// ── utils ──
function darken(hex, amt = 20) {
  try {
    const n = parseInt(hex.replace('#', ''), 16)
    const r = Math.max(0, (n >> 16) - amt)
    const g = Math.max(0, ((n >> 8) & 0xff) - amt)
    const b = Math.max(0, (n & 0xff) - amt)
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  } catch { return '#888' }
}
function lighten(hex, amt = 24) {
  try {
    const n = parseInt(hex.replace('#', ''), 16)
    const r = Math.min(255, (n >> 16) + amt)
    const g = Math.min(255, ((n >> 8) & 0xff) + amt)
    const b = Math.min(255, (n & 0xff) + amt)
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  } catch { return hex }
}
// Readable text color for a given background (dark plum on light pastels, white on dark).
function textOn(hex) {
  try {
    const n = parseInt(hex.replace('#', ''), 16)
    const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)
    return lum > 158 ? '#5A2E4A' : '#FFFFFF'
  } catch { return '#5A2E4A' }
}
function hashSlot(key) {
  const s = String(key || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return (h % 6) + 1
}
// Measured pile height vs bead count (world units, jar glass spans y 0→1.93).
// From scripts/jar-capacity-test.mjs — REAL rapier sim at BEAD_R 0.086; the
// jar holds ~600 beads. Lines drawn from this curve sit exactly where the pile
// top physically is at that count, so "beads touch the line" === "count hit".
// In sync with scripts/bake-pile.mjs (the SAME baked pile BeadJar3D places), so
// a milestone line sits exactly where the static pile top is at that count.
const PILE_CURVE = [
  [0, 0.09], [25, 0.221], [50, 0.330], [75, 0.438], [100, 0.448], [125, 0.494],
  [150, 0.567], [175, 0.636], [200, 0.704], [225, 0.714], [250, 0.746],
  [275, 0.842], [300, 0.893], [325, 0.989], [350, 1.015], [375, 1.085],
  [400, 1.125], [425, 1.179], [450, 1.216], [475, 1.279], [500, 1.310],
  [525, 1.423], [550, 1.444], [575, 1.528], [600, 1.613],
]
function pileHeightAt(count) {
  const c = Math.max(0, Math.min(600, count))
  for (let i = 0; i < PILE_CURVE.length - 1; i++) {
    const [c0, y0] = PILE_CURVE[i], [c1, y1] = PILE_CURVE[i + 1]
    if (c >= c0 && c <= c1) return y0 + (y1 - y0) * ((c - c0) / (c1 - c0))
  }
  return PILE_CURVE[PILE_CURVE.length - 1][1]
}

// ── Jar (real-time 3D glass jar — every bead physically plunks in) ──
function TeapotJar({ jarBeads, milestones, getBeadColor, seenCount, onSeen }) {
  const W = 200, H = 291
  const JAR_PX = 225   // canvas width on screen
  // pixel band (in the 200x291 viewBox) the 3D glass occupies, for milestone
  // lines — MEASURED from a live screenshot (camera z=5.2, lookAt y=0.72):
  // glass top ≈ px 11, glass bottom ≈ px 243. (The analytic estimate was off
  // by ~15% — perspective; trust the measurement.)
  const jarX = 30, jarW = 140
  const jarY = 11, jarH = 232

  // {id, color, isGold, isRainbow} for the 3D jar — oldest→newest so new beads drop last
  const beads3d = useMemo(
    () => jarBeads.map(b => ({ id: b.id, color: getBeadColor(b.slot, b.isGold), isGold: b.isGold, isRainbow: b.isRainbow })),
    [jarBeads, getBeadColor]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '-8px 0 0' }}>
      <div style={{ position: 'relative', width: JAR_PX, height: JAR_PX * (H / W) }}>
        {/* transparent placeholder while three.js/rapier lazy-load — NOT the old
            painted jar.png (it flashed a different jar, then the beads re-poured) */}
        <Suspense fallback={null}>
          <BeadJar3D
            beads={beads3d}
            seenCount={seenCount}
            onSeen={onSeen}
            width={JAR_PX}
            height={JAR_PX * (H / W)}
          />
        </Suspense>

        {/* milestone lines + count overlay the canvas (it ignores pointer events) */}
        <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {milestones.map(m => {
            // line sits where the pile PHYSICALLY reaches at that bead count
            const lineY = jarY + jarH * (1 - pileHeightAt(m.beadCount) / 1.93)
            if (lineY < jarY || lineY > jarY + jarH) return null
            const isReached = jarBeads.length >= m.beadCount
            return (
              <g key={m.id}>
                <line x1={jarX} y1={lineY} x2={jarX + jarW} y2={lineY}
                  stroke={isReached ? '#5CBFA0' : '#9B7EC8'}
                  strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
                <rect x={jarX + jarW - 2} y={lineY - 9} width={80} height={18} rx={5}
                  fill={isReached ? '#B4E0C8' : '#F3EAFB'}
                  stroke={isReached ? '#5CBFA0' : '#9B7EC8'} strokeWidth={1} />
                <text x={jarX + jarW + 38} y={lineY + 1}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={12.5} fontFamily="'Fredoka', cursive"
                  fill={isReached ? '#1A5C3A' : '#3D2B4F'}>
                  {m.name.length > 12 ? m.name.slice(0, 12) + '…' : m.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      {/* count BELOW the jar, pulled up into the canvas's empty bottom strip
          (glass bottom ≈ 83.5% of the box, measured) — plain HTML in flow, so
          it can never collide with the glass, the pile, or the banner */}
      <div style={{
        marginTop: -50, position: 'relative', zIndex: 11, textAlign: 'center',
        fontFamily: "'Fredoka', cursive", fontSize: 21, color: '#9B7EC8',
      }}>
        {jarBeads.length} beads
      </div>
    </div>
  )
}

// ── Habit row: the card background IS the habit's category color ──
function HabitButton({ habit, color, onTap }) {
  const text = textOn(color)
  const soft = text === '#FFFFFF' ? 'rgba(255,255,255,0.88)' : 'rgba(90,46,74,0.78)'
  return (
    <button
      onClick={onTap}
      style={{
        width: '100%',
        minHeight: 40,
        background: `linear-gradient(180deg, ${lighten(color, 16)} 0%, ${color} 100%)`,
        border: `2px solid ${lighten(color, 38)}`,
        borderRadius: 15,
        boxShadow: `0 3px 0 ${darken(color, 34)}, 0 4px 10px ${color}66`,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '6px 16px',
        transition: 'transform 110ms ease, box-shadow 110ms ease',
        userSelect: 'none',
      }}
      onPointerDown={e => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = `0 1px 0 ${darken(color, 34)}, 0 2px 6px ${color}55` }}
      onPointerUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
      onPointerLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      <div style={{ minWidth: 0, textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Fredoka', cursive",
          fontSize: 17, color: text, lineHeight: 1.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textShadow: text === '#FFFFFF' ? '0 1px 2px rgba(0,0,0,0.25)' : '0 1px 0 rgba(255,255,255,0.45)',
        }}>
          {habit.name}
        </div>
        {habit.description && (
          <div style={{
            fontFamily: 'Mulish, sans-serif', fontSize: 11.5, color: soft, marginTop: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {habit.description}
          </div>
        )}
      </div>
    </button>
  )
}

// ── Bead reveal: the earned bead slow-drops to rest and STAYS, glowing, while
//    the decision prompt floats in ABOVE it — so you can admire the bead while
//    choosing what to do with it. Gold beads show their own message (always a
//    Tier 3 cash-in); regular beads offer cash-in (if matches) or keep+Tier 1. ──
function BeadReveal({ bead, wallet, getBeadColor, beadSlots, onCashIn, onKeep }) {
  const color = getBeadColor(bead.slot, bead.isGold)
  const glow = bead.isGold ? '#FFD700' : bead.isRainbow ? '#FF8AE0' : color
  const [landed, setLanded] = useState(false)
  const [flanked, setFlanked] = useState(false)
  // The cash-in group is built from THE EARNED bead (its slot + wilds), so the
  // beads shown here are exactly the ones that drop into the jar.
  const group = cashInGroupForBead(bead, wallet)
  const canCashTier = !bead.isGold && group.tier >= 2
  const tier = bead.isGold ? 3 : group.tier
  const beadName = beadSlots?.find(s => s.slot === bead.slot)?.name || 'Bead'

  // Regular bead with matches: the OTHER cash-in beads float up to flank the
  // earned one (which scoots to keep the row centred). Gold/rainbow stay solo.
  const matches = (!bead.isGold && !bead.isRainbow && canCashTier) ? group.beads.filter(b => b.id !== bead.id) : []
  const rowBeads = [...matches.slice(0, Math.floor(matches.length / 2)), bead, ...matches.slice(Math.floor(matches.length / 2))]
  const SPACING = 118   // > earned radius(57) + match radius(40) so they don't overlap

  function onEarnedLanded() {
    setLanded(true)
    if (matches.length) setTimeout(() => setFlanked(true), 280)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(40,28,54,0.62)', backdropFilter: 'blur(7px)',
    }}>
      {/* Decision panel — floats in above the bead once it lands. Auto-height
          (grows to fit its content) so the title can never clip the frame. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '30%',
        display: 'flex', justifyContent: 'center', padding: '0 22px',
        opacity: landed ? 1 : 0,
        transform: landed ? 'translateY(0)' : 'translateY(-16px)',
        transition: 'opacity 380ms ease, transform 420ms cubic-bezier(0.34,1.56,0.64,1)',
        pointerEvents: landed ? 'auto' : 'none',
      }}>
        <div style={{
          width: '100%', maxWidth: 320,
          background: 'linear-gradient(180deg, #FFF5FB 0%, #FBE6F4 100%)',
          border: '3px solid #F1B2D6', borderRadius: 26,
          boxShadow: bead.isGold
            ? '0 0 0 4px rgba(255,255,255,0.6), 0 0 32px rgba(255,215,0,0.5), 0 14px 32px rgba(155,126,200,0.4)'
            : bead.isRainbow
              ? '0 0 0 4px rgba(255,255,255,0.7), 0 0 22px rgba(255,120,210,0.45), 0 0 42px rgba(110,180,255,0.4), 0 14px 32px rgba(155,126,200,0.4)'
              : '0 0 0 4px rgba(255,255,255,0.6), 0 14px 32px rgba(155,126,200,0.4)',
          padding: '18px 20px 20px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
          textAlign: 'center',
        }}>
          {bead.isGold ? (
            <>
              <div style={{ fontSize: 26, lineHeight: 1 }}>✨</div>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 26, color: '#5C3A00', textShadow: '2px 2px 0 rgba(184,150,12,0.28)' }}>
                GOLD BEAD!
              </div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14.5, color: '#7B5EA7', lineHeight: 1.3 }}>
                The rare one — straight to a Level 3 spin! ⚡
              </div>
              <KawaiiButton variant="gold" size="md" fullWidth onClick={onCashIn}>
                💎 Cash In · LVL 3
              </KawaiiButton>
            </>
          ) : bead.isRainbow ? (
            <>
              <div style={{ fontSize: 26, lineHeight: 1 }}>🌈</div>
              <div style={{
                fontFamily: "'Fredoka', cursive", fontSize: 24, lineHeight: 1.05,
                background: 'linear-gradient(90deg, #FF5C5C, #FF9D3D, #FFD93D, #4DD97E, #3FAFFF, #8F6BFF, #F060D0)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 1px 2px rgba(120,90,160,0.35))',
              }}>
                RAINBOW BEAD!
              </div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#7B5EA7', lineHeight: 1.32 }}>
                Whoa — the <strong>beautiful gay rainbow bead</strong>! 🏳️‍🌈 The wild card: match it with <strong>ANY</strong> beads in your wallet to unlock higher tiers.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {canCashTier && (
                  <KawaiiButton variant="mint" size="md" fullWidth onClick={onCashIn}>
                    💎 Cash In · LVL {tier}
                  </KawaiiButton>
                )}
                <KawaiiButton variant={canCashTier ? 'secondary' : 'primary'} size="md" fullWidth onClick={onKeep}>
                  🎰 Keep · LVL 1
                </KawaiiButton>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 26, color: darken(color, 70) }}>
                ✨ {beadName} Bead!
              </div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#7B5EA7', lineHeight: 1.3 }}>
                {canCashTier
                  ? `Cash in your matching ${beadName} beads for a Level ${tier} spin — or keep them for Level 1.`
                  : 'Spin now at Level 1, or keep saving to match beads for higher levels!'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {canCashTier && (
                  <KawaiiButton variant="mint" size="md" fullWidth onClick={onCashIn}>
                    💎 Cash In · LVL {tier}
                  </KawaiiButton>
                )}
                <KawaiiButton variant={canCashTier ? 'secondary' : 'primary'} size="md" fullWidth onClick={onKeep}>
                  🎰 Keep · LVL 1
                </KawaiiButton>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bead row — the earned bead drops to centre; matching beads float up to
          flank it (flashing, to set them apart from the brand-new one) */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '70%' }}>
        {rowBeads.map((b, i) => {
          const isEarned = b.id === bead.id
          const slotX = matches.length ? (i - (rowBeads.length - 1) / 2) * SPACING : 0
          if (isEarned) {
            return (
              <div key={b.id} style={{
                position: 'absolute', left: '50%', top: 0,
                transform: `translate(-50%,-50%) translateX(${flanked ? slotX : 0}px)`,
                transition: 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)',
              }}>
                <div style={{ animation: 'beadReveal 1.5s cubic-bezier(0.5,0.05,0.3,1) forwards' }}
                  onAnimationEnd={onEarnedLanded}>
                  <div style={{ position: 'relative', width: 114, height: 114, display: 'grid', placeItems: 'center' }}>
                    {bead.isRainbow ? (
                      <div style={{
                        position: 'absolute', width: '198%', height: '198%', borderRadius: '50%',
                        background: 'conic-gradient(from 0deg, #FF5C5C, #FF9D3D, #FFD93D, #4DD97E, #3FAFFF, #8F6BFF, #F060D0, #FF5C5C)',
                        filter: 'blur(13px)', opacity: 0.6,
                        animation: 'revealSpin 6s linear infinite', pointerEvents: 'none',
                      }} />
                    ) : (
                      <div style={{
                        position: 'absolute', width: '185%', height: '185%', borderRadius: '50%',
                        background: `radial-gradient(circle, ${glow}99 0%, ${glow}33 38%, transparent 68%)`,
                        animation: 'revealHalo 2.2s ease-in-out infinite', pointerEvents: 'none',
                      }} />
                    )}
                    <BeadDisplay color={color} slot={bead.slot} isGold={bead.isGold}
                      style={{ width: 114, height: 114, boxShadow: `0 0 26px ${glow}, 0 0 60px ${glow}88` }} />
                  </div>
                </div>
              </div>
            )
          }
          // matching bead — floats up from below into its slot, flashing
          const bColor = getBeadColor(b.slot, b.isGold)
          const bGlow = b.isGold ? '#FFD700' : b.isRainbow ? '#FF8AE0' : bColor
          const stagger = (i < rowBeads.length / 2 ? i : rowBeads.length - 1 - i) * 0.08
          return (
            <div key={b.id} style={{
              position: 'absolute', left: '50%', top: 0,
              transform: `translate(-50%,-50%) translateX(${slotX}px) translateY(${flanked ? 0 : 190}px)`,
              opacity: flanked ? 1 : 0,
              transition: `transform 0.6s cubic-bezier(0.34,1.56,0.64,1) ${stagger}s, opacity 0.45s ease ${stagger}s`,
            }}>
              <div style={{ position: 'relative', width: 80, height: 80, display: 'grid', placeItems: 'center', animation: 'matchPulse 0.95s ease-in-out infinite' }}>
                <div style={{
                  position: 'absolute', width: '158%', height: '158%', borderRadius: '50%',
                  background: `radial-gradient(circle, ${bGlow} 0%, transparent 62%)`,
                  animation: 'matchGlow 0.95s ease-in-out infinite', pointerEvents: 'none',
                }} />
                <BeadDisplay color={bColor} slot={b.slot} isGold={b.isGold}
                  style={{ width: 80, height: 80, boxShadow: `0 0 14px ${bGlow}` }} />
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes beadReveal {
          0%   { transform: translateY(-440px) scale(0.45); opacity: 0; }
          16%  { transform: translateY(-372px) scale(1.12); opacity: 1; }
          72%  { transform: translateY(20px)  scale(1.05); }
          88%  { transform: translateY(-7px)  scale(0.99); }
          100% { transform: translateY(0)     scale(1);    opacity: 1; }
        }
        @keyframes revealHalo {
          0%, 100% { opacity: 0.55; transform: scale(0.92); }
          50%      { opacity: 0.9;  transform: scale(1.06); }
        }
        @keyframes revealSpin { to { transform: rotate(360deg); } }
        @keyframes matchPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.09); } }
        @keyframes matchGlow  { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.85; } }
      `}</style>
    </div>
  )
}

// ── Wallet tray: rounded "beads ready to spin" card pinned above the nav ──
function WalletStrip({ wallet, getBeadColor, onOpenWallet }) {
  if (!wallet.length) return null
  return (
    <div style={{ flexShrink: 0, position: 'relative', zIndex: 12, padding: '6px 16px 10px' }}>
      <button
        onClick={onOpenWallet}
        style={{
          width: '100%', maxWidth: 440, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'linear-gradient(180deg, #FFF8FC 0%, #F7E7F4 100%)',
          border: '2.5px solid #ECC0DE',
          borderRadius: 18,
          boxShadow: '0 4px 0 #DBA9CD, 0 6px 14px rgba(180,120,160,0.25)',
          padding: '9px 14px',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontFamily: "'Fredoka', cursive", fontSize: 17, color: '#9B3D6B', flexShrink: 0 }}>
          👜 {wallet.length} ready
        </span>
        <div style={{ display: 'flex', gap: 4, flex: 1, overflow: 'hidden', justifyContent: 'flex-end', minWidth: 0 }}>
          {wallet.slice(-10).map(b => (
            <BeadDisplay key={b.id} color={getBeadColor(b.slot, b.isGold)} slot={b.slot} isGold={b.isGold} size="sm" />
          ))}
        </div>
        <span style={{ fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#C77FB0', flexShrink: 0 }}>›</span>
      </button>
    </div>
  )
}

// ── Main Screen ──
export default function HomeScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    habits, categories, wallet, jarBeads, milestones, settings,
    drawBead, cashInBeads, getBeadColor, setSession,
    jarSeenCount, markJarSeen,
  } = useStore()

  const [reveal, setReveal] = useState(null)         // the earned bead being revealed
  const [showGoldToast, setShowGoldToast] = useState(false)
  const earnedGoldRef = useRef(false)

  useEffect(() => {
    if (location.state?.freeBead && !reveal) {
      const fb = location.state.freeBead
      playBeadDraw(fb.isGold ? 'gold' : fb.isRainbow ? 'rainbow' : null)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot handoff: consume the nav-state bead, then scrub history so refresh can't re-reveal it
      setReveal(fb)
      window.history.replaceState({}, document.title)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: nav-state is consumed exactly once
  }, [])

  // Each habit's card color = its CATEGORY color (falls back to its bead-slot color)
  const habitColor = useMemo(() => {
    const map = {}
    for (const h of habits) {
      const cat = categories.find(c => c.id === h.categoryId)
      if (cat?.color) { map[h.id] = cat.color; continue }
      const slot = h.beadSlot || hashSlot(h.categoryId || h.id)
      const found = settings.beadSlots.find(s => s.slot === slot)
      map[h.id] = found ? found.color : '#C8B4E0'
    }
    return map
  }, [habits, categories, settings.beadSlots])

  function handleHabitTap(habit) {
    if (reveal) return
    const bead = drawBead(habit.id)
    playBeadDraw(bead.isGold ? 'gold' : bead.isRainbow ? 'rainbow' : null)
    setSession({ selectedHabit: habit })
    setReveal(bead)
    earnedGoldRef.current = bead.isGold
  }

  function _triggerGoldToast() {
    if (earnedGoldRef.current) { earnedGoldRef.current = false; setShowGoldToast(true) }
  }

  // Cash in the EARNED bead's group (its slot + wilds): move them wallet→jar,
  // then off to the cash-in screen where each pops and its 3D marble drops in.
  function handleRevealCashIn() {
    const group = cashInGroupForBead(reveal, wallet)
    setReveal(null)
    _triggerGoldToast()
    if (group.beads.length) cashInBeads(group.beads)   // sets cashedBeads + activeTier + phase 'cashIn'
    navigate('/cash-in')
  }

  // Keep the beads in your wallet and just play Tier 1 — nothing enters the jar.
  // Set phase too: Keep ALWAYS earns a Tier 1 spin, so it must guarantee a valid
  // spin entry. (A BONUS bead reaches here after BonusScreen's resetSession(),
  // which clears the 'habitDone' phase drawBead normally sets — without this the
  // spin guard bounced you home.)
  function handleRevealKeep() {
    setReveal(null)
    _triggerGoldToast()
    setSession({ activeTier: 1, phase: 'habitDone' })
    navigate('/spin')
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Pinned header: jar + tap-a-habit (never scrolls). The title logo lives
          on the launch splash now (LaunchSplash), freeing this space for the jar
          and the tap-a-habit banner. ── */}
      <div style={{ flexShrink: 0, position: 'relative', zIndex: 10, padding: '12px 16px 2px' }}>
        <TeapotJar jarBeads={jarBeads} milestones={milestones} getBeadColor={getBeadColor}
          seenCount={jarSeenCount} onSeen={markJarSeen} />
        <img
          src="/ui/tap_banner.png?v=2"
          alt="Tap a habit to earn a bead, silly!"
          style={{ display: 'block', width: '94%', maxWidth: 410, height: 'auto', margin: '2px auto 0' }}
        />
      </div>

      {/* ── Scrolling habit list ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative', zIndex: 10, padding: '8px 16px 14px' }}>
        {habits.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 440, width: '100%', margin: '0 auto' }}>
            {habits.map(habit => (
              <HabitButton
                key={habit.id}
                habit={habit}
                color={habitColor[habit.id]}
                onTap={() => handleHabitTap(habit)}
              />
            ))}
          </div>
        )}

        {/* Idle Habit-Chan sprite when there are few (or no) habits */}
        {habits.length <= 3 && !reveal && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: habits.length === 0 ? 6 : 18 }}>
            <div style={{ animation: 'float-slow 3.5s ease-in-out infinite' }}>
              <HabitChanSprite pose="sitting" charPx={160} bounce={false} />
            </div>
            <div style={{
              background: '#FFF5F9', border: '2px solid #ECC0DE', borderRadius: 16,
              padding: '7px 14px', maxWidth: 220,
              fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#7B5EA7',
              textAlign: 'center', lineHeight: 1.4,
              boxShadow: '0 2px 0 #DBA9CD', marginTop: -8,
            }}>
              {DAILY_IDLE_LINE}
            </div>
            {habits.length === 0 && (
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 16, color: '#FF85A1', marginTop: 8, textAlign: 'center' }}>
                Add your first habit ↑
              </div>
            )}
          </div>
        )}
      </div>

      {showGoldToast && (
        <VisualNovel
          script={REACTION_GOLD_BEAD}
          onComplete={() => setShowGoldToast(false)}
          onSkip={() => setShowGoldToast(false)}
        />
      )}

      {reveal && (
        <BeadReveal
          bead={reveal}
          wallet={wallet}
          getBeadColor={getBeadColor}
          beadSlots={settings.beadSlots}
          onCashIn={handleRevealCashIn}
          onKeep={handleRevealKeep}
        />
      )}

      <WalletStrip
        wallet={wallet}
        getBeadColor={getBeadColor}
        onOpenWallet={() => navigate('/wallet')}
      />

    </div>
  )
}
