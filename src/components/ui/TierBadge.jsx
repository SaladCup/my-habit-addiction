const TIER_CONFIG = {
  t1:      { label: 'T1',        bg: '#FFB7C5', color: '#7A2040', shadow: '#D4607A' },
  t2:      { label: 'T2',        bg: '#C8B4E0', color: '#3D1A6E', shadow: '#8B6BAE' },
  t3:      { label: 'T3',        bg: '#B4E0C8', color: '#1A5C3A', shadow: '#5CBFA0' },
  bonus:   { label: '🎰 BONUS',  bg: '#FFE9A0', color: '#5C3A00', shadow: '#C8A800' },
  jackpot: { label: '💎 JACKPOT',bg: '#FFD700', color: '#5C3A00', shadow: '#C8A800' },
}

export default function TierBadge({ tier, style = {} }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.t1
  return (
    <span style={{
      fontFamily: "'Fredoka', cursive",
      fontSize: '22px',
      fontWeight: 'bold',
      padding: '6px 16px',
      borderRadius: '999px',
      background: cfg.bg,
      color: cfg.color,
      boxShadow: `0 2px 0 ${cfg.shadow}`,
      display: 'inline-block',
      letterSpacing: '0.05em',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {cfg.label}
    </span>
  )
}
