import { useRef } from 'react'
import { playButtonTap } from '../../engine/sounds'

const VARIANTS = {
  primary:   { bg: '#FF85A1', shadow: '#C44B6A', text: '#fff' },
  secondary: { bg: '#C8B4E0', shadow: '#8B6BAE', text: '#fff' },
  // "mint" key kept so all 11 call sites stay valid, but restyled from the loud
  // spring-green to a warm pastel gold. Flat (no shimmer) so it stays clearly
  // distinct from the special `gold` SPIN button when both share a screen.
  mint:      { bg: '#FFD96B', shadow: '#E0A52E', text: '#5C3A00' },
  gold:      { bg: '#FFD700', shadow: '#C8A800', text: '#5C3A00' },
  danger:    { bg: '#FF7675', shadow: '#C44B4B', text: '#fff' },
  ghost:     { bg: 'rgba(200,180,224,0.25)', shadow: 'transparent', text: '#9B7EC8', border: '2px solid #C8B4E0' },
}

const SIZES = {
  sm: { fontSize: '20px', padding: '8px 16px',  borderRadius: '12px', shadowOffset: '3px' },
  md: { fontSize: '24px', padding: '12px 24px', borderRadius: '16px', shadowOffset: '4px' },
  lg: { fontSize: '27px', padding: '16px 32px', borderRadius: '20px', shadowOffset: '5px' },
  xl: { fontSize: '27px', padding: '20px 36px', borderRadius: '24px', shadowOffset: '5px' },
}

export default function KawaiiButton({
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  children,
  fullWidth = false,
  style = {},
  type = 'button',
}) {
  const btnRef = useRef(null)
  const v = VARIANTS[variant] || VARIANTS.primary
  const s = SIZES[size] || SIZES.md

  function handleClick(e) {
    if (disabled) return
    playButtonTap()
    // Squish animation
    if (btnRef.current) {
      btnRef.current.animate(
        [
          { transform: 'scale(1) translateY(0)',
            boxShadow: `0 ${s.shadowOffset} 0 ${v.shadow}` },
          { transform: `scale(0.96) translateY(${s.shadowOffset})`,
            boxShadow: '0 0 0 transparent' },
          { transform: 'scale(1.03) translateY(0)',
            boxShadow: `0 ${s.shadowOffset} 0 ${v.shadow}` },
          { transform: 'scale(1) translateY(0)',
            boxShadow: `0 ${s.shadowOffset} 0 ${v.shadow}` },
        ],
        { duration: 300, easing: 'cubic-bezier(0.34,1.56,0.64,1)', fill: 'none' }
      )
    }
    onClick?.(e)
  }

  return (
    <button
      ref={btnRef}
      type={type}
      onClick={handleClick}
      disabled={disabled}
      style={{
        fontFamily: "'Fredoka', cursive",
        fontSize: s.fontSize,
        lineHeight: 1.4,
        color: disabled ? 'rgba(61,43,79,0.4)' : v.text,
        background: disabled ? '#D8D0E8' : (variant === 'gold'
          ? 'linear-gradient(135deg, #FFE066 0%, #FFD700 50%, #F5C44B 100%)'
          : v.bg),
        border: v.border || 'none',
        borderRadius: s.borderRadius,
        padding: s.padding,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : `0 ${s.shadowOffset} 0 ${v.shadow}`,
        transition: 'opacity 150ms ease',
        opacity: disabled ? 0.6 : 1,
        width: fullWidth ? '100%' : 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        letterSpacing: '0.03em',
        position: 'relative',
        overflow: 'hidden',
        ...(variant === 'gold' && !disabled ? {
          animation: 'shimmer 2.5s linear infinite',
          backgroundSize: '200% 100%',
        } : {}),
        ...style,
      }}
    >
      {children}
    </button>
  )
}
