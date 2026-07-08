import { useRef, useState } from 'react'
import SlotPayTable from './SlotPayTable'
import {
  useReelRig, useTheaterCell, useSlotsWindow, WinLineOverlay, buildResultCols, computeBrew,
  canvasW, canvasH, LINE_COLORS,
  cabinetStyle, displayBox, infoBtn, displayLabel, displayValue, spinBtn, theaterStyle, winRowStyle, winPanelStyle,
} from './slots/rig'
import { playSpinStart, playLineWin, playCoinTick, playSlotWin, playNearMiss } from '../engine/sounds'

// ── The REWARD slot machine (the "bead" slots) ────────────────────────────────
// Plays a pre-resolved session (resolveSlotSession) in THEATER MODE: a full-window
// overlay with the biggest reels that fit — the Electron window goes landscape
// while it's open (useSlotsWindow) and the icons scale up with it. All the Pixi
// plumbing lives in slots/rig.jsx, shared with the casino machine.
export default function SlotMachine({ session, onComplete, jackpotPool = 0, footer = null }) {
  useSlotsWindow()
  const cell = useTheaterCell()
  const { hostRef, reelSetRef, ready, loadError } = useReelRig(cell)
  const skipRef = useRef(false)   // tapping the button during reveal fast-forwards it

  const [index, setIndex]   = useState(0)
  const [phase, setPhase]   = useState('ready')   // ready | spinning | revealing | between | done
  const [running, setRun]   = useState(0)      // run total across the session
  const [lastWin, setLastWin] = useState(0)    // coins from the most recent spin
  const [activeWins, setActiveWins] = useState([])
  const [shaking, setShaking] = useState(false)
  const [showPays, setShowPays] = useState(false)

  const current = session?.spins?.[index] || null
  if (!session) return null

  const spinCount = session.spinCount
  const spinsLeft = phase === 'between' ? spinCount - index - 1 : spinCount - index
  const W = canvasW(cell)

  // ── Spin one ──
  async function startSpin() {
    const reelSet = reelSetRef.current
    if (!reelSet) return
    if (phase === 'spinning') { try { reelSet.skipSpin() } catch { /* */ } return }
    if (phase !== 'ready' && phase !== 'between') return

    const idx = phase === 'between' ? index + 1 : index
    if (phase === 'between') setIndex(idx)
    const spin = session.spins[idx]

    setActiveWins([])
    setPhase('spinning')
    setShaking(true)
    setTimeout(() => setShaking(false), 360)
    playSpinStart()

    const brew = computeBrew(spin.grid, spin.coins)

    const spinPromise = reelSet.spin()
    if (brew.brewing) { try { reelSet.setAnticipation([3]) } catch { /* */ } }
    await new Promise(r => setTimeout(r, 240))
    reelSet.setResult(buildResultCols(spin.grid))
    await spinPromise

    if (brew.brewing && !brew.willWin) playNearMiss()
    reveal(idx)
  }

  // ── Reveal wins, count coins, advance ──
  async function reveal(idx) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms))
    setPhase('revealing')
    skipRef.current = false
    // Tapping the button during the reveal sets skipRef → every remaining pause is
    // skipped and the coin count jumps to the total, so you can spin again fast.
    const wait = async (ms) => { if (!skipRef.current) await sleep(ms) }
    const spin = session.spins[idx]
    const gained = spin.isJackpot ? session.jackpotAward : spin.coins
    const won = gained > 0
    setLastWin(gained)
    await wait(won ? 420 : 180)

    const wins = spin.wins || []
    if (wins.length) {
      const per = wins.length > 5 ? 360 : 620
      // Reveal each winning line one at a time (ring + connector via the SVG
      // overlay, in sync with its breakdown row). They ACCUMULATE and stay drawn
      // on the settled board — cleared by the next spin.
      for (let i = 0; i < wins.length; i++) {
        const color = LINE_COLORS[i % LINE_COLORS.length]
        setActiveWins(prev => [...prev, { ...wins[i], color }])
        playLineWin(i)
        await wait(per)
      }
    }

    if (won) {
      const start = running
      if (skipRef.current) {
        setRun(start + gained)
        if (spin.isJackpot) playSlotWin()
      } else {
        const steps = Math.min(gained, 26)
        for (let s = 1; s <= steps; s++) {
          if (skipRef.current) break
          await sleep(60)
          setRun(Math.round(start + (gained * s) / steps))
          if (s % 2) playCoinTick(s)
        }
        setRun(start + gained)
        if (spin.isJackpot) playSlotWin()
      }
    }

    // Hold the win on screen; a loss advances almost immediately.
    await wait(spin.isJackpot || spin.isBonus ? 1300 : (won ? 560 : 180))
    if (idx + 1 >= spinCount) { setPhase('done'); onComplete?.() }
    else setPhase('between')
  }

  // The one spin button is ALWAYS active: it lands a spin, skips a reveal, or
  // starts the next spin — whatever moves you forward fastest.
  function onSpinButton() {
    if (phase === 'spinning') { try { reelSetRef.current?.skipSpin() } catch { /* */ } return }
    if (phase === 'revealing') { skipRef.current = true; return }
    if (phase === 'ready' || phase === 'between') startSpin()
  }

  // ── Render (theater overlay) ──
  return (
    <div style={theaterStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: W + 26, maxWidth: '96vw' }}>
        <div style={{
          ...cabinetStyle, width: '100%',
          animation: shaking ? 'slot-shake 0.38s ease-out' : 'none',
        }}>

          {/* Top displays: jackpot · this spin's win · run total · pay table */}
          <div style={{ display: 'flex', gap: 6, width: '100%' }}>
            <div style={displayBox}>
              <div style={displayLabel}>★ Jackpot</div>
              <div style={{ ...displayValue, fontSize: 16 }}>💎{jackpotPool.toLocaleString()}</div>
            </div>
            <div style={displayBox}>
              <div style={displayLabel}>This spin</div>
              <div style={{ ...displayValue, color: '#FFF3C4' }}>
                <span key={lastWin} style={{ animation: 'coin-pop 0.25s ease-out', display: 'inline-block' }}>+{lastWin}</span>
              </div>
            </div>
            <div style={displayBox}>
              <div style={displayLabel}>Run total</div>
              <div style={{ ...displayValue, color: '#B7F0D2' }}>
                <span key={running} style={{ animation: 'coin-pop 0.25s ease-out', display: 'inline-block' }}>{running}</span>
              </div>
            </div>
            <button onClick={() => setShowPays(true)} aria-label="Pay table" title="Pay table" style={infoBtn}>ⓘ</button>
          </div>

          {/* Pixi reel canvas */}
          <div ref={hostRef} style={{
            width: W, height: canvasH(cell), position: 'relative',
            borderRadius: 14, overflow: 'hidden',
            boxShadow: 'inset 0 2px 14px rgba(0,0,0,0.8)',
            border: '2px solid #8A3350',
          }}>
            {!ready && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', padding: '0 16px',
                fontFamily: "'Fredoka', cursive", fontSize: loadError ? 12 : 15, color: loadError ? '#FF9DB0' : '#C88BA0',
              }}>{loadError ? `reels failed: ${loadError}` : 'loading reels…'}</div>
            )}
            <WinLineOverlay wins={activeWins} cell={cell} />
          </div>

          {/* Spin button — ALWAYS here (above the win list) so multiple wins listing
              below can never shove it around. */}
          {phase === 'done' ? (
            <div style={doneLabel}>✦ ALL DONE ✦</div>
          ) : (
            <button
              onClick={onSpinButton}
              disabled={!ready}
              style={{
                ...spinBtn, opacity: ready ? 1 : 0.6,
                ...(phase === 'spinning' ? { background: 'linear-gradient(180deg,#9B7EC8,#7B5EA7)', animation: 'none' } : {}),
              }}
            >
              {phase === 'spinning' ? 'STOP ⏹'
                : phase === 'revealing' ? 'SKIP ▸'
                  : phase === 'between' ? `✦ NEXT SPIN · ${spinsLeft} left`
                    : `✦ SPIN! · ${spinsLeft} left`}
            </button>
          )}

          {/* Win breakdown — BELOW the button */}
          {(phase === 'revealing' || phase === 'between' || phase === 'done') && current && (
            <div style={winPanelStyle}>
              {activeWins.map((w, i) => (
                <div key={i} style={winRowStyle}>
                  <span style={{ width: 10, height: 10, borderRadius: 5, flexShrink: 0, background: w.color || '#5CBFA0', boxShadow: `0 0 6px ${w.color || '#5CBFA0'}` }} />
                  {w.symbol?.img
                    ? <img src={w.symbol.img} alt={w.symbol.id} style={{ width: 22, height: 22, objectFit: 'contain' }} />
                    : <span>{w.symbol?.emoji}</span>}
                  <span style={{ flex: 1 }}>
                    {w.label}{w.hasWild ? <span style={{ color: '#C77FB0', fontSize: 13 }}> · WILD ×2</span> : null}
                  </span>
                  <span style={{ color: w.special ? '#C99A00' : '#5CBFA0', fontWeight: 700 }}>
                    {w.special ? `${w.special === 'jackpot' ? '💎 JACKPOT' : '🎰 BONUS'}!` : `+${w.coins}`}
                  </span>
                </div>
              ))}
              {current.summary && (
                <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#7B5EA7', textAlign: 'center', marginTop: activeWins.length ? 2 : 0 }}>
                  {current.summary}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Result banners */}
        {phase === 'done' && session.isJackpot && (<div style={banner('#FFD700', '#5C3A00')}>💎 JACKPOT! +{session.jackpotAward} 💎</div>)}
        {phase === 'done' && session.isBonus && (<div style={banner('#FFE9A0', '#5C3A00')}>⭐ BONUS ROUND! ⭐</div>)}
        {phase === 'done' && !session.isJackpot && !session.isBonus && (<div style={banner('#B4E0C8', '#1A5C3A')}>✦ YOU WON {running} COINS! ✦</div>)}

        {/* Host-provided continue button (e.g. "TAP TO SEE REWARDS") — inside the
            theater so it's reachable over the overlay. */}
        {footer && <div style={{ width: '100%', maxWidth: 380 }}>{footer}</div>}
      </div>

      {showPays && <SlotPayTable onClose={() => setShowPays(false)} />}

      <style>{`
        @keyframes spin-btn-pulse {
          0%, 100% { box-shadow: 0 5px 0 #9A2550, 0 8px 20px rgba(224,85,128,0.4); }
          50%       { box-shadow: 0 5px 0 #9A2550, 0 8px 28px rgba(224,85,128,0.7); }
        }
      `}</style>
    </div>
  )
}

const doneLabel = { fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#FFD700', letterSpacing: '0.08em', padding: '10px 0' }
function banner(bg, fg) {
  return {
    fontFamily: "'Fredoka', cursive", fontSize: 22, color: fg,
    background: bg, border: `3px solid ${fg}33`, borderRadius: 14,
    padding: '7px 20px', boxShadow: '0 4px 0 rgba(0,0,0,0.12)',
    animation: 'bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1)',
  }
}
