import { useState, useEffect, useRef } from 'react'

export default function TimerDisplay({ endTime, onExpire, style = {} }) {
  const [remaining, setRemaining] = useState(0)
  const intervalRef = useRef(null)
  // Keep the latest onExpire in a ref so an inline callback (the common case) doesn't
  // tear down + recreate the interval on every parent render (which drifted the timer).
  const onExpireRef = useRef(onExpire)
  useEffect(() => { onExpireRef.current = onExpire }, [onExpire])

  useEffect(() => {
    function tick() {
      const now = Date.now()
      const left = Math.max(0, endTime - now)
      setRemaining(left)
      if (left === 0) {
        clearInterval(intervalRef.current)
        onExpireRef.current?.()
      }
    }
    tick()
    intervalRef.current = setInterval(tick, 500)
    return () => clearInterval(intervalRef.current)
  }, [endTime])

  const totalSecs = Math.ceil(remaining / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  const isWarning = totalSecs <= 30
  const isUrgent  = totalSecs <= 10

  return (
    <div style={{
      fontFamily: "'Fredoka', cursive",
      fontSize: '22px',
      color: isUrgent ? '#F54B4B' : isWarning ? '#F5C44B' : '#3D2B4F',
      animation: isUrgent ? 'pulse-glow 0.5s ease-in-out infinite' : 'none',
      textAlign: 'center',
      letterSpacing: '0.05em',
      transition: 'color 300ms ease',
      ...style,
    }}>
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  )
}
