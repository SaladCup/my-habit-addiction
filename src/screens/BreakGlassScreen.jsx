import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { KawaiiButton } from '../components/ui'

// The deterrent override: tap your way through rounds of 100, 90, 80 … down to
// 10 (550 taps total), confirming between each. Finishing grants a fixed window
// of access despite being out of coins. Pure friction — no coins required.
const ROUNDS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]
const GRANT_MINUTES = 20

export default function BreakGlassScreen() {
  const navigate = useNavigate()
  const rbStartBreakGlass = useStore(s => s.rbStartBreakGlass)

  const [round, setRound] = useState(0)          // index into ROUNDS
  const [tapsLeft, setTapsLeft] = useState(ROUNDS[0])
  const [phase, setPhase] = useState('tapping')  // 'tapping' | 'confirm' | 'done'
  const circleRef = useRef(null)

  function tap() {
    if (phase !== 'tapping') return
    const next = Math.max(0, tapsLeft - 1)        // pure update; never negative
    setTapsLeft(next)
    if (next <= 0) setPhase('confirm')            // phase change OUTSIDE the updater
    // self-contained squish — always completes (no stuck-shrunk state)
    circleRef.current?.animate(
      [{ transform: 'scale(0.93)' }, { transform: 'scale(1)' }],
      { duration: 130, easing: 'ease-out' },
    )
  }

  function confirmRound() {
    const nextRound = round + 1
    if (nextRound >= ROUNDS.length) {
      rbStartBreakGlass(GRANT_MINUTES)
      try { window.desktop?.cover?.(false) } catch { /* non-fatal */ }
      setPhase('done')
    } else {
      setRound(nextRound)
      setTapsLeft(ROUNDS[nextRound])
      setPhase('tapping')
    }
  }

  const totalRounds = ROUNDS.length
  const doneTaps = ROUNDS.slice(0, round).reduce((a, b) => a + b, 0) + (ROUNDS[round] - tapsLeft)
  const allTaps = ROUNDS.reduce((a, b) => a + b, 0)
  const pct = Math.round((doneTaps / allTaps) * 100)

  return (
    <div style={{ minHeight: '100%', padding: '24px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
      <h2 style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#3D2B4F', margin: 0 }}>
        🔨 Break Glass
      </h2>
      <p style={{ fontFamily: 'Mulish, sans-serif', fontSize: 17, color: '#9B7EC8', maxWidth: 320, margin: 0, lineHeight: 1.5 }}>
        Out of coins but really need in? Tap your way through. It gets easier each round — that's the deal.
      </p>

      {phase === 'done' ? (
        <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <div style={{ fontSize: 64 }}>✨</div>
          <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 26, color: '#3D2B4F' }}>
            You broke the glass!
          </div>
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 18, color: '#7B5EA7', maxWidth: 300, lineHeight: 1.5 }}>
            Your Brainrots are unlocked for <b>{GRANT_MINUTES} minutes</b>. Then they lock again.
          </div>
          <KawaiiButton variant="primary" size="lg" onClick={() => navigate('/rotblock')}>
            Continue →
          </KawaiiButton>
        </div>
      ) : (
        <>
          {/* round indicator */}
          <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 19, color: '#7B5EA7', marginTop: 6 }}>
            Round {round + 1} of {totalRounds} · {ROUNDS[round]} taps
          </div>

          {/* the big tap target */}
          <button
            ref={circleRef}
            onPointerDown={tap}
            disabled={phase !== 'tapping'}
            style={{
              width: 230, height: 230, borderRadius: '50%', border: 'none', marginTop: 8,
              background: phase === 'confirm' ? '#CDEFD8' : 'radial-gradient(circle at 38% 32%, #FFC7DE, #FF85A1)',
              boxShadow: phase === 'confirm' ? '0 6px 18px rgba(120,200,150,0.4)' : '0 8px 22px rgba(255,133,161,0.55)',
              color: '#fff', cursor: phase === 'tapping' ? 'pointer' : 'default',
              fontFamily: "'Fredoka', cursive", userSelect: 'none', touchAction: 'manipulation',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {phase === 'confirm' ? (
              <span style={{ fontSize: 30, color: '#2E7D52' }}>Round done!</span>
            ) : (
              <>
                <span style={{ fontSize: 82, fontWeight: 600, lineHeight: 1 }}>{tapsLeft}</span>
                <span style={{ fontSize: 18, opacity: 0.92, marginTop: 4 }}>taps left</span>
              </>
            )}
          </button>

          {phase === 'confirm' && (
            <KawaiiButton variant="mint" size="lg" onClick={confirmRound} style={{ marginTop: 6 }}>
              {round + 1 >= totalRounds ? 'Finish 🔓' : 'OK → next round'}
            </KawaiiButton>
          )}

          {/* overall progress */}
          <div style={{ width: 260, marginTop: 14 }}>
            <div style={{ height: 12, borderRadius: 8, background: '#EFE6F6', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#FFB3CE,#FF85A1)', transition: 'width 120ms ease' }} />
            </div>
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#B79DD6', marginTop: 6 }}>
              {doneTaps} / {allTaps} taps
            </div>
          </div>

          <button
            onClick={() => navigate(-1)}
            style={{ marginTop: 10, background: 'none', border: 'none', color: '#B79DD6', fontFamily: 'Mulish, sans-serif', fontSize: 16, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Never mind, take me back
          </button>
        </>
      )}
    </div>
  )
}
