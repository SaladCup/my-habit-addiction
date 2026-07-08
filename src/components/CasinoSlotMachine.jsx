import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import SlotPayTable from './SlotPayTable'
import BetBar from './casino/BetBar'
import { CoinIcon } from './ui'
import { resolveCasinoSpin } from '../engine/slotEngine'
import {
  useReelRig, useTheaterCell, useSlotsWindow, WinLineOverlay, buildResultCols, computeBrew,
  canvasW, canvasH, LINE_COLORS,
  cabinetStyle, displayBox, infoBtn, displayLabel, displayValue, spinBtn, theaterStyle, winRowStyle, winPanelStyle,
} from './slots/rig'
import { playSpinStart, playLineWin, playCoinTick, playSlotWin, playNearMiss } from '../engine/sounds'

const MIN_BET = 10

// ── The CASINO slot machine ───────────────────────────────────────────────────
// The SAME machine as the reward slots (same rig, 21 paylines, wilds, rings +
// connector lines, theater mode) but you BET: each spin wagers your stake and
// wins scale with it (resolveCasinoSpin, RTP 0.95 — the same ~5% house edge as
// the other casino games). Winnings are banked at resolve time (abandon-safe).
export default function CasinoSlotMachine() {
  const navigate = useNavigate()
  useSlotsWindow()
  const cell = useTheaterCell()
  const { hostRef, reelSetRef, ready, loadError } = useReelRig(cell)
  const { getCoinsAvailable, placeBet, settleBet } = useStore()
  const balance = getCoinsAvailable()

  const skipRef = useRef(false)
  const [betRaw, setBet]  = useState(() => Math.min(50, Math.max(MIN_BET, balance)))
  const [phase, setPhase] = useState('ready')     // ready | spinning | revealing
  const [spin, setSpin]   = useState(null)        // current resolved spin (scaled wins)
  const [lastWin, setLastWin] = useState(0)
  const [net, setNet]     = useState(0)           // session net (wins − stakes)
  const [activeWins, setActiveWins] = useState([])
  const [shaking, setShaking] = useState(false)
  const [showPays, setShowPays] = useState(false)

  const bet = Math.max(MIN_BET, Math.min(balance, betRaw))
  const tooPoor = balance < MIN_BET
  const W = canvasW(cell)

  async function startSpin() {
    const reelSet = reelSetRef.current
    if (!reelSet || phase !== 'ready') return
    if (tooPoor || bet < MIN_BET || bet > balance) return
    if (!placeBet(bet, 'slots')) return

    // Resolve + BANK the outcome up-front (abandon-safe: leaving mid-animation
    // keeps the win) — the reels then animate to the already-decided result.
    const result = resolveCasinoSpin(bet)
    if (result.coins > 0) settleBet(result.coins, 'slots')
    setNet(n => n + result.coins - bet)
    setSpin(result)

    setActiveWins([])
    setLastWin(0)
    setPhase('spinning')
    setShaking(true)
    setTimeout(() => setShaking(false), 360)
    playSpinStart()

    const brew = computeBrew(result.grid, result.coins)
    const spinPromise = reelSet.spin()
    if (brew.brewing) { try { reelSet.setAnticipation([3]) } catch { /* */ } }
    await new Promise(r => setTimeout(r, 240))
    reelSet.setResult(buildResultCols(result.grid))
    await spinPromise

    if (brew.brewing && !brew.willWin) playNearMiss()
    reveal(result)
  }

  async function reveal(result) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms))
    setPhase('revealing')
    skipRef.current = false
    const wait = async (ms) => { if (!skipRef.current) await sleep(ms) }
    const won = result.coins > 0
    await wait(won ? 420 : 160)

    const wins = result.wins || []
    if (wins.length) {
      const per = wins.length > 5 ? 360 : 620
      for (let i = 0; i < wins.length; i++) {
        const color = LINE_COLORS[i % LINE_COLORS.length]
        setActiveWins(prev => [...prev, { ...wins[i], color }])
        playLineWin(i)
        await wait(per)
      }
    }

    if (won) {
      if (skipRef.current) {
        setLastWin(result.coins)
      } else {
        const steps = Math.min(result.coins, 26)
        for (let s = 1; s <= steps; s++) {
          if (skipRef.current) break
          await sleep(60)
          setLastWin(Math.round((result.coins * s) / steps))
          if (s % 2) playCoinTick(s)
        }
        setLastWin(result.coins)
      }
      if (result.coins >= bet * 20) playSlotWin()   // big-multiple fanfare
    }

    await wait(won ? 420 : 140)
    setPhase('ready')
  }

  function onSpinButton() {
    if (phase === 'spinning') { try { reelSetRef.current?.skipSpin() } catch { /* */ } return }
    if (phase === 'revealing') { skipRef.current = true; return }
    startSpin()
  }

  const spinning = phase !== 'ready'

  return (
    <div style={theaterStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: W + 26, maxWidth: '96vw' }}>

        {/* top bar: back to lobby + title */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" onClick={() => navigate('/casino')} style={backBtn}>← Lobby</button>
          <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#FFF0F8', textShadow: '0 2px 8px rgba(90,20,50,0.6)' }}>🎰 Slots</div>
          <div style={{ width: 74 }} />
        </div>

        <div style={{
          ...cabinetStyle, width: '100%',
          animation: shaking ? 'slot-shake 0.38s ease-out' : 'none',
        }}>

          {/* Displays: balance · win · session net · pay table */}
          <div style={{ display: 'flex', gap: 6, width: '100%' }}>
            <div style={displayBox}>
              <div style={displayLabel}>Balance</div>
              <div style={{ ...displayValue, fontSize: 16 }}>{balance.toLocaleString()}</div>
            </div>
            <div style={displayBox}>
              <div style={displayLabel}>Win</div>
              <div style={{ ...displayValue, color: '#FFF3C4' }}>
                <span key={lastWin} style={{ animation: 'coin-pop 0.25s ease-out', display: 'inline-block' }}>+{lastWin.toLocaleString()}</span>
              </div>
            </div>
            <div style={displayBox}>
              <div style={displayLabel}>Session</div>
              <div style={{ ...displayValue, color: net >= 0 ? '#B7F0D2' : '#FFB3C0' }}>
                {net >= 0 ? '+' : '−'}{Math.abs(net).toLocaleString()}
              </div>
            </div>
            <button onClick={() => setShowPays(true)} aria-label="Pay table" title="Pay table" style={infoBtn}>ⓘ</button>
          </div>

          {/* Reels */}
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

          {/* Spin button — always actionable: land / skip / spin again */}
          <button
            onClick={onSpinButton}
            disabled={!ready || (!spinning && (tooPoor || bet > balance))}
            style={{
              ...spinBtn, opacity: ready ? 1 : 0.6,
              ...(phase === 'spinning' ? { background: 'linear-gradient(180deg,#9B7EC8,#7B5EA7)', animation: 'none' } : {}),
            }}
          >
            {phase === 'spinning' ? 'STOP ⏹'
              : phase === 'revealing' ? 'SKIP ▸'
                : tooPoor ? 'NOT ENOUGH COINS'
                  : <>✦ SPIN FOR {bet.toLocaleString()} <CoinIcon /></>}
          </button>

          {/* Bet bar (locked while a spin is in flight) */}
          <div style={{ width: '100%', opacity: spinning ? 0.55 : 1, pointerEvents: spinning ? 'none' : 'auto' }}>
            <BetBar bet={bet} setBet={setBet} balance={balance} min={MIN_BET} disabled={spinning} />
          </div>

          {/* Win breakdown */}
          {phase !== 'spinning' && spin && (activeWins.length > 0 || phase === 'revealing') && (
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
                  <span style={{ color: '#5CBFA0', fontWeight: 700 }}>+{w.coins.toLocaleString()}</span>
                </div>
              ))}
              {spin.summary && (
                <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#7B5EA7', textAlign: 'center', marginTop: activeWins.length ? 2 : 0 }}>
                  {spin.summary}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showPays && (
        <SlotPayTable
          onClose={() => setShowPays(false)}
          note="Base pays shown — your win scales with your bet size."
        />
      )}

      <style>{`
        @keyframes spin-btn-pulse {
          0%, 100% { box-shadow: 0 5px 0 #9A2550, 0 8px 20px rgba(224,85,128,0.4); }
          50%       { box-shadow: 0 5px 0 #9A2550, 0 8px 28px rgba(224,85,128,0.7); }
        }
      `}</style>
    </div>
  )
}

const backBtn = {
  fontFamily: 'Mulish, sans-serif', fontSize: 15, fontWeight: 700, color: '#7B5EA7',
  background: 'rgba(255,255,255,0.85)', border: '2px solid #D8C4EC', borderRadius: 12, padding: '6px 12px', cursor: 'pointer',
}
