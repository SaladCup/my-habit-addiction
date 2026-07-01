import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { isCashable } from '../engine/gameLogic'
import { BeadDisplay, KawaiiButton, PixelPanel } from '../components/ui'
import VisualNovel from '../components/VisualNovel'
import { FIRST_VISIT_WALLET } from '../content/habitChanScript'
import { useFirstVisitPopIn } from '../hooks/useFirstVisitPopIn'

const backBtn = {
  width: 44, height: 44, borderRadius: 22, flexShrink: 0,
  background: 'rgba(255,255,255,0.7)', border: '2px solid #ECC0DE',
  color: '#9B3D6B', fontSize: 24, lineHeight: 1, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 2px 0 #DBA9CD', marginBottom: 8,
}

// NOTE: the wallet never STARTS a spin — spins are earned one per completed
// habit (the BEAD EARNED prompt is the only cash-in moment). This screen only
// shows what's in hand and what the next earned spin could unlock.
export default function WalletScreen() {
  const navigate = useNavigate()
  const { wallet, getBeadColor, settings } = useStore()
  const { show: showPopIn, dismiss: dismissPopIn } = useFirstVisitPopIn('wallet')

  const cashable = isCashable(wallet)

  const slotNames = settings.beadSlots.reduce((acc, s) => {
    acc[s.slot] = s.name
    return acc
  }, {})

  // Group beads by slot for display
  const groups = {}
  wallet.forEach(b => {
    const key = b.isGold ? 'gold' : `slot${b.slot}`
    // Color name alone is enough — no "Slot N" prefix (gold stays special).
    if (!groups[key]) groups[key] = { label: b.isGold ? '✨ Gold' : (slotNames[b.slot] || `Slot ${b.slot}`), beads: [], color: getBeadColor(b.slot, b.isGold), isGold: b.isGold, slot: b.slot }
    groups[key].beads.push(b)
  })

  return (
    <div style={{ padding: '20px 16px', minHeight: '100%' }}>
      {showPopIn && <VisualNovel script={FIRST_VISIT_WALLET} onComplete={dismissPopIn} onSkip={dismissPopIn} />}
      <button onClick={() => navigate(-1)} aria-label="Back" style={backBtn}>←</button>
      <h2 style={{
        fontFamily: "'Fredoka', cursive",
        fontSize: 38, color: '#3D2B4F',
        marginBottom: 4,
      }}>
        ✦ BEAD WALLET ✦
      </h2>
      <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#7B5EA7', marginBottom: 18 }}>
        {wallet.length} bead{wallet.length !== 1 ? 's' : ''} in hand
      </div>

      {wallet.length === 0 ? (
        <PixelPanel color="lavender" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🫙</div>
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 24, color: '#7B5EA7', marginBottom: 12 }}>
            No beads yet! Complete a habit to earn one.
          </div>
          <KawaiiButton variant="secondary" size="sm" onClick={() => navigate('/')}>
            ← Go earn beads
          </KawaiiButton>
        </PixelPanel>
      ) : (
        <>
          {/* INFORMATIONAL only — spins are earned by completing a habit; the
              cash-in choice appears on the BEAD EARNED prompt. This panel just
              previews what your matching beads will unlock on that next spin. */}
          {cashable.canCash && (
            <PixelPanel color="mint" style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 25, color: '#1A5C3A', marginBottom: 4 }}>
                ✦ YOUR NEXT SPIN
              </div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 18, color: '#3D6B52', marginBottom: 10 }}>
                Complete a habit to earn a spin — these beads are ready to cash in:
              </div>
              {cashable.options.map((opt, i) => (
                <div
                  key={i}
                  style={{
                    width: '100%',
                    background: i === 0 ? 'rgba(92,191,160,0.2)' : 'transparent',
                    border: `2px solid ${i === 0 ? '#5CBFA0' : '#C8B4E0'}`,
                    borderRadius: 12,
                    padding: '10px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 8,
                    fontFamily: 'Mulish, sans-serif',
                    fontSize: 22, color: '#3D2B4F',
                  }}
                >
                  <span>{opt.label}</span>
                  {i === 0 && (
                    <span style={{
                      fontFamily: "'Fredoka', cursive",
                      fontSize: 24, color: '#1A5C3A',
                      background: '#B4E0C8',
                      padding: '3px 8px', borderRadius: 999,
                    }}>BEST</span>
                  )}
                </div>
              ))}
            </PixelPanel>
          )}

          {/* All beads */}
          <PixelPanel color="cream" title="ALL BEADS IN HAND">
            {Object.entries(groups).map(([key, group]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{
                  fontFamily: "'Fredoka', cursive",
                  fontSize: 24, color: '#7B5EA7',
                  marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <BeadDisplay color={group.color} slot={group.slot} isGold={group.isGold} size="sm" />
                  {group.label} ×{group.beads.length}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {group.beads.map(b => (
                    <BeadDisplay
                      key={b.id}
                      color={getBeadColor(b.slot, b.isGold)}
                      slot={b.slot}
                      isGold={b.isGold}
                      size="md"
                      animate={b.isGold}
                    />
                  ))}
                </div>
              </div>
            ))}
          </PixelPanel>
        </>
      )}
    </div>
  )
}
