import { useRef } from 'react'

const SIZES = { sm: 20, md: 32, lg: 48, xl: 64 }

const BEAD_IMAGES = {
  1: '/beads/bead-1.png',
  2: '/beads/bead-2.png',
  3: '/beads/bead-3.png',
  4: '/beads/bead-4.png',
  5: '/beads/bead-5.png',
  6: '/beads/bead-6.png',
}

export default function BeadDisplay({
  color = '#FFB7C5',
  isGold = false,
  slot,
  size = 'md',
  onClick,
  selected = false,
  style = {},
  animate = false,
}) {
  const ref = useRef(null)
  const px = SIZES[size] || SIZES.md
  const actualColor = isGold ? '#FFD700' : color

  function handleClick() {
    if (!onClick) return
    ref.current?.animate(
      [
        { transform: 'rotate(0deg) scale(1)' },
        { transform: 'rotate(-15deg) scale(1.1)' },
        { transform: 'rotate(12deg) scale(1.05)' },
        { transform: 'rotate(-8deg) scale(1.08)' },
        { transform: 'rotate(0deg) scale(1)' },
      ],
      { duration: 400, easing: 'ease-out' }
    )
    onClick()
  }

  const imgSrc = isGold ? '/beads/bead-gold.png' : (slot ? BEAD_IMAGES[slot] : null)

  return (
    <div
      ref={ref}
      onClick={handleClick}
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        overflow: 'hidden',
        boxShadow: selected
          ? `0 0 0 3px white, 0 0 0 5px ${actualColor}, 0 0 12px ${actualColor}`
          : isGold
            ? '0 2px 8px rgba(255,215,0,0.5)'
            : '0 2px 6px rgba(0,0,0,0.15)',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        transition: 'box-shadow 200ms ease, transform 200ms ease',
        animation: isGold && animate ? 'pulse-glow 2s ease-in-out infinite' : 'none',
        position: 'relative',
        ...style,
      }}
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt=""
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
          draggable={false}
        />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          background: isGold
            ? 'radial-gradient(circle at 30% 25%, #FFFFFF 0%, #FFE566 20%, #FFD700 50%, #B8960C 100%)'
            : `radial-gradient(circle at 35% 30%, white 0%, ${actualColor} 40%, ${darken(actualColor, 20)} 100%)`,
        }} />
      )}
    </div>
  )
}

function darken(hex, amount) {
  const num = parseInt(hex.slice(1), 16)
  const r = Math.max(0, (num >> 16) - amount)
  const g = Math.max(0, ((num >> 8) & 0xff) - amount)
  const b = Math.max(0, (num & 0xff) - amount)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
