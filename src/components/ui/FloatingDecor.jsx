import { useMemo } from 'react'

const SYMBOLS = [
  '✦','✦','✦','✧','✧','✩','⭐','🌸','💫','✨','✨','✨',
  '💖','💗','♡','♡','🌟','★','☆','💎','🎀','❋','✿',
  '🩷','🌷','💝','✺','❀','🌺','🌼',
]

const COLORS = [
  '#FFB7C5','#FF85A1','#C8B4E0','#9B7EC8','#B4D4FF',
  '#4BC5F5','#B4E0C8','#F5C44B','#FFE9A0','#FAB1A0',
  '#E8B4F8','#FF6B9D','#4BF5A0','#FFD700','#FFAED6',
]

const ANIM_NAMES = ['float', 'float-slow', 'twinkle', 'drift-left', 'drift-right', 'rise']

function seeded(n, max) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return Math.abs(x - Math.floor(x)) * max
}

export default function FloatingDecor() {
  const items = useMemo(() => Array.from({ length: 52 }, (_, i) => ({
    symbol:   SYMBOLS[Math.floor(seeded(i * 3,    SYMBOLS.length))],
    left:     `${seeded(i * 7  + 1, 96)}%`,
    top:      `${18 + seeded(i * 11 + 2, 77)}%`,
    size:     `${10 + seeded(i * 5 + 3, 22)}px`,
    color:    COLORS[Math.floor(seeded(i * 13 + 4, COLORS.length))],
    duration: `${2.5 + seeded(i * 17 + 5, 5)}s`,
    delay:    `-${seeded(i * 19 + 6, 6)}s`,
    anim:     ANIM_NAMES[Math.floor(seeded(i * 23 + 7, ANIM_NAMES.length))],
    opacity:  0.28 + seeded(i * 29 + 8, 0.52),
    glow:     i % 5 === 0,
  })), [])

  return (
    <>
      <style>{`
        @keyframes drift-left {
          0%,100% { transform: translateX(0) translateY(0) rotate(0deg); }
          50%     { transform: translateX(-18px) translateY(-14px) rotate(-10deg); }
        }
        @keyframes drift-right {
          0%,100% { transform: translateX(0) translateY(0) rotate(0deg); }
          50%     { transform: translateX(18px) translateY(-10px) rotate(10deg); }
        }
        @keyframes rise {
          0%,100% { transform: translateY(0) scale(1); }
          45%     { transform: translateY(-22px) scale(1.2); }
        }
      `}</style>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {items.map((item, i) => (
          <span key={i} style={{
            position: 'absolute',
            left: item.left,
            top: item.top,
            fontSize: item.size,
            color: item.color,
            opacity: item.opacity,
            animation: `${item.anim} ${item.duration} ease-in-out ${item.delay} infinite`,
            userSelect: 'none',
            display: 'inline-block',
            filter: item.glow ? `drop-shadow(0 0 5px ${item.color})` : 'none',
          }}>
            {item.symbol}
          </span>
        ))}
      </div>
    </>
  )
}
