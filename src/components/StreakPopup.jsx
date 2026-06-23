import { useEffect, useRef, useState } from 'react'
import useStore from '../store/useStore'
import { KawaiiButton, CoinIcon } from './ui'
import { playStreak, playStreakBreak } from '../engine/sounds'
import VisualNovel from './VisualNovel'
import { REACTION_STREAK_BREAK } from '../content/habitChanScript'

// Per-day streak messages (Lauren's voice). Day 0 = broken.
const STREAK_MSG = {
  0:  "You broke your streak! No streak bonus for you today HA! You need more addiction! Play so much for maximum addiction, cutie <3",
  1:  "Day one of beautiful addiction. The beads are SO happy you came. 💕",
  2:  "Wow you came back again! You're beautiful. Always remember the first day of addiction.",
  3:  "Three perfect days of getting sweet sweet beads. You love the beads. Yes.",
  4:  "Four days? Well on your way to addiction.",
  5:  "An entire work week of beads! You are the professional bead acquirer of your dreams!",
  6:  "Day 6 of earning beads. Someone is forming a magical habit!",
  7:  "A whole week of addiction. You truly are the most addicted today than you have been all week. That makes the beads very happy.",
  8:  "Another week? You can't stop now.",
  9:  "Yes. YES!!",
  10: "You need the beads and the beads need you.",
  11: "Are you feeling lucky?",
  12: "On the twelveth day of Beadmas, my true love gave to me: Addiction to my habits!",
  13: "Today is unlucky. Don't spin Tier 3.",
  14: "Is it gambling if it's good for me?",
}
const EXTRA_MSG = [
  (d) => `Day ${d}. You and the beads are one now. ✨`,
  (d) => `Day ${d}?! The beads whisper your name in their sleep.`,
  (d) => `Day ${d} of pure devotion. Simply stunning, cutie.`,
]
const streakMessage = (day) => STREAK_MSG[day] || EXTRA_MSG[day % EXTRA_MSG.length](day)

export default function StreakPopup({ onClose }) {
  const checkInStreak = useStore(s => s.checkInStreak)
  const [status, setStatus] = useState(null)
  const [phase, setPhase] = useState('day')   // continued: 'day'. broken: 'streak'→'crack'→'broken'
  const [showStreakBreakToast, setShowStreakBreakToast] = useState(false)
  const ranRef = useRef(false)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    if (!ranRef.current) {
      ranRef.current = true
      const s = checkInStreak()
      if (!s) { onClose(); return undefined }   // already checked in today
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount check-in; drives the popup's reveal/animation
      setStatus(s)
      if (s.broken && s.prevStreak >= 1) {
        setPhase('streak')
        setTimeout(() => { if (aliveRef.current) { setPhase('crack'); playStreakBreak() } }, 1300)
        setTimeout(() => { if (aliveRef.current) { setPhase('broken'); setShowStreakBreakToast(true) } }, 2600)
      } else {
        setPhase('day')
        playStreak()
      }
    }
    return () => { aliveRef.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only check-in; guarded against StrictMode double-run by ranRef
  }, [])

  if (!status) return null

  const day = status.newStreak
  const showBroken = phase === 'broken'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(40,28,54,0.78)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22,
    }}>
      <div style={{
        width: '100%', maxWidth: 340,
        background: 'linear-gradient(180deg, #FFF5FB 0%, #FBE6F4 100%)',
        border: '3px solid #F1B2D6', borderRadius: 28,
        boxShadow: '0 0 0 5px rgba(255,255,255,0.6), 0 18px 44px rgba(60,40,80,0.5)',
        padding: '26px 22px 22px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        textAlign: 'center', overflow: 'hidden',
        animation: 'bounce-in 0.45s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* ── BROKEN streak: previous number cracks & falls, then day 0 ── */}
        {status.broken && status.prevStreak >= 1 ? (
          showBroken ? (
            <>
              {/* placeholder for the crying anime girl — drop a gif at
                  public/ui/streak_broken.gif and swap this <img> in */}
              <div style={{ fontSize: 76, lineHeight: 1, animation: 'bounce-in 0.4s ease-out' }}>😭</div>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#C2415F' }}>DAY 0</div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 15, color: '#7B5EA7', lineHeight: 1.4 }}>
                {STREAK_MSG[0]}
              </div>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 18, color: '#C77FB0' }}>💔 No bonus today</div>
              <KawaiiButton variant="secondary" size="md" fullWidth onClick={onClose}>
                Ugh, fine 😤
              </KawaiiButton>
            </>
          ) : (
            <>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 16, color: '#9B7EC8', fontWeight: 800, letterSpacing: '0.08em' }}>
                YOUR STREAK
              </div>
              <div style={{ position: 'relative', height: 150, width: '100%', display: 'grid', placeItems: 'center' }}>
                {phase === 'crack' ? (
                  <>
                    <span className="crackL" style={crackNum}>{status.prevStreak}</span>
                    <span className="crackR" style={crackNum}>{status.prevStreak}</span>
                  </>
                ) : (
                  <span style={{ ...crackNum, position: 'static', animation: 'streakShake 0.5s 0.7s ease-in-out' }}>
                    {status.prevStreak}
                  </span>
                )}
              </div>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 20, color: '#9B3D6B', minHeight: 26 }}>
                {phase === 'crack' ? '…oh no.' : 'day streak 🔥'}
              </div>
            </>
          )
        ) : (
          /* ── CONTINUED streak ── */
          <>
            <div style={{ fontSize: 54, lineHeight: 1 }}>🔥</div>
            <div style={{
              fontFamily: "'Fredoka', cursive", fontSize: 46, lineHeight: 1, color: '#E0568E',
              textShadow: '0 2px 0 rgba(200,90,140,0.3)',
            }}>
              DAY {day}
            </div>
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 15, color: '#7B5EA7', lineHeight: 1.4 }}>
              {streakMessage(day)}
            </div>
            <div style={{
              fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#1A5C3A',
              background: '#D9F3E5', border: '2px solid #9CDcc0', borderRadius: 999, padding: '5px 18px',
            }}>
              <CoinIcon /> +{status.bonus} streak bonus!
            </div>
            <KawaiiButton variant="mint" size="md" fullWidth onClick={onClose}>
              ✨ Let's get addicted →
            </KawaiiButton>
          </>
        )}
      </div>

      {showStreakBreakToast && (
        <VisualNovel
          script={REACTION_STREAK_BREAK}
          onComplete={() => setShowStreakBreakToast(false)}
          onSkip={() => setShowStreakBreakToast(false)}
        />
      )}

      <style>{`
        @keyframes streakShake {
          0%, 100% { transform: rotate(0); }
          25% { transform: rotate(-4deg); } 75% { transform: rotate(4deg); }
        }
        .crackL, .crackR { position: absolute; }
        .crackL { clip-path: inset(0 50% 0 0); animation: crackFallL 1.2s cubic-bezier(0.5,0,0.9,0.6) forwards; }
        .crackR { clip-path: inset(0 0 0 50%); animation: crackFallR 1.2s cubic-bezier(0.5,0,0.9,0.6) forwards; }
        @keyframes crackFallL {
          0%   { transform: translate(0,0) rotate(0); opacity: 1; }
          14%  { transform: translate(-7px,-4px) rotate(-4deg); opacity: 1; }
          100% { transform: translate(-70px, 520px) rotate(-46deg); opacity: 0; }
        }
        @keyframes crackFallR {
          0%   { transform: translate(0,0) rotate(0); opacity: 1; }
          14%  { transform: translate(7px,-4px) rotate(4deg); opacity: 1; }
          100% { transform: translate(70px, 520px) rotate(46deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

const crackNum = {
  fontFamily: "'Fredoka', cursive", fontSize: 120, lineHeight: 1, color: '#E0568E',
  textShadow: '0 3px 0 rgba(200,90,140,0.35)',
}
