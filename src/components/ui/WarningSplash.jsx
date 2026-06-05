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
      padding: '32px 24px',
      textAlign: 'center',
      animation: 'slide-up 0.4s ease',
    }}>
      {/* Floating decor */}
      {['✦','♡','⭐','✿','♡','✦'].map((s, i) => (
        <span key={i} style={{
          position: 'absolute',
          fontSize: `${14 + i * 4}px`,
          color: ['#FFB7C5','#C8B4E0','#FFE9A0','#B4E0C8','#FF85A1','#B4D4FF'][i],
          opacity: 0.4,
          left: `${10 + i * 15}%`,
          top:  `${8 + (i % 3) * 12}%`,
          animation: `float ${3 + i * 0.5}s ease-in-out ${-i * 0.4}s infinite`,
          pointerEvents: 'none',
        }}>{s}</span>
      ))}

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
        marginBottom: '24px',
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
        marginBottom: '28px',
        maxWidth: '340px',
      }}>
        <p style={{
          fontFamily: 'Mulish, sans-serif',
          fontSize: '14px',
          lineHeight: 1.7,
          color: '#3D2B4F',
        }}>
          This app reverse-engineers the most addictive machines ever built and points them at your habits.
        </p>
        <p style={{
          fontFamily: 'Mulish, sans-serif',
          fontSize: '13px',
          lineHeight: 1.7,
          color: '#7B5EA7',
          marginTop: '12px',
        }}>
          Side effects include: actually becoming consistent, embarrassing excitement about colored beads, and explaining <em>"the system"</em> to everyone you know.
        </p>
        <p style={{
          fontFamily: "'Fredoka', cursive",
          fontSize: '24px',
          color: '#FF85A1',
          marginTop: '16px',
        }}>
          You have been warned. 💅
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
        Based on The Slot Machine Habit System by SpoonFedStudy
      </p>
    </div>
  )
}
