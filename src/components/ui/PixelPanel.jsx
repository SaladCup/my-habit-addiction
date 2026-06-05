const COLOR_MAP = {
  pink:     { bg: '#FFF0F5', border: '#FF85A1', shadow: '#D4607A' },
  lavender: { bg: '#F5F0FF', border: '#9B7EC8', shadow: '#6B4BAE' },
  mint:     { bg: '#F0FFF8', border: '#5CBFA0', shadow: '#3A9B80' },
  yellow:   { bg: '#FFFBF0', border: '#F5C44B', shadow: '#C8A800' },
  sky:      { bg: '#F0F8FF', border: '#4BC5F5', shadow: '#2A9BC8' },
  cream:    { bg: '#FFF5F9', border: '#C8B4E0', shadow: '#9B7EC8' },
}

export default function PixelPanel({
  children,
  title,
  color = 'cream',
  style = {},
  titleStyle = {},
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.cream
  return (
    <div style={{
      background: c.bg,
      border: `3px solid ${c.border}`,
      borderRadius: '16px',
      boxShadow: `4px 4px 0 ${c.shadow}`,
      padding: '16px',
      position: 'relative',
      ...style,
    }}>
      {title && (
        <div style={{
          fontFamily: "'Bunny Snaps', cursive",
          fontSize: '18px',
          color: c.shadow,
          marginBottom: '12px',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          ...titleStyle,
        }}>
          <span style={{ color: c.border }}>✦</span>
          {title}
          <span style={{ color: c.border }}>✦</span>
        </div>
      )}
      {children}
    </div>
  )
}
