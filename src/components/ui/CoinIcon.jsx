// Inline gold-coin icon — replaces the 🪙 emoji everywhere coins are shown.
// Defaults to 1em so it scales with the surrounding text and drops cleanly into
// any label, balance pill, or button. Pass `size` (number = px, or any CSS size)
// to override, e.g. <CoinIcon size={24} />.
export default function CoinIcon({ size = '1em', style }) {
  return (
    <img
      src="/ui/coin.png"
      alt="coins"
      draggable={false}
      style={{
        height: size,
        width: size,
        objectFit: 'contain',
        verticalAlign: '-0.18em',   // sit nicely on the text baseline
        display: 'inline-block',
        userSelect: 'none',
        ...style,
      }}
    />
  )
}
