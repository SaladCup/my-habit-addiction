import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useStore, { KAWAII_COLORS } from '../store/useStore'
import { isCashable } from '../engine/gameLogic'
import { FloatingDecor, BeadDisplay, KawaiiButton } from '../components/ui'
import { playBeadDraw } from '../engine/sounds'

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
function seeded(n) {
  const x = Math.sin(n + 1) * 10000
  return x - Math.floor(x)
}

// ── Jar (kawaii glass jar art + bead fill) ──
function TeapotJar({ jarBeads, milestones, getBeadColor }) {
  const W = 200, H = 291
  const jarX = 30, jarW = 140
  const jarY = 86, jarH = 168

  const maxMilestone = milestones.length
    ? Math.max(...milestones.map(m => m.beadCount))
    : 150
  const capacity = Math.max(maxMilestone, jarBeads.length, 1)
  const visibleBeads = jarBeads.slice(-77)

  function beadPos(i) {
    const totalCols = 7
    const col = i % totalCols
    const row = Math.floor(i / totalCols)
    const xOff = seeded(i * 7) * 8 - 4
    const yOff = seeded(i * 11) * 4 - 2
    return {
      x: jarX + 14 + col * ((jarW - 28) / (totalCols - 1)) + xOff,
      y: jarY + jarH - 10 - row * 14 + yOff,
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 2px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={122} height={122 * (H / W)} style={{ overflow: 'visible' }}>
        <defs>
          <clipPath id="jar-clip">
            <path d={`M${jarX} ${jarY} H${jarX + jarW} V${jarY + jarH - 18} Q${jarX + jarW} ${jarY + jarH} ${jarX + jarW - 18} ${jarY + jarH} H${jarX + 18} Q${jarX} ${jarY + jarH} ${jarX} ${jarY + jarH - 18} Z`} />
          </clipPath>
        </defs>

        {/* beads sit behind the glass art so the glossy highlight reads on top */}
        <g clipPath="url(#jar-clip)">
          {visibleBeads.map((bead, i) => {
            const pos = beadPos(i)
            if (pos.y < jarY) return null
            const r = 8
            const imgSrc = bead.isGold ? '/beads/bead-gold.png' : `/beads/bead-${bead.slot}.png`
            return (
              <image key={bead.id} href={imgSrc} x={pos.x - r} y={pos.y - r} width={r * 2} height={r * 2} opacity={0.97} />
            )
          })}
        </g>

        {/* the jar art itself */}
        <image href="/ui/jar.png" x={0} y={0} width={W} height={H} pointerEvents="none" />

        {/* milestone lines across the glass */}
        {milestones.map(m => {
          const lineY = jarY + jarH - (m.beadCount / capacity) * jarH
          if (lineY < jarY || lineY > jarY + jarH) return null
          const isReached = jarBeads.length >= m.beadCount
          return (
            <g key={m.id}>
              <line x1={jarX} y1={lineY} x2={jarX + jarW} y2={lineY}
                stroke={isReached ? '#5CBFA0' : '#9B7EC8'}
                strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
              <rect x={jarX + jarW - 4} y={lineY - 8} width={52} height={16} rx={4}
                fill={isReached ? '#B4E0C8' : '#E8D8F5'}
                stroke={isReached ? '#5CBFA0' : '#9B7EC8'} strokeWidth={1} />
              <text x={jarX + jarW + 22} y={lineY + 1}
                textAnchor="middle" dominantBaseline="central"
                fontSize={15} fontFamily="'Fredoka', cursive"
                fill={isReached ? '#1A5C3A' : '#3D2B4F'}>
                {m.name.length > 7 ? m.name.slice(0, 7) + '…' : m.name}
              </text>
            </g>
          )
        })}

        <text x={W / 2} y={H - 1} textAnchor="middle"
          fontSize={22} fontFamily="'Fredoka', cursive" fill="#9B7EC8">
          {jarBeads.length} beads
        </text>
      </svg>
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
      <div style={{ flexShrink: 0, position: 'relative', zIndex: 10, padding: '30px 16px 2px' }}>
        <img
          src="/ui/logo.png"
          alt="My Habit Addiction — get addicted for good this time"
          style={{ width: '100%', maxWidth: 420, height: 'auto', margin: '0 auto', display: 'block',
            filter: 'drop-shadow(0 4px 10px rgba(155,126,200,0.3))' }}
        />
        <TeapotJar jarBeads={jarBeads} milestones={milestones} getBeadColor={getBeadColor} />
        <img
          src="/ui/tap_banner.png"
          alt="Tap a habit to earn a bead, silly!"
          style={{ display: 'block', width: '94%', maxWidth: 410, height: 'auto', margin: '2px auto 0' }}
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
