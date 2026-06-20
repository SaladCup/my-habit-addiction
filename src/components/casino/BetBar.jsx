// Shared bet control for every casino game: a stepper + quick chips, clamped to
// [min, balance]. Pure presentation — the parent owns the `bet` state and clamps on
// balance changes too.

import { CoinIcon } from '../ui'

const STEP = 10

export default function BetBar({ bet, setBet, balance, min = 10, disabled = false }) {
  const clamp = v => Math.max(min, Math.min(balance, Math.floor(v) || min))
  const set = v => setBet(clamp(v))
  const tooPoor = balance < min

  const chip = (label, next) => (
    <button
      type="button"
      disabled={disabled || tooPoor}
      onClick={() => set(next())}
      style={chipStyle(disabled || tooPoor)}
    >
      {label}
    </button>
  )

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, fontWeight: 700, color: '#7B5EA7', textAlign: 'center', marginBottom: 6 }}>
        YOUR BET
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginBottom: 8 }}>
        <button type="button" disabled={disabled || tooPoor} onClick={() => set(bet - STEP)} style={roundBtn(disabled || tooPoor)}>−</button>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Fredoka', cursive", fontSize: 30, color: '#E0A800',
          background: '#FFF5F9', border: '2px solid #ECC0DE', borderRadius: 14,
          minWidth: 0, padding: '4px 8px',
        }}>
          {(tooPoor ? 0 : bet).toLocaleString()}&nbsp;<CoinIcon size={20} />
        </div>
        <button type="button" disabled={disabled || tooPoor} onClick={() => set(bet + STEP)} style={roundBtn(disabled || tooPoor)}>+</button>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {chip('½',   () => Math.floor(bet / 2))}
        {chip('2×',  () => bet * 2)}
        {chip('Min', () => min)}
        {chip('Max', () => balance)}
      </div>
    </div>
  )
}

const roundBtn = off => ({
  width: 48, fontFamily: "'Fredoka', cursive", fontSize: 28, lineHeight: 1,
  color: '#fff', background: off ? '#D8D0E8' : '#C8B4E0',
  border: 'none', borderRadius: 14, cursor: off ? 'default' : 'pointer',
  boxShadow: off ? 'none' : '0 3px 0 #8B6BAE', flexShrink: 0,
})

const chipStyle = off => ({
  flex: 1, fontFamily: 'Mulish, sans-serif', fontSize: 16, fontWeight: 800,
  color: off ? '#B8A8D0' : '#7B5EA7',
  background: off ? '#F0EAF8' : '#F5EDFC', border: '2px solid #D8C4EC',
  borderRadius: 10, padding: '7px 0', cursor: off ? 'default' : 'pointer',
})
