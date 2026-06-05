import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { spinBonusWheel, getBonusStopAngle, formatBonusChallenge } from '../engine/gameLogic'
import { KawaiiButton, PixelPanel, TimerDisplay } from '../components/ui'
import BonusWheel from '../components/BonusWheel'

export default function BonusScreen() {
  const navigate = useNavigate()
  const { session, setSession, addBonusBead, resetSession } = useStore()
  const { bonusResult, activeTier, selectedHabit, bonusTimerEnd } = session

  const [spinData] = useState(() => {
    if (bonusResult) {
      return { stopAngle: getBonusStopAngle(bonusResult), result: bonusResult }
    }
    return spinBonusWheel()
  })

  const [wheelDone, setWheelDone]       = useState(false)
  const [currentResult]                   = useState(spinData.result)
  const [currentAngle]                    = useState(spinData.stopAngle)
  const [timedOut, setTimedOut]           = useState(false)
  const [collectedBead, setCollectedBead] = useState(null)
  const [beadEarned, setBeadEarned]       = useState(false)
  const [pendingNav, setPendingNav]       = useState(null)

  // Free bead: collect it immediately when wheel lands on FREE
  useEffect(() => {
    if (!wheelDone || currentResult !== 'free') return
    const bead = addBonusBead()
    setCollectedBead(bead)
  }, [wheelDone, currentResult])

  // Bug fix #3: timer expiry auto-navigates to /reward after 2s
  // (user keeps original spin's coins but earns no bonus bead)
  useEffect(() => {
    if (!timedOut || pendingNav) return
    const t = setTimeout(() => {
      setSession({ phase: 'reward' })
      navigate('/reward')
    }, 2000)
    return () => clearTimeout(t)
  }, [timedOut, pendingNav])

  function handleWheelDone() {
    // Coins were already collected by the spin that triggered the bonus.
    // This round is purely for the bonus bead.
    setWheelDone(true)
    setSession({ bonusResult: currentResult })
  }

  // Completing the bonus challenge earns a bead and returns home, where it drops
  // into your collection (the home screen animates `location.state.freeBead`).
  function handleDidIt() {
    setCollectedBead(addBonusBead())
    setBeadEarned(true)
    setPendingNav('/')
  }

  // "I Missed It" / skip path: go straight to reward with original spin coins only
  function handleBonusDone() {
    setSession({ phase: 'reward' })
    setPendingNav('/reward')
  }

  const challengeText = formatBonusChallenge(currentResult, selectedHabit)

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

      {pendingNav && (
        <KawaiiButton
          variant={pendingNav === '/' ? 'mint' : 'primary'}
          size="xl"
          fullWidth
          onClick={() => {
            if (pendingNav === '/') { resetSession(); navigate('/', { state: { freeBead: collectedBead } }) }
            else { setSession({ phase: 'reward' }); navigate('/reward') }
          }}
          style={{ animation: 'bounce-in 0.45s cubic-bezier(0.34,1.56,0.64,1)', maxWidth: 380 }}
        >
          {pendingNav === '/' ? '✨ COLLECT YOUR BEAD →' : '✨ SEE YOUR REWARDS →'}
        </KawaiiButton>
      )}
    </div>
  )
}
