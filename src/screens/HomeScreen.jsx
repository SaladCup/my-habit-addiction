import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useStore, { KAWAII_COLORS } from '../store/useStore'
import { isCashable } from '../engine/gameLogic'
import { FloatingDecor, BeadDisplay, KawaiiButton } from '../components/ui'
import { playBeadDraw } from '../engine/sounds'
// 3D physics jar (lazy: three.js/rapier only load once Home renders it)
const BeadJar3D = lazy(() => import('../components/BeadJar3D'))

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
const PILE_CURVE = [
  [0, 0.09], [25, 0.221], [50, 0.357], [75, 0.434], [100, 0.489], [125, 0.529],
  [150, 0.622], [175, 0.700], [200, 0.710], [225, 0.756], [250, 0.848],
  [275, 0.877], [300, 0.986], [325, 1.004], [350, 1.031], [375, 1.125],
  [400, 1.161], [425, 1.261], [450, 1.299], [475, 1.316], [500, 1.391],
  [525, 1.477], [550, 1.505], [575, 1.542], [600, 1.612],
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
function TeapotJar({ jarBeads, milestones, getBeadColor }) {
  const W = 200, H = 291
  const JAR_PX = 225   // canvas width on screen
  // pixel band (in the 200x291 viewBox) the 3D glass occupies, for milestone
  // lines — calibrated to the camera (z=5.2): glass top (y=1.93) ≈ px 40,
  // glass bottom (y=0) ≈ px 240
  const jarX = 30, jarW = 140
  const jarY = 40, jarH = 200

  // {id, color, isGold, isRainbow} for the 3D jar — oldest→newest so new beads drop last
  const beads3d = useMemo(
    () => jarBeads.map(b => ({ id: b.id, color: getBeadColor(b.slot, b.isGold), isGold: b.isGold, isRainbow: b.isRainbow })),
    [jarBeads, getBeadColor]
  )

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '-28px 0 0' }}>
      <div style={{ position: 'relative', width: JAR_PX, height: JAR_PX * (H / W) }}>
        {/* the PNG jar holds the spot while three.js/rapier lazy-load */}
        <Suspense fallback={
          <img src="/ui/jar.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        }>
          <BeadJar3D beads={beads3d} width={JAR_PX} height={JAR_PX * (H / W)} />
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
          <text x={W / 2} y={jarY + jarH + 16} textAnchor="middle"
            fontSize={22} fontFamily="'Fredoka', cursive" fill="#9B7EC8">
            {jarBeads.length} beads
          </text>
        </svg>
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
        minHeight: 58,
        background: `linear-gradient(180deg, ${lighten(color, 16)} 0%, ${color} 100%)`,
        border: `2.5px solid ${lighten(color, 38)}`,
        borderRadius: 20,
        boxShadow: `0 4px 0 ${darken(color, 34)}, 0 6px 14px ${color}66`,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px 18px',
        transition: 'transform 110ms ease, box-shadow 110ms ease',
        userSelect: 'none',
      }}
      onPointerDown={e => { e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = `0 1px 0 ${darken(color, 34)}, 0 3px 8px ${color}55` }}
      onPointerUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
      onPointerLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      <div style={{ minWidth: 0, textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Fredoka', cursive",
          fontSize: 21, color: text, lineHeight: 1.15,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textShadow: text === '#FFFFFF' ? '0 1px 2px rgba(0,0,0,0.25)' : '0 1px 0 rgba(255,255,255,0.45)',
        }}>
          {habit.name}
        </div>
        {habit.description && (
          <div style={{
            fontFamily: 'Mulish, sans-serif', fontSize: 13, color: soft, marginTop: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {habit.description}
          </div>
        )}
      </div>
    </button>
  )
}

// ── Bead drop animation: bead falls toward the jar ──
function BeadDropAnim({ bead, getBeadColor, onDone }) {
  const color = getBeadColor(bead.slot, bead.isGold)
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200,
      display: 'flex', justifyContent: 'center',
    }}>
      <div
        style={{
          position: 'absolute', top: '20%',
          animation: 'beadFall 0.9s cubic-bezier(0.55, 0.1, 0.75, 0.95) forwards',
        }}
        onAnimationEnd={onDone}
      >
        <BeadDisplay color={color} slot={bead.slot} isGold={bead.isGold} size="xl" animate={bead.isGold} />
      </div>
      <style>{`
        @keyframes beadFall {
          0%   { transform: translateY(-80px) scale(0.5) rotate(0deg);   opacity: 0; }
          15%  { transform: translateY(-40px) scale(1.15) rotate(20deg); opacity: 1; }
          60%  { transform: translateY(120px) scale(1) rotate(-15deg);   opacity: 1; }
          85%  { transform: translateY(220px) scale(1.05) rotate(8deg);  opacity: 1; }
          100% { transform: translateY(260px) scale(0.6) rotate(0deg);   opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── Cash-in vs save-for-later prompt (framed: frame_popup) ──
function CashPrompt({ drawnBead, wallet, getBeadColor, onCashIn, onSpinTier1 }) {
  const cashable = isCashable(wallet)
  const color = getBeadColor(drawnBead.slot, drawnBead.isGold)
  const best = cashable.bestOption

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(61,43,79,0.5)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 360,
        aspectRatio: '600 / 900',
        background: "url('/ui/frame_popup.png') center / 100% 100% no-repeat",
        filter: 'drop-shadow(0 12px 30px rgba(155,126,200,0.4))',
        animation: 'bounce-in 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          padding: '16% 14% 13%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
          textAlign: 'center', overflowY: 'auto',
        }}>
          <BeadDisplay color={color} slot={drawnBead.slot} isGold={drawnBead.isGold} size="xl" animate={drawnBead.isGold} />

          <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 26, color: '#9B3D6B' }}>
            🌸 BEAD EARNED!
          </div>
          <div style={{
            fontFamily: 'Mulish, sans-serif', fontSize: 16, color: '#7B5EA7', lineHeight: 1.3,
          }}>
            {best && best.tier >= 2
              ? `Cash in matching beads for a Tier ${best.tier} spin — or keep them and play at Tier 1.`
              : 'Spin now at Tier 1! Keep saving beads to unlock higher tiers.'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            {best && best.tier >= 2 && (
              <KawaiiButton variant="mint" size="lg" fullWidth onClick={onCashIn}>
                💎 Cash In &amp; Spin — Tier {best.tier}
              </KawaiiButton>
            )}
            <KawaiiButton variant={best && best.tier >= 2 ? 'secondary' : 'primary'} size="lg" fullWidth onClick={onSpinTier1}>
              🎰 Keep Beads &amp; Spin (Tier 1)
            </KawaiiButton>
          </div>
        </div>
      </div>
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

// ── Onboarding (framed: frame_onboard) ──
function OnboardingModal({ onComplete }) {
  const [catName, setCatName]     = useState('')
  const [catColor, setCatColor]   = useState('#FFB7C5')
  const [habitName, setHabitName] = useState('')
  const [habitDesc, setHabitDesc] = useState('')
  const canSubmit = catName.trim() && habitName.trim()

  function handleSubmit() {
    if (!canSubmit) return
    onComplete(
      { name: catName.trim(), color: catColor },
      { name: habitName.trim(), description: habitDesc.trim(), rewards: { bonusActivity: '' } }
    )
  }

  const inputStyle = {
    width: '100%',
    fontFamily: 'Mulish, sans-serif', fontSize: 18,
    padding: '10px 12px',
    border: '2px solid #C8B4E0', borderRadius: 10,
    background: '#FFF5F9', color: '#3D2B4F',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(61,43,79,0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 10,
    }}>
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 520,
        aspectRatio: '600 / 1200',
        maxHeight: '97vh',
        background: "url('/ui/frame_onboard.png') center / 100% 100% no-repeat",
        filter: 'drop-shadow(0 12px 30px rgba(155,126,200,0.45))',
        animation: 'bounce-in 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          padding: '11% 13% 10%',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          overflowY: 'auto',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 28, color: '#9B3D6B' }}>
              WELCOME!
            </div>
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 16, color: '#7B5EA7' }}>
              Let's set up your first habit.
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 18, color: '#7B5EA7', marginBottom: 6 }}>
              STEP 1 · CATEGORY
            </div>
            <input
              style={inputStyle}
              placeholder="e.g. Health, Study, Creative…"
              value={catName}
              onChange={e => setCatName(e.target.value)}
              autoFocus
            />
            <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 16, color: '#7B5EA7', margin: '10px 0 6px' }}>
              PICK A COLOR
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {KAWAII_COLORS.map(c => (
                <button
                  key={c.hex}
                  title={c.name}
                  onClick={() => setCatColor(c.hex)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', padding: 0, cursor: 'pointer',
                    background: `radial-gradient(circle at 35% 30%, white 0%, ${c.hex} 50%, ${darken(c.hex, 20)} 100%)`,
                    border: catColor === c.hex ? '3px solid #3D2B4F' : '2px solid rgba(0,0,0,0.08)',
                    boxShadow: catColor === c.hex ? `0 0 0 2px white, 0 0 0 4px ${c.hex}` : '0 1px 3px rgba(0,0,0,0.1)',
                    transform: catColor === c.hex ? 'scale(1.18)' : 'scale(1)',
                    transition: 'all 120ms ease',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 18, color: '#7B5EA7', marginBottom: 6 }}>
              STEP 2 · YOUR HABIT
            </div>
            <input
              style={{ ...inputStyle, marginBottom: 8 }}
              placeholder="e.g. Morning Run, Read 20 Pages…"
              value={habitName}
              onChange={e => setHabitName(e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Description (optional)"
              value={habitDesc}
              onChange={e => setHabitDesc(e.target.value)}
            />
          </div>

          <KawaiiButton variant="primary" size="lg" fullWidth onClick={handleSubmit} disabled={!canSubmit}>
            ✨ CREATE MY FIRST HABIT
          </KawaiiButton>
        </div>
      </div>
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
    addCategory, addHabit,
  } = useStore()

  const [dropping, setDropping] = useState(null)
  const [prompt, setPrompt]     = useState(null)
  const [gold, setGold]         = useState(false)

  useEffect(() => {
    if (location.state?.freeBead && !dropping && !prompt) {
      setDropping(location.state.freeBead)
      window.history.replaceState({}, document.title)
    }
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
    if (dropping || prompt || gold) return
    const bead = drawBead(habit.id)
    playBeadDraw(bead.isGold)
    setDropping(bead)
    setSession({ selectedHabit: habit })
  }

  function handleDropDone() {
    const bead = dropping
    setDropping(null)
    if (!bead) return
    if (bead.isGold) {
      const cashable = isCashable(wallet)
      const goldOption = cashable.options.find(o => o.tier === 3)
      if (goldOption) cashInBeads(goldOption.beads)
      setSession({ activeTier: 3 })
      setGold(true)
    } else {
      setPrompt(bead)
    }
  }

  function handleCashIn() {
    const cashable = isCashable(wallet)
    setPrompt(null)
    if (cashable.bestOption) cashInBeads(cashable.bestOption.beads)
    navigate('/spin')
  }

  function handleSpinTier1() {
    // Keep all beads in the wallet (don't cash any in) and still get to play at Tier 1.
    setPrompt(null)
    setSession({ activeTier: 1 })
    navigate('/spin')
  }

  function handleOnboardingComplete(catData, habitData) {
    const newCat = addCategory(catData)
    addHabit({ ...habitData, categoryId: newCat.id })
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FloatingDecor />

      {/* ── Pinned header: logo + jar + tap-a-habit (never scrolls) ── */}
      <div style={{ flexShrink: 0, position: 'relative', zIndex: 10, padding: '14px 16px 2px' }}>
        <img
          src="/ui/logo.png"
          alt="My Habit Addiction — get addicted for good this time"
          style={{ width: '100%', maxWidth: 420, height: 'auto', margin: '0 auto', display: 'block',
            filter: 'drop-shadow(0 4px 10px rgba(155,126,200,0.3))' }}
        />
        <TeapotJar jarBeads={jarBeads} milestones={milestones} getBeadColor={getBeadColor} />
        <img
          src="/ui/tap_banner.png?v=2"
          alt="Tap a habit to earn a bead, silly!"
          style={{ display: 'block', width: '94%', maxWidth: 410, height: 'auto', margin: '-38px auto 0' }}
        />
      </div>

      {/* ── Scrolling habit list ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative', zIndex: 10, padding: '8px 16px 14px' }}>
        {habits.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 440, width: '100%', margin: '0 auto' }}>
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

        {/* Quick cash-in shortcut when a tier-2+ match exists */}
        {wallet.length > 0 && isCashable(wallet).options.some(o => o.tier >= 2) && (
          <div style={{ maxWidth: 440, margin: '12px auto 0' }}>
            <KawaiiButton
              variant="mint" size="md" fullWidth
              onClick={() => {
                const c = isCashable(wallet)
                cashInBeads(c.bestOption.beads)
                navigate('/spin')
              }}
            >
              💎 CASH IN &amp; SPIN ({isCashable(wallet).bestOption.label})
            </KawaiiButton>
          </div>
        )}
      </div>

      {dropping && (
        <BeadDropAnim bead={dropping} getBeadColor={getBeadColor} onDone={handleDropDone} />
      )}

      {prompt && (
        <CashPrompt
          drawnBead={prompt}
          wallet={wallet}
          getBeadColor={getBeadColor}
          onCashIn={handleCashIn}
          onSpinTier1={handleSpinTier1}
        />
      )}

      {gold && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(61,43,79,0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            position: 'relative',
            width: '100%', maxWidth: 380,
            aspectRatio: '396 / 352',
            background: "url('/ui/frame_med.png') center / 100% 100% no-repeat",
            filter: 'drop-shadow(0 0 40px rgba(255,215,0,0.45)) drop-shadow(0 12px 30px rgba(155,126,200,0.4))',
            animation: 'bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              padding: '20% 14% 13%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 40, lineHeight: 1 }}>✨</div>
              <div style={{
                fontFamily: "'Fredoka', cursive", fontSize: 32, color: '#5C3A00',
                textShadow: '2px 2px 0 rgba(184,150,12,0.35)',
              }}>
                GOLD BEAD!
              </div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 18, color: '#7B5EA7' }}>
                Automatic cash-in ⚡
              </div>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#B8960C', marginBottom: 8 }}>
                TIER 3 UNLOCKED!
              </div>
              <KawaiiButton variant="gold" size="md" fullWidth onClick={() => {
                setGold(false)
                navigate('/spin')
              }}>
                🎰 SPIN AT TIER 3!
              </KawaiiButton>
            </div>
          </div>
        </div>
      )}

      <WalletStrip
        wallet={wallet}
        getBeadColor={getBeadColor}
        onOpenWallet={() => navigate('/wallet')}
      />

      {habits.length === 0 && !dropping && !prompt && !gold && (
        <OnboardingModal onComplete={handleOnboardingComplete} />
      )}
    </div>
  )
}
