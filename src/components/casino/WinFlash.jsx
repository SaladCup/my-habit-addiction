// Brief full-screen color flash on win/loss — shared across all casino games.
// Render it anywhere; `flashKey` bumping re-triggers the animation each round.
const COLORS = {
  jackpot: 'rgba(255,215,0,0.34)',
  t3:      'rgba(92,191,160,0.28)',
  t2:      'rgba(200,180,224,0.28)',
  t1:      'rgba(255,133,161,0.24)',
  loss:    'rgba(196,75,106,0.22)',
}

export default function WinFlash({ flashKey, tier = 't1' }) {
  if (!flashKey) return null
  return (
    <div
      key={flashKey}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none',
        background: COLORS[tier] || COLORS.t1,
        animation: 'win-flash 0.72s ease-out forwards',
      }}
    />
  )
}
