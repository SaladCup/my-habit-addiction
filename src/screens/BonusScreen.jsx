import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getBonusStopAngle, formatBonusChallenge } from '../engine/gameLogic'
import { KawaiiButton, PixelPanel, TimerDisplay } from '../components/ui'
import BonusWheel from '../components/BonusWheel'

export default function BonusScreen() {
  const navigate = useNavigate()
  const { session, setSession, addBonusBead, resetSession, resetRewardChain, settings } = useStore()
  const { bonusResult, selectedHabit, bonusTimerEnd } = session

  // Bonus rounds are EARNED: the triggering spin pre-rolls bonusResult before
  // navigating here. A typed /bonus URL has none — without this guard it spun a
  // fresh wheel and could hand out unlimited free beads.
  // (Lazy state = a one-time mount snapshot; later session changes don't re-judge it.)
  const [validEntry] = useState(() => !!bonusResult)

  const [spinData] = useState(() =>
    bonusResult ? { stopAngle: getBonusStopAngle(bonusResult), result: bonusResult } : {})

  const [wheelDone, setWheelDone]       = useState(false)
  const [currentResult]                   = useState(spinData.result)
  const [currentAngle]                    = useState(spinData.stopAngle)
  const [timedOut, setTimedOut]           = useState(false)
  const [collectedBead, setCollectedBead] = useState(null)
  const [beadEarned, setBeadEarned]       = useState(false)
  const [pendingNav, setPendingNav]       = useState(null)

  useEffect(() => {
    if (!validEntry) navigate('/', { replace: true })
  }, [validEntry, navigate])

  // Timer expiry → head home after 2s (no bonus bead). The coin reward already
  // showed before the bonus round, so there's nothing more to see — end the chain.
  useEffect(() => {
    if (!timedOut || pendingNav) return
    const t = setTimeout(() => {
      resetRewardChain()
      resetSession()
      navigate('/')
    }, 2000)
    return () => clearTimeout(t)
  }, [timedOut, pendingNav, navigate, resetSession, resetRewardChain])

  function handleWheelDone() {
    // Coins were already collected by the spin that triggered the bonus.
    // This round is purely for the bonus bead.
    setWheelDone(true)
    setSession({ bonusResult: currentResult })
    // Free bead: collect it the moment the wheel lands on FREE
    if (currentResult === 'free') setCollectedBead(addBonusBead())
  }

  // Completing the bonus challenge earns a bead and returns home, where it drops
  // into your collection (the home screen animates `location.state.freeBead`).
  function handleDidIt() {
    setCollectedBead(addBonusBead())
    setBeadEarned(true)
    setPendingNav('/')
  }

  // Skip path: no bead. The coin reward already showed before the bonus round,
  // so just head home and end the chain.
  function handleBonusDone() {
    resetRewardChain()
    resetSession()
    navigate('/')
  }

  if (!validEntry) return null   // un-earned visit — redirecting home (guard effect above)

  // The "just a bit more" task is set globally in onboarding; fall back to the
  // habit's own activity/description for installs created before that screen existed.
  const bonusActivity = settings.bonusActivity
    || selectedHabit?.rewards?.bonusActivity
    || selectedHabit?.description
    || 'your quick task'
  const challengeText = formatBonusChallenge(currentResult, bonusActivity)

  return (
    <div style={{
      minHeight: '100%',
      padding: '24px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          fontFamily: "'Fredoka', cursive",
          fontSize: 32, color: '#FF85A1',
          marginBottom: 6,
          textShadow: '2px 2px 0 rgba(255,133,161,0.3)',
        }}>
          🎰 BONUS ROUND! 🎰
        </h2>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#9B7EC8' }}>
          Coins collected — now spin for a bonus bead! 🎁
        </div>
      </div>

      <BonusWheel
        key={currentResult}
        stopAngle={currentAngle}
        result={wheelDone ? currentResult : null}
        onDone={handleWheelDone}
      />

      {wheelDone && (
        <PixelPanel color="pink" style={{ width: '100%', maxWidth: 380 }}>
          {currentResult === 'free' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🎁</div>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 26, color: '#FF85A1', marginBottom: 12 }}>
                FREE BEAD!
              </div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#7B5EA7', marginBottom: 16 }}>
                Free bead added to your wallet! 🫙
              </div>
              {collectedBead && (
                <KawaiiButton variant="mint" size="lg" fullWidth
                  onClick={() => { resetSession(); navigate('/', { state: { freeBead: collectedBead } }) }}
                  style={{ animation: 'bounce-in 0.45s cubic-bezier(0.34,1.56,0.64,1)' }}
                >
                  ✨ COLLECT YOUR BEAD →
                </KawaiiButton>
              )}
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 27, color: '#FF85A1', marginBottom: 10 }}>
                ⚡ BONUS CHALLENGE
              </div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 24, color: '#3D2B4F', marginBottom: 14 }}>
                {challengeText}
              </div>

              {bonusTimerEnd && !timedOut && (
                <TimerDisplay endTime={bonusTimerEnd} onExpire={() => setTimedOut(true)} style={{ marginBottom: 12 }} />
              )}

              {timedOut && (
                <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#FF7675', textAlign: 'center', marginBottom: 8 }}>
                  Time&apos;s up! No bonus bead this time. Heading to rewards…
                </div>
              )}

              {beadEarned && (
                <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#5CBFA0', textAlign: 'center', marginBottom: 8 }}>
                  ✓ Bead added to your collection!
                </div>
              )}

              {!timedOut && !beadEarned && (
                <KawaiiButton variant="mint" size="md" fullWidth onClick={handleDidIt}>
                  ✓ I DID IT! (+1 bead)
                </KawaiiButton>
              )}
            </>
          )}
        </PixelPanel>
      )}

      {/* "Skip / I missed it" — only shows when challenge is active and no pending nav */}
      {wheelDone && currentResult !== 'free' && !pendingNav && !timedOut && (
        <KawaiiButton variant="secondary" size="md" onClick={handleBonusDone}>
          COLLECT &amp; CONTINUE →
        </KawaiiButton>
      )}

      {pendingNav === '/' && (
        <KawaiiButton
          variant="mint"
          size="xl"
          fullWidth
          onClick={() => { resetSession(); navigate('/', { state: { freeBead: collectedBead } }) }}
          style={{ animation: 'bounce-in 0.45s cubic-bezier(0.34,1.56,0.64,1)', maxWidth: 380 }}
        >
          ✨ COLLECT YOUR BEAD →
        </KawaiiButton>
      )}
    </div>
  )
}
