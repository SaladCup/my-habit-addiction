import { useNavigate } from 'react-router-dom'

// The ONE standard page header — every screen renders its title through this so
// size/color/spacing match app-wide (the UX audit found hand-rolled h2s ranging
// 21–38px screen to screen). `back` adds the standard round back button
// (navigate(-1)); `center` centers the title; `sub` is the small line under it.
export default function ScreenHeader({ title, sub, back = false, center = false, style }) {
  const navigate = useNavigate()
  return (
    <div style={{ marginBottom: 12, ...style }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        justifyContent: center ? 'center' : 'flex-start',
        position: 'relative',
      }}>
        {back && (
          <button onClick={() => navigate(-1)} aria-label="Back" style={backBtn}>←</button>
        )}
        <h2 style={{
          fontFamily: "'Fredoka', cursive", fontSize: 28, color: '#3D2B4F',
          margin: 0, lineHeight: 1.15,
          textAlign: center ? 'center' : 'left',
        }}>
          {title}
        </h2>
      </div>
      {sub && (
        <div style={{
          fontFamily: 'Mulish, sans-serif', fontSize: 16, color: '#7B5EA7',
          marginTop: 3, textAlign: center ? 'center' : 'left',
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}

const backBtn = {
  width: 44, height: 44, borderRadius: 22, flexShrink: 0,
  background: 'rgba(255,255,255,0.7)', border: '2px solid #ECC0DE',
  color: '#9B3D6B', fontSize: 24, lineHeight: 1, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 2px 0 #DBA9CD',
}
