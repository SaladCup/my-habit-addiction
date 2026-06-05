import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useStore, { KAWAII_COLORS } from '../store/useStore'
import { isCashable } from '../engine/gameLogic'
import { FloatingDecor, BeadDisplay, KawaiiButton } from '../components/ui'
import { playBeadDraw } from '../engine/sounds'

// ── color utils ──
function darken(hex, amt = 20) {
  try {
    const n = parseInt(hex.replace('#', ''), 16)
    const r = Math.max(0, (n >> 16) - amt)
    const g = Math.max(0, ((n >> 8) & 0xff) - amt)
    const b = Math.max(0, (n & 0xff) - amt)
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  } catch { return '#888' }
}
function lighten(hex, amt = 30) {
  try {
    const n = parseInt(hex.replace('#', ''), 16)
    const r = Math.min(255, (n >> 16) + amt)
    const g = Math.min(255, ((n >> 8) & 0xff) + amt)
    const b = Math.min(255, (n & 0xff) + amt)
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  } catch { return '#fff' }
}
function hashSlot(key) {
  const s = String(key || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return (h % 6) + 1
}

// ── Pure-SVG teapot with glass body, beads inside, milestone bands ──
function TeapotJar({ jarBeads, milestones, getBeadColor }) {
  const W = 280, H = 320
  // teapot body bounding box (interior fill region)
  const bodyX = 50, bodyY = 110, bodyW = 180, bodyH = 150
  const bodyR = 70   // corner roundness for the body

  const sorted = [...milestones].sort((a, b) => a.beadCount - b.beadCount)
  const maxMilestone = sorted.length ? sorted[sorted.length - 1].beadCount : 50
  const capacity = Math.max(maxMilestone, jarBeads.length, 10)
  const fillRatio = Math.min(jarBeads.length / capacity, 1)
  const fillTop = bodyY + bodyH - fillRatio * bodyH

  // Lay beads out as offset rows from the bottom
  const visible = jarBeads.slice(-90)
  const beadR = 7
  const padX = 12
  const innerW = bodyW - padX * 2
  const colW = beadR * 2 + 2
  const cols = Math.max(3, Math.floor(innerW / colW))
  const rowH = beadR * 2 - 1

  function beadPos(i) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const off = row % 2 === 1 ? colW / 2 : 0
    const jitter = ((i * 9301 + 49297) % 233281) / 233281
    return {
      x: bodyX + padX + col * colW + off + (jitter * 2 - 1),
      y: bodyY + bodyH - beadR - row * rowH,
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 6px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 320, overflow: 'visible' }}>
        <defs>
          {/* soft purple "back wall" — what you see through the empty glass */}
          <radialGradient id="teapot-back" cx="50%" cy="40%" r="70%">
            <stop offset="0%"   stopColor="#F3E8FF" />
            <stop offset="60%"  stopColor="#E0CCF5" />
            <stop offset="100%" stopColor="#C8B4E0" />
          </radialGradient>

          {/* front glass — translucent overlay with cool tint */}
          <linearGradient id="teapot-glass" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.55)" />
            <stop offset="35%"  stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(180,160,210,0.30)" />
          </linearGradient>

          {/* glossy diagonal shine */}
          <linearGradient id="teapot-shine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.0)" />
            <stop offset="45%"  stopColor="rgba(255,255,255,0.55)" />
            <stop offset="55%"  stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
          </linearGradient>

          <linearGradient id="teapot-rim" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#C8B4E0" />
            <stop offset="100%" stopColor="#9B7EC8" />
          </linearGradient>

          {/* clip so beads + fill live strictly inside the teapot body */}
          <clipPath id="teapot-clip">
            <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx={bodyR} ry={bodyR * 0.8} />
          </clipPath>
        </defs>

        {/* ── LAYER 1: back wall (behind the glass) ── */}
        <g>
          {/* lid */}
          <ellipse cx={W / 2} cy={bodyY + 6} rx={70} ry={12} fill="url(#teapot-rim)" />
          <rect x={W / 2 - 10} y={bodyY - 20} width={20} height={18} rx={6} fill="#9B7EC8" />
          <circle cx={W / 2} cy={bodyY - 22} r={8} fill="#C8B4E0" stroke="#9B7EC8" strokeWidth={2} />
          <circle cx={W / 2 - 2} cy={bodyY - 24} r={2.5} fill="#FFF5F9" opacity={0.9} />

          {/* spout */}
          <path
            d={`M${bodyX + 4} ${bodyY + 50}
                C ${bodyX - 30} ${bodyY + 30}, ${bodyX - 42} ${bodyY + 60}, ${bodyX - 36} ${bodyY + 90}
                L ${bodyX - 4} ${bodyY + 78}
                C ${bodyX - 10} ${bodyY + 64}, ${bodyX - 4} ${bodyY + 56}, ${bodyX + 8} ${bodyY + 64} Z`}
            fill="url(#teapot-rim)" stroke="#7B5EA7" strokeWidth={1.5} strokeLinejoin="round"
          />

          {/* handle */}
          <path
            d={`M${bodyX + bodyW - 4} ${bodyY + 40}
                C ${bodyX + bodyW + 40} ${bodyY + 30}, ${bodyX + bodyW + 50} ${bodyY + 110}, ${bodyX + bodyW - 6} ${bodyY + 110}`}
            fill="none" stroke="#9B7EC8" strokeWidth={14} strokeLinecap="round"
          />
          <path
            d={`M${bodyX + bodyW - 4} ${bodyY + 40}
                C ${bodyX + bodyW + 40} ${bodyY + 30}, ${bodyX + bodyW + 50} ${bodyY + 110}, ${bodyX + bodyW - 6} ${bodyY + 110}`}
            fill="none" stroke="#C8B4E0" strokeWidth={6} strokeLinecap="round"
          />

          {/* back wall of the body */}
          <rect
            x={bodyX} y={bodyY} width={bodyW} height={bodyH}
            rx={bodyR} ry={bodyR * 0.8}
            fill="url(#teapot-back)"
            stroke="#9B7EC8" strokeWidth={3}
          />
        </g>

        {/* ── LAYER 2: bead pile (clipped inside body) ── */}
        <g clipPath="url(#teapot-clip)">
          {/* gentle fill tint so the bead pile reads as "water" */}
          <rect
            x={bodyX} y={fillTop} width={bodyW} height={bodyY + bodyH - fillTop}
            fill="#FFD9E6" opacity={0.35}
          />
          {visible.map((b, i) => {
            const p = beadPos(i)
            if (p.y < bodyY + 4) return null
            const color = getBeadColor(b.slot, b.isGold)
            const grad = `bead-${b.id}`
            return (
              <g key={b.id}>
                <defs>
                  <radialGradient id={grad} cx="35%" cy="30%" r="75%">
                    <stop offset="0%"   stopColor="#FFFFFF" />
                    <stop offset="40%"  stopColor={color} />
                    <stop offset="100%" stopColor={darken(color, 35)} />
                  </radialGradient>
                </defs>
                <circle
                  cx={p.x} cy={p.y} r={beadR}
                  fill={`url(#${grad})`}
                  stroke={darken(color, 25)} strokeWidth={0.6}
                  opacity={0.97}
                />
                <circle cx={p.x - 2} cy={p.y - 2.5} r={1.6} fill="#FFFFFF" opacity={0.85} />
                {b.isGold && (
                  <circle cx={p.x} cy={p.y} r={beadR + 1.5} fill="none" stroke="#FFE066" strokeWidth={0.8} opacity={0.7} />
                )}
              </g>
            )
          })}
        </g>

        {/* ── LAYER 3: milestone bands across the glass ── */}
        <g clipPath="url(#teapot-clip)">
          {sorted.map(m => {
            const ly = bodyY + bodyH - (m.beadCount / capacity) * bodyH
            const reached = jarBeads.length >= m.beadCount
            const label = m.name.length > 10 ? m.name.slice(0, 10) + '…' : m.name
            return (
              <g key={m.id}>
                <line
                  x1={bodyX + 6} y1={ly} x2={bodyX + bodyW - 6} y2={ly}
                  stroke={reached ? '#5CBFA0' : '#9B7EC8'}
                  strokeWidth={1.5} strokeDasharray="5 4" opacity={0.8}
                />
                <rect
                  x={bodyX + bodyW - 84} y={ly - 9}
                  width={78} height={18} rx={9}
                  fill={reached ? '#B4E0C8' : '#FFF5F9'}
                  stroke={reached ? '#5CBFA0' : '#9B7EC8'} strokeWidth={1.5}
                />
                <text
                  x={bodyX + bodyW - 45} y={ly + 1}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={11} fontFamily="'Bunny Snaps', cursive"
                  fill={reached ? '#1A5C3A' : '#5C4B7A'}
                >
                  {reached ? '★ ' : ''}{label}
                </text>
              </g>
            )
          })}
        </g>

        {/* ── LAYER 4: front glass overlay (the see-through pane) ── */}
        <g pointerEvents="none">
          <rect
            x={bodyX} y={bodyY} width={bodyW} height={bodyH}
            rx={bodyR} ry={bodyR * 0.8}
            fill="url(#teapot-glass)"
          />
          {/* diagonal shine band */}
          <path
            d={`M${bodyX + 14} ${bodyY + 14}
                Q ${bodyX + 24} ${bodyY + 4}, ${bodyX + 40} ${bodyY + 10}
                L ${bodyX + 24} ${bodyY + bodyH - 30}
                Q ${bodyX + 16} ${bodyY + bodyH - 20}, ${bodyX + 10} ${bodyY + bodyH - 40} Z`}
            fill="url(#teapot-shine)" opacity={0.55}
          />
          {/* edge highlight */}
          <rect
            x={bodyX} y={bodyY} width={bodyW} height={bodyH}
            rx={bodyR} ry={bodyR * 0.8}
            fill="none" stroke="#FFFFFF" strokeWidth={1.2} opacity={0.6}
          />
        </g>

        {/* base / saucer */}
        <ellipse cx={W / 2} cy={bodyY + bodyH + 6} rx={88} ry={10} fill="#9B7EC8" />
        <ellipse cx={W / 2} cy={bodyY + bodyH + 4} rx={84} ry={7} fill="#C8B4E0" />

        {/* bead count under teapot */}
        <text
          x={W / 2} y={H - 4}
          textAnchor="middle"
          fontSize={20} fontFamily="'Bunny Snaps', cursive" fill="#7B5EA7"
        >
          {jarBeads.length} bead{jarBeads.length === 1 ? '' : 's'}
        </text>
      </svg>
    </div>
  )
}

// ── Bubbly arcade habit button (pure CSS, no PNGs) ──
function HabitButton({ habit, color, onTap }) {
  const dark = darken(color, 35)
  const light = lighten(color, 18)
  return (
    <button
      onClick={onTap}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 96,
        padding: '14px 18px 16px',
        border: `4px solid ${dark}`,
        borderRadius: 28,
        background: `radial-gradient(ellipse at 30% 22%, ${light} 0%, ${color} 38%, ${darken(color, 12)} 100%)`,
        boxShadow: `
          inset 0 -8px 0 ${dark}99,
          inset 0 4px 0 rgba(255,255,255,0.55),
          0 6px 0 ${dark},
          0 14px 22px ${dark}55
        `,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12,
        textAlign: 'left',
        userSelect: 'none', WebkitUserSelect: 'none',
        transition: 'transform 120ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 120ms ease',
        fontFamily: "'Bunny Snaps', cursive",
        overflow: 'hidden',
      }}
      onPointerDown={e => {
        e.currentTarget.style.transform = 'translateY(5px) scale(0.98)'
        e.currentTarget.style.boxShadow = `
          inset 0 -2px 0 ${dark}aa,
          inset 0 8px 14px ${light},
          0 2px 0 ${dark},
          0 6px 12px ${dark}55
        `
      }}
      onPointerUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
      onPointerLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      {/* glossy top highlight */}
      <span style={{
        position: 'absolute', top: 6, left: 14, right: 14, height: 18,
        borderRadius: 20,
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.85), rgba(255,255,255,0))',
        pointerEvents: 'none',
      }} />
      {/* sparkle */}
      <span style={{
        position: 'absolute', top: 10, left: 24, fontSize: 14,
        color: 'rgba(255,255,255,0.85)', pointerEvents: 'none',
      }}>✦</span>

      {/* bead medallion */}
      <span style={{
        width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
        background: `radial-gradient(circle at 35% 30%, #fff 0%, ${color} 55%, ${darken(color, 25)} 100%)`,
        boxShadow: `inset 0 -3px 6px ${darken(color, 30)}, 0 0 0 3px #fff, 0 0 0 5px ${darken(color, 20)}66, 0 3px 6px rgba(0,0,0,0.25)`,
        zIndex: 1,
      }} />

      <span style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
        <span style={{
          display: 'block',
          fontFamily: "'Bunny Snaps', cursive",
          fontSize: 26, lineHeight: 1.1,
          color: '#3D2B4F',
          textShadow: `1px 1px 0 ${light}, 0 2px 3px rgba(255,255,255,0.4)`,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {habit.name}
        </span>
        {habit.description && (
          <span style={{
            display: 'block',
            fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700,
            color: '#3D2B4F', opacity: 0.7,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            marginTop: 2,
          }}>
            {habit.description}
          </span>
        )}
      </span>

      <span style={{
        zIndex: 1,
        fontSize: 30,
        filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.25))',
      }}>
        🎯
      </span>
    </button>
  )
}

// ── Bead drop animation: bead falls from button toward teapot ──
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

// ── Cash-in vs save-for-later prompt ──
function CashPrompt({ drawnBead, wallet, getBeadColor, onCashIn, onSaveForLater }) {
  const cashable = isCashable(wallet)
  const color = getBeadColor(drawnBead.slot, drawnBead.isGold)
  const best = cashable.bestOption

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(61,43,79,0.55)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'linear-gradient(180deg, #FFF5F9 0%, #FCE7F3 100%)',
        border: '4px solid #C8B4E0',
        borderRadius: 28,
        padding: 22,
        boxShadow: '0 18px 40px rgba(61,43,79,0.35), inset 0 4px 0 rgba(255,255,255,0.7)',
        animation: 'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        textAlign: 'center',
      }}>
        <style>{`
          @keyframes popIn {
            0%   { transform: scale(0.6); opacity: 0; }
            100% { transform: scale(1);   opacity: 1; }
          }
        `}</style>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <BeadDisplay color={color} slot={drawnBead.slot} isGold={drawnBead.isGold} size="xl" animate={drawnBead.isGold} />
        </div>

        <div style={{
          fontFamily: "'Bunny Snaps', cursive",
          fontSize: 26, color: '#9B7EC8', marginBottom: 4,
        }}>
          🌸 BEAD EARNED!
        </div>
        <div style={{
          fontFamily: 'Nunito, sans-serif', fontSize: 15, color: '#7B5EA7',
          marginBottom: 18, lineHeight: 1.3,
        }}>
          {best && best.tier >= 2
            ? `You can cash in for a Tier ${best.tier} spin right now!`
            : 'Cash in now for a Tier 1 spin, or save up for a match.'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <KawaiiButton
            variant={best && best.tier >= 2 ? 'mint' : 'primary'}
            size="lg"
            fullWidth
            onClick={onCashIn}
          >
            Cash In Now 💎
          </KawaiiButton>
          <KawaiiButton variant="secondary" size="md" fullWidth onClick={onSaveForLater}>
            Save for Later 💾
          </KawaiiButton>
        </div>
      </div>
    </div>
  )
}

// ── Wallet strip at bottom ──
function WalletStrip({ wallet, getBeadColor, onOpenWallet }) {
  if (!wallet.length) return null
  return (
    <div
      onClick={onOpenWallet}
      style={{
        position: 'sticky', bottom: 0, zIndex: 50,
        background: 'linear-gradient(180deg, rgba(255,245,249,0.97), rgba(252,231,243,0.97))',
        backdropFilter: 'blur(10px)',
        borderTop: '3px solid #C8B4E0',
        margin: '10px -16px 0',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer',
      }}
    >
      <span style={{
        fontFamily: "'Bunny Snaps', cursive",
        fontSize: 22, color: '#7B5EA7', flexShrink: 0,
      }}>
        WALLET
      </span>
      <div style={{
        display: 'flex', gap: 5, flex: 1, overflow: 'hidden', flexWrap: 'nowrap',
        minWidth: 0,
      }}>
        {wallet.slice(-14).map(b => (
          <BeadDisplay
            key={b.id}
            color={getBeadColor(b.slot, b.isGold)}
            slot={b.slot}
            isGold={b.isGold}
            size="sm"
          />
        ))}
        {wallet.length > 14 && (
          <span style={{
            fontFamily: "'Bunny Snaps', cursive",
            fontSize: 18, color: '#9B7EC8', alignSelf: 'center', marginLeft: 4,
          }}>
            +{wallet.length - 14}
          </span>
        )}
      </div>
      <span style={{
        fontFamily: "'Bunny Snaps', cursive",
        fontSize: 24, color: '#9B7EC8', flexShrink: 0,
      }}>
        ›
      </span>
    </div>
  )
}

// ── Onboarding (kept simple for new users) ──
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
    fontFamily: 'Nunito, sans-serif', fontSize: 18,
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
      padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 460, maxHeight: '94vh', overflowY: 'auto',
        background: 'linear-gradient(180deg, #FFF5F9 0%, #FCE7F3 100%)',
        border: '4px solid #C8B4E0',
        borderRadius: 28, padding: 24,
        boxShadow: '0 18px 40px rgba(61,43,79,0.35), inset 0 4px 0 rgba(255,255,255,0.7)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 44, marginBottom: 4 }}>🫖</div>
          <div style={{ fontFamily: "'Bunny Snaps', cursive", fontSize: 28, color: '#9B7EC8' }}>
            WELCOME!
          </div>
          <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 16, color: '#7B5EA7' }}>
            Let's set up your first habit.
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "'Bunny Snaps', cursive", fontSize: 18, color: '#7B5EA7', marginBottom: 6 }}>
            STEP 1 · CATEGORY
          </div>
          <input
            style={inputStyle}
            placeholder="e.g. Health, Study, Creative…"
            value={catName}
            onChange={e => setCatName(e.target.value)}
            autoFocus
          />
          <div style={{ fontFamily: "'Bunny Snaps', cursive", fontSize: 16, color: '#7B5EA7', margin: '10px 0 6px' }}>
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

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "'Bunny Snaps', cursive", fontSize: 18, color: '#7B5EA7', marginBottom: 6 }}>
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

        <KawaiiButton
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          ✨ CREATE MY FIRST HABIT
        </KawaiiButton>
      </div>
    </div>
  )
}

// ── Main Screen ──
export default function HomeScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    habits, wallet, jarBeads, milestones, settings,
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

  // Map each habit to a stable bead slot color (from settings.beadSlots)
  const habitColor = useMemo(() => {
    const map = {}
    for (const h of habits) {
      const slot = h.beadSlot || hashSlot(h.categoryId || h.id)
      const found = settings.beadSlots.find(s => s.slot === slot)
      map[h.id] = found ? found.color : '#C8B4E0'
    }
    return map
  }, [habits, settings.beadSlots])

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

  function handleSaveForLater() {
    setPrompt(null)
  }

  function handleOnboardingComplete(catData, habitData) {
    const newCat = addCategory(catData)
    addHabit({ ...habitData, categoryId: newCat.id })
  }

  return (
    <div style={{ position: 'relative', minHeight: '100%', paddingBottom: 8 }}>
      <FloatingDecor />

      <div style={{ position: 'relative', zIndex: 10, padding: '14px 16px 0' }}>
        {/* Title */}
        <h1 style={{
          margin: '0 0 6px',
          fontFamily: "'Bunny Snaps', cursive",
          fontSize: 'clamp(28px, 8vw, 40px)',
          color: '#3D2B4F',
          textAlign: 'center',
          letterSpacing: '0.04em',
          textShadow: `
            -1px -1px 0 #FFF5F9,
             1px -1px 0 #FFF5F9,
            -1px  1px 0 #FFF5F9,
             1px  1px 0 #FFF5F9,
             2px  3px 0 #C8B4E0,
             4px  5px 0 rgba(155,126,200,0.55),
             0 10px 22px rgba(61,43,79,0.4)
          `,
        }}>
          MY HABIT ADDICTION
        </h1>
        <div style={{
          textAlign: 'center',
          fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 700,
          color: '#7B5EA7', opacity: 0.8, marginBottom: 6,
          letterSpacing: '0.06em',
        }}>
          get addicted for good this time ✨
        </div>

        {/* Teapot */}
        <TeapotJar jarBeads={jarBeads} milestones={milestones} getBeadColor={getBeadColor} />

        {/* Tap-a-habit banner */}
        <div style={{
          textAlign: 'center',
          fontFamily: "'Bunny Snaps', cursive",
          fontSize: 22, color: '#FF85A1', margin: '6px 0 12px',
          textShadow: '1px 1px 0 #fff',
        }}>
          ✦ Tap a habit to earn a bead ✦
        </div>

        {/* Habit list */}
        {habits.length > 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 14,
            maxWidth: 440, margin: '0 auto',
          }}>
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
          <div style={{ marginTop: 14 }}>
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
          onSaveForLater={handleSaveForLater}
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
            width: '100%', maxWidth: 360,
            background: 'linear-gradient(180deg, #FFF9DB 0%, #FFE9A0 100%)',
            border: '4px solid #F5C44B',
            borderRadius: 28, padding: 24,
            textAlign: 'center',
            boxShadow: '0 0 40px rgba(255,215,0,0.55), 0 18px 40px rgba(61,43,79,0.35)',
            animation: 'popIn 0.45s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{ fontSize: 44 }}>✨</div>
            <div style={{
              fontFamily: "'Bunny Snaps', cursive", fontSize: 32, color: '#5C3A00',
              textShadow: '2px 2px 0 rgba(184,150,12,0.35)',
            }}>
              GOLD BEAD!
            </div>
            <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 15, color: '#7B5EA7', margin: '6px 0' }}>
              Automatic cash-in ⚡
            </div>
            <div style={{
              fontFamily: "'Bunny Snaps', cursive", fontSize: 22, color: '#B8960C', marginBottom: 14,
            }}>
              TIER 3 UNLOCKED!
            </div>
            <KawaiiButton variant="gold" size="lg" fullWidth onClick={() => {
              setGold(false)
              navigate('/spin')
            }}>
              🎰 SPIN AT TIER 3!
            </KawaiiButton>
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
