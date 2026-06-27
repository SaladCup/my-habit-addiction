import { PAYOUT_ROWS, SLOT_RULES, SLOT_SYMBOLS } from '../engine/slotEngine'

// A read-only "what pays what" sheet for the reward slot — the in-app version of
// the design pay table. Everything (names, payouts, wild ×mult, line count) comes
// straight from slotEngine so the sheet can never drift from the actual math.
const SYM = Object.fromEntries(SLOT_SYMBOLS.map(s => [s.id, s]))

export default function SlotPayTable({ onClose }) {
  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={card}>
        <div style={headerRow}>
          <span style={title}>✦ PAY TABLE ✦</span>
          <button onClick={onClose} aria-label="Close pay table" style={closeBtn}>✕</button>
        </div>

        <div style={scroll}>
          <div style={hint}>
            Match symbols left-to-right on any of the {SLOT_RULES.lineCount} lines. Each line pays on its own.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ ...payRow, background: 'transparent', paddingTop: 0, paddingBottom: 2 }}>
              <span style={{ flex: 1 }} />
              {[2, 3, 4, 5].map(n => <span key={n} style={colHead}>×{n}</span>)}
            </div>
            {PAYOUT_ROWS.map(row => (
              <div key={row.id} style={payRow}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <img src={row.img} alt={row.name} style={symImg} />
                  <span style={symName}>{row.name}</span>
                </span>
                {[2, 3, 4, 5].map(n => (
                  <span key={n} style={{ ...payCell, color: row.pays[n] ? '#FFE9A0' : '#5B4A78' }}>
                    {row.pays[n] ?? '–'}
                  </span>
                ))}
              </div>
            ))}
          </div>

          <div style={sectionTitle}>Special symbols</div>
          <div style={specialRow}>
            <img src={SYM.wild.img} alt="Wild" style={symImgLg} />
            <div>
              <div style={spName}>Wild</div>
              <div style={spDesc}>Substitutes for any symbol (lands on reels {SLOT_RULES.wildReels.join(', ')}) and <span style={spStrong}>doubles ×{SLOT_RULES.wildMult}</span> any line it completes.</div>
            </div>
          </div>
          <div style={specialRow}>
            <img src={SYM.bonus.img} alt="Bonus" style={symImgLg} />
            <div>
              <div style={spName}>Bonus</div>
              <div style={spDesc}><span style={spStrong}>{SLOT_RULES.bonusCount} Bonus</span> symbols anywhere → a free Bonus round.</div>
            </div>
          </div>
          <div style={specialRow}>
            <img src={SYM.seven.img} alt="Jackpot" style={symImgLg} />
            <div>
              <div style={spName}>Jackpot</div>
              <div style={spDesc}>Five Lucky 7s on the center line → the whole progressive pool. 💎</div>
            </div>
          </div>
        </div>

        <button onClick={onClose} style={doneBtn}>GOT IT ✦</button>
      </div>
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0, zIndex: 650,
  background: 'rgba(10,3,24,0.74)', backdropFilter: 'blur(3px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
}
const card = {
  width: '100%', maxWidth: 380, maxHeight: '88vh',
  display: 'flex', flexDirection: 'column',
  background: 'linear-gradient(180deg, #1A0A2E 0%, #2D1055 100%)',
  border: '2.5px solid #6B3FA0', borderRadius: 20,
  boxShadow: '0 0 0 1px rgba(155,126,200,0.3) inset, 0 14px 40px rgba(20,4,50,0.8)',
  padding: '14px 14px 16px',
  animation: 'bounce-in 0.32s cubic-bezier(0.34,1.56,0.64,1)',
}
const headerRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }
const title = { fontFamily: "'Fredoka', cursive", fontSize: 20, color: '#FFE9A0', letterSpacing: '0.06em', textShadow: '0 0 10px rgba(255,215,0,0.5)' }
const closeBtn = {
  width: 30, height: 30, borderRadius: 15, flexShrink: 0,
  background: 'rgba(255,255,255,0.08)', border: '1.5px solid #6B3FA0',
  color: '#D7C4F0', fontSize: 14, cursor: 'pointer', lineHeight: 1,
}
const scroll = { overflowY: 'auto', flex: 1, paddingRight: 4 }
const hint = { fontFamily: 'Mulish, sans-serif', fontSize: 12.5, color: '#B9A4DC', textAlign: 'center', margin: '2px 0 12px' }
const payRow = {
  display: 'flex', alignItems: 'center', gap: 6,
  background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '5px 9px',
}
const colHead = { width: 42, textAlign: 'right', fontFamily: 'Mulish, sans-serif', fontSize: 11, color: '#8E78B8', letterSpacing: '0.03em' }
const symImg = { width: 30, height: 30, objectFit: 'contain', flexShrink: 0 }
const symName = { fontFamily: "'Fredoka', cursive", fontSize: 14.5, color: '#F1E8FF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const payCell = { width: 42, textAlign: 'right', fontFamily: "'Fredoka', cursive", fontSize: 14 }
const sectionTitle = { fontFamily: "'Fredoka', cursive", fontSize: 15, color: '#FFD56B', letterSpacing: '0.04em', margin: '16px 2px 8px' }
const specialRow = {
  display: 'flex', alignItems: 'center', gap: 11,
  background: 'rgba(255,255,255,0.04)', borderRadius: 11, padding: '8px 10px', marginBottom: 6,
}
const symImgLg = { width: 42, height: 42, objectFit: 'contain', flexShrink: 0 }
const spName = { fontFamily: "'Fredoka', cursive", fontSize: 15, color: '#FFE9A0' }
const spDesc = { fontFamily: 'Mulish, sans-serif', fontSize: 12.5, color: '#CBBBE6', lineHeight: 1.45 }
const spStrong = { color: '#FFD56B', fontWeight: 700 }
const doneBtn = {
  marginTop: 12, padding: '11px 0', flexShrink: 0,
  fontFamily: "'Fredoka', cursive", fontSize: 18, color: '#fff', letterSpacing: '0.08em',
  background: 'linear-gradient(180deg, #FF85A1 0%, #E05580 100%)',
  border: 'none', borderRadius: 13, cursor: 'pointer', userSelect: 'none',
}
