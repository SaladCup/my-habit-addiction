import KawaiiButton from './KawaiiButton'

export default function WarningSplash({ onDismiss }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999,
      background: 'linear-gradient(160deg, #FFE9F5 0%, #F0E6FF 50%, #E6F5FF 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '28px 24px',
      textAlign: 'center',
      overflowY: 'auto',
      animation: 'slide-up 0.4s ease',
    }}>
      <div style={{
        fontFamily: "'Fredoka', cursive",
        fontSize: '28px',
        marginBottom: '12px',
      }}>⚠️</div>

      <h1 style={{
        fontFamily: "'Fredoka', cursive",
        fontSize: '32px',
        color: '#FF85A1',
        letterSpacing: '0.05em',
        marginBottom: '18px',
        lineHeight: 1.4,
      }}>
        WARNING
      </h1>

      <div style={{
        background: 'rgba(255,245,249,0.9)',
        border: '3px solid #C8B4E0',
        borderRadius: '20px',
        padding: '20px',
        boxShadow: '4px 4px 0 #9B7EC8',
        marginBottom: '22px',
        maxWidth: '352px',
      }}>
        <p style={{
          fontFamily: 'Mulish, sans-serif',
          fontSize: '14px',
          lineHeight: 1.55,
          color: '#3D2B4F',
        }}>
          This app reverse-engineers the most addictive machines ever built and points them at your habits. We use every psychological trick possible to transform you into the enhanced lab rat you were born to be.
        </p>
        <p style={{
          fontFamily: 'Mulish, sans-serif',
          fontSize: '13.5px',
          lineHeight: 1.55,
          color: '#7B5EA7',
          marginTop: '12px',
        }}>
          Side effects include: Being consistent for the first time in your life, physiological arousal at the sight of shiny beads, evangelizing <em>'the system'</em> to everyone you love, risking it all, losing everything, then doing your habits again for one more spin.
        </p>
        <p style={{
          fontFamily: "'Fredoka', cursive",
          fontSize: '23px',
          color: '#FF85A1',
          marginTop: '14px',
        }}>
          You have been warned.
        </p>
      </div>

      <KawaiiButton variant="primary" size="lg" onClick={onDismiss}>
        I Accept My Fate ✨
      </KawaiiButton>

      <p style={{
        fontFamily: 'Mulish, sans-serif',
        fontSize: '11px',
        color: '#9B7EC8',
        marginTop: '16px',
        opacity: 0.7,
      }}>
        Based on The Habit Casino System by SpoonFedStudy
      </p>
    </div>
  )
}
