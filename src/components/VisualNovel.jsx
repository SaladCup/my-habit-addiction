import { useState, useEffect } from 'react'
import HabitChanSprite from './HabitChanSprite'

// One reusable visual-novel overlay. It ghosts/dims everything behind it, slides
// Habit-Chan up, and types each line out in a dialogue box that advances on tap.
// Drive it with `script` = [{ pose, text }] (see src/content/habitChanScript.js).
// pose maps to /public/habitchan/<pose>.png.
const TYPE_MS = 26   // per-character typing speed

export default function VisualNovel({ script, onComplete, onSkip, name = 'Habit-Chan' }) {
  const safe = Array.isArray(script) && script.length ? script : [{ pose: 'happy', text: '' }]
  const [i, setI] = useState(0)
  const [count, setCount] = useState(0)             // characters of the current line revealed so far
  const beat = safe[Math.min(i, safe.length - 1)]
  const full = beat.text || ''
  const typed = full.slice(0, count)
  const lineDone = count >= full.length

  // Typewriter: advance the revealed-character count. Resets + restarts each beat.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional per-beat reset of the typewriter
    setCount(0)
    if (!full) return
    let n = 0
    const id = setInterval(() => {
      n += 1
      setCount(n)
      if (n >= full.length) clearInterval(id)
    }, TYPE_MS)
    return () => clearInterval(id)
  }, [i, full])

  function advance() {
    if (!lineDone) { setCount(full.length); return }   // first tap finishes the current line
    if (i + 1 < safe.length) setI(v => v + 1)
    else onComplete?.()
  }

  function handleSkip(e) {
    e.stopPropagation()
    ;(onSkip || onComplete)?.()
  }

  return (
    <div style={overlay} onClick={advance} role="dialog" aria-modal="true" aria-label={`${name} says: ${full}`}>
      {onSkip !== null && (
        <button style={skipBtn} onClick={handleSkip}>skip ▸</button>
      )}

      {/* Habit-Chan — normalized + feet-aligned (HabitChanSprite); bounces in ONCE,
          then just swaps her PNG per line. marginBottom keeps her feet off the box. */}
      <HabitChanSprite pose={beat.pose} charPx={405} style={{ marginBottom: 24 }} />

      {/* Dialogue box */}
      <div style={box} onClick={advance}>
        <div style={namePill}>{name} ✨</div>
        <div style={textStyle}>
          {typed}
          <span style={{ opacity: lineDone ? 1 : 0, marginLeft: 6, color: '#FF85A1' }}>▼</span>
        </div>
        <div style={progress}>{i + 1} / {safe.length}</div>
      </div>
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0, zIndex: 800,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
  padding: '0 14px 22px',
  background: 'rgba(43,28,62,0.62)',
  backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
  cursor: 'pointer', userSelect: 'none',
}
const skipBtn = {
  position: 'absolute', top: 14, right: 14, zIndex: 2,
  fontFamily: 'Mulish, sans-serif', fontSize: 15, fontWeight: 700, color: '#fff',
  background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.5)',
  borderRadius: 999, padding: '5px 14px', cursor: 'pointer',
}
const box = {
  width: '100%', maxWidth: 400, position: 'relative',
  background: '#FFF5FB', border: '3px solid #ECC0DE', borderRadius: 22,
  boxShadow: '0 14px 40px rgba(60,30,80,0.5)',
  padding: '20px 18px 16px', marginTop: 4,
}
const namePill = {
  position: 'absolute', top: -16, left: 18,
  fontFamily: "'Fredoka', cursive", fontSize: 19, color: '#fff',
  background: 'linear-gradient(90deg,#FF85A1,#C8A4E8)',
  borderRadius: 999, padding: '3px 16px',
  boxShadow: '0 3px 0 #D4607A',
}
const textStyle = {
  fontFamily: 'Mulish, sans-serif', fontSize: 20, lineHeight: 1.5, color: '#3D2B4F',
  marginTop: 8, minHeight: 64,
}
const progress = {
  fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#B9A7D6', textAlign: 'right', marginTop: 6,
}
