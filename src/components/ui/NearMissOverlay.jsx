import { useEffect, useState } from 'react'

const TIER_LABELS = { t2: 'LVL 2', t3: 'LVL 3', jackpot: '💎 JACKPOT', bonus: '🎰 BONUS' }

export default function NearMissOverlay({ show, higherTier, onDone }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (show) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show/hide choreography: the timer below is the other half of this transition
      setVisible(true)
      const t = setTimeout(() => {
        setVisible(false)
        onDone?.()
      }, 1800)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fire only when `show` flips; an inline onDone must not restart the timer
  }, [show])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      top: '30%',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 350,
      background: 'rgba(255,245,249,0.95)',
      border: '3px solid #FF85A1',
      borderRadius: '20px',
      padding: '16px 28px',
      boxShadow: '0 8px 32px rgba(255,133,161,0.3)',
      textAlign: 'center',
      animation: 'bounce-in 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        fontFamily: "'Fredoka', cursive",
        fontSize: '10px',
        color: '#FF85A1',
        marginBottom: '6px',
      }}>
        SO CLOSE... 😭
      </div>
      <div style={{
        fontFamily: "'Fredoka', cursive",
        fontSize: '14px',
        color: '#C8B4E0',
        opacity: 0.7,
        textDecoration: 'line-through',
      }}>
        {TIER_LABELS[higherTier]}
      </div>
      <div style={{
        fontFamily: 'Mulish, sans-serif',
        fontSize: '12px',
        color: '#7B5EA7',
        marginTop: '6px',
      }}>
        cash in more beads next time! 💕
      </div>
    </div>
  )
}
