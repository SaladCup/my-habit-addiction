import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore, { KAWAII_COLORS, PERSIST_VERSION } from '../store/useStore'
import { TIER_COINS, BONUS_TIERS } from '../engine/gameLogic'
import { playWin } from '../engine/sounds'
import { KawaiiButton, PixelPanel, ScreenHeader } from '../components/ui'
import VisualNovel from '../components/VisualNovel'
import { FIRST_VISIT_SETTINGS } from '../content/habitChanScript'
import { useFirstVisitPopIn } from '../hooks/useFirstVisitPopIn'

// The localStorage key Zustand persists under (see useStore persist config).
const STORE_KEY = 'my-habit-addiction'

// ── Hardened import: NEVER trust the file. An imported save is fully attacker-
// controlled JSON written into our own persistence and reloaded, so it's a stored-
// data trust boundary. Instead of writing the raw text, we rebuild a clean blob from
// an ALLOWLIST of the real persisted slices (must mirror useStore partialize), strip
// __proto__/constructor/prototype at every level, cap sizes, and recompute the coin
// balance from the log so a tampered coinTotals can't forge coins. Honest files round-
// trip unchanged (the allowlist IS the partialize set; caps sit far above real data). ──
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype']
const COIN_LOG_CAP = 500          // mirrors COIN_LOG_MAX in useStore
const ARRAY_CAP    = 100000       // generous upper bound; real saves are far smaller
const STR_CAP      = 2000         // cap any string field (labels, notes, names…)

// Recursively copy ONLY own, safe, JSON-ish values. Drops dangerous keys at every
// object level, caps array + string length, rejects functions/symbols.
function sanitizeValue(v, depth = 0) {
  if (depth > 12) return null                       // guard pathological nesting
  if (v === null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v.length > STR_CAP ? v.slice(0, STR_CAP) : v
  if (Array.isArray(v)) return v.slice(0, ARRAY_CAP).map(x => sanitizeValue(x, depth + 1))
  if (typeof v === 'object') {
    const out = {}
    for (const k of Object.keys(v)) {               // own enumerable keys only
      if (DANGEROUS_KEYS.includes(k)) continue       // strip prototype-pollution keys
      out[k] = sanitizeValue(v[k], depth + 1)
    }
    return out
  }
  return null                                        // functions, symbols, undefined → drop
}

// The exact persisted slices (useStore partialize). Anything else in the file is dropped.
const PERSISTED_KEYS = [
  'habits', 'categories', 'wallet', 'jarBeads', 'jarSeenCount',
  'coinLog', 'coinTotals', 'coinLogComplete', 'gambling', 'rotblock',
  'milestones', 'settings', 'jackpotPool', 'spinStats', 'engagement', 'daily',
  'onboardingComplete', 'firstVisitsSeen',
]

// parsed = JSON.parse(file). Returns a clean { state, version } blob to persist, or
// null if it isn't a usable save. Does NOT trust coinTotals from the file.
function sanitizeImport(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const rawState = parsed.state
  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) return null
  if (typeof parsed.version !== 'number' || !Number.isFinite(parsed.version)) return null

  const state = {}
  for (const key of PERSISTED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(rawState, key)) {
      state[key] = sanitizeValue(rawState[key])
    }
  }

  // Cap the coin log to the same bound the store keeps (recent history only).
  if (Array.isArray(state.coinLog) && state.coinLog.length > COIN_LOG_CAP) {
    state.coinLog = state.coinLog.slice(-COIN_LOG_CAP)
    state.coinLogComplete = false   // we just dropped entries → log no longer complete
  }

  // CORRECT a tampered balance: while the log is the complete history it's the source
  // of truth (same rule as useStore onRehydrateStorage / migrate v13-v14). Recompute
  // coinTotals from coinLog so a forged coinTotals in the file is ignored.
  if (state.coinLogComplete === true && Array.isArray(state.coinLog)) {
    const log = state.coinLog
    state.coinTotals = {
      earned: log.filter(e => e && e.type === 'earned').reduce((s, e) => s + (Number(e.amount) || 0), 0),
      spent:  log.filter(e => e && e.type === 'spent').reduce((s, e) => s + (Number(e.amount) || 0), 0),
    }
  } else if (state.coinTotals && typeof state.coinTotals === 'object') {
    // Log is incomplete (overflowed): trust the carried totals, but force them numeric.
    state.coinTotals = {
      earned: Math.max(0, Number(state.coinTotals.earned) || 0),
      spent:  Math.max(0, Number(state.coinTotals.spent)  || 0),
    }
  }

  return { state, version: parsed.version }
}

function ColorSwatches({ selected, onSelect }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {KAWAII_COLORS.map(c => (
        <button
          key={c.hex}
          title={c.name}
          onClick={() => onSelect(c.hex)}
          style={{
            width: 40, height: 40, borderRadius: '50%', padding: 0, cursor: 'pointer',   // ≥40px tap target
            background: `radial-gradient(circle at 35% 30%, white 0%, ${c.hex} 50%, ${darken(c.hex, 20)} 100%)`,
            border: selected === c.hex ? '3px solid #3D2B4F' : '2px solid rgba(0,0,0,0.08)',
            boxShadow: selected === c.hex ? `0 0 0 2px white, 0 0 0 4px ${c.hex}` : '0 1px 3px rgba(0,0,0,0.1)',
            transform: selected === c.hex ? 'scale(1.18)' : 'scale(1)',
            transition: 'all 120ms ease',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}

function MilestoneRow({ milestone, onChange, onDelete }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          style={inputStyle}
          placeholder="Name (e.g. Sushi Night 🍣)"
          value={milestone.name}
          onChange={e => onChange({ ...milestone, name: e.target.value })}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            type="number" min={1}
            placeholder="Bead count"
            value={milestone.beadCount}
            onChange={e => onChange({ ...milestone, beadCount: Number(e.target.value) })}
          />
          <input
            style={{ ...inputStyle, flex: 2 }}
            placeholder="Prize description"
            value={milestone.prize}
            onChange={e => onChange({ ...milestone, prize: e.target.value })}
          />
        </div>
      </div>
      <KawaiiButton variant="danger" size="sm" onClick={onDelete}
        style={{ padding: '6px 10px', alignSelf: 'center' }}
      >
        ✕
      </KawaiiButton>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  fontFamily: 'Mulish, sans-serif', fontSize: 17,
  padding: '7px 10px',
  border: '2px solid #C8B4E0', borderRadius: 10,
  background: '#FFF5F9', color: '#3D2B4F',
  outline: 'none', boxSizing: 'border-box',
}

export default function SettingsScreen() {
  const navigate = useNavigate()
  const {
    settings, updateSettings,
    categories, addCategory, updateCategory, deleteCategory,
    milestones, addMilestone, updateMilestone, deleteMilestone,
    rotblock,
    resetEverything,
  } = useStore()

  const [editingCat, setEditingCat]   = useState(null)  // category id being edited
  const [editName, setEditName]       = useState('')
  const [editColor, setEditColor]     = useState('#FFB7C5')
  const [addingCat, setAddingCat]     = useState(false)
  const [newCatName, setNewCatName]   = useState('')
  const [newCatColor, setNewCatColor] = useState('#FFB7C5')
  const [confirmReset, setConfirmReset] = useState(false)

  const fileRef = useRef(null)
  const [pendingImport, setPendingImport] = useState(null)  // { payload, summary } awaiting confirm
  const [backupMsg, setBackupMsg]         = useState(null)  // { ok, text } feedback line

  const [draftMilestones, setDraftMilestones] = useState(() => milestones)
  const [milestoneDirty, setMilestoneDirty]   = useState(false)

  // ── Backup: export/import the WHOLE save (the raw persisted blob, version and
  // all) so a friend can keep a file in a folder and reload it after any update.
  // Re-importing runs Zustand's migrate chain on reload, so old saves upgrade
  // cleanly instead of corrupting. ──
  function handleExport() {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (!raw) { setBackupMsg({ ok: false, text: 'Nothing to export yet.' }); return }
      const d = new Date()
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `habit-addiction-save-${stamp}.json`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      setBackupMsg({ ok: true, text: `Saved habit-addiction-save-${stamp}.json to your downloads. Keep it in your backup folder. 💾` })
    } catch {
      setBackupMsg({ ok: false, text: 'Export failed — could not read your save.' })
    }
  }

  function onFilePicked(e) {
    const file = e.target.files?.[0]
    e.target.value = ''   // let the same file be re-picked later
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const clean = sanitizeImport(parsed)
        if (!clean) {
          setPendingImport(null)
          setBackupMsg({ ok: false, text: "That isn't a Habit Addiction save file." })
          return
        }
        if (clean.version > PERSIST_VERSION) {
          // Newer save than this app — persist would SKIP migrate() and load an
          // unmigrated, future-shaped state the current code may mishandle.
          setPendingImport(null)
          setBackupMsg({ ok: false, text: `That save is from a newer version (v${clean.version}) than this app (v${PERSIST_VERSION}). Update the app first, then import.` })
          return
        }
        const s = clean.state
        const looksValid = ('habits' in s) || ('wallet' in s) || ('coinTotals' in s)
        if (!looksValid) {
          setPendingImport(null)
          setBackupMsg({ ok: false, text: "That isn't a Habit Addiction save file." })
          return
        }
        const beads = ((Array.isArray(s.wallet) && s.wallet.length) || 0) + ((Array.isArray(s.jarBeads) && s.jarBeads.length) || 0)
        setBackupMsg(null)
        setPendingImport({
          // Stash the CLEAN, re-serialized blob — never the raw file text.
          payload: JSON.stringify(clean),
          summary: {
            habits: (Array.isArray(s.habits) && s.habits.length) || 0,
            categories: (Array.isArray(s.categories) && s.categories.length) || 0,
            beads,
            version: clean.version,
          },
        })
      } catch {
        setPendingImport(null)
        setBackupMsg({ ok: false, text: 'Could not read that file (not valid JSON).' })
      }
    }
    reader.readAsText(file)
  }

  function applyImport() {
    try {
      // Write the SANITIZED, re-serialized blob — never the raw file text.
      localStorage.setItem(STORE_KEY, pendingImport.payload)
      setPendingImport(null)
      setBackupMsg({ ok: true, text: 'Save loaded! Reloading…' })
      setTimeout(() => window.location.reload(), 600)
    } catch {
      setBackupMsg({ ok: false, text: 'Import failed — could not write your save.' })
    }
  }

  function handleMilestoneChange(id, updated) {
    setDraftMilestones(prev => prev.map(d => d.id === id ? updated : d))
    setMilestoneDirty(true)
  }

  function handleMilestoneDelete(id) {
    setDraftMilestones(prev => prev.filter(d => d.id !== id))
    setMilestoneDirty(true)
  }

  function handleAddMilestone() {
    setDraftMilestones(prev => [...prev, {
      id: `draft-${Date.now()}`, name: '', beadCount: 50, prize: '', reached: false, reachedAt: null,
    }])
    setMilestoneDirty(true)
  }

  function saveMilestones() {
    const draftIds = new Set(draftMilestones.map(d => d.id))
    milestones.forEach(m => { if (!draftIds.has(m.id)) deleteMilestone(m.id) })
    draftMilestones.forEach(d => {
      // beadCount comes from a number field — blank/NaN/0 are all invalid (0 marks the
      // milestone reached instantly; NaN never triggers it). Force a sane positive integer.
      const clean = { ...d, beadCount: Math.max(1, Math.floor(d.beadCount) || 1) }
      if (clean.id.startsWith('draft-')) {
        const { id, ...rest } = clean
        addMilestone(rest)
      } else {
        updateMilestone(clean.id, clean)
      }
    })
    setMilestoneDirty(false)
    setDraftMilestones(useStore.getState().milestones)
  }

  const labelStyle = {
    fontFamily: "'Fredoka', cursive",
    fontSize: 18, color: '#7B5EA7',
    display: 'block', marginBottom: 4,
  }

  function startEdit(cat) {
    setEditingCat(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color)
    setAddingCat(false)
  }

  function saveEdit() {
    if (!editName.trim()) return
    updateCategory(editingCat, { name: editName.trim(), color: editColor })
    setEditingCat(null)
  }

  function handleAddCat() {
    if (!newCatName.trim()) return
    addCategory({ name: newCatName.trim(), color: newCatColor })
    setNewCatName('')
    setNewCatColor('#FFB7C5')
    setAddingCat(false)
  }

  const { show: showPopIn, dismiss: dismissPopIn } = useFirstVisitPopIn('settings')

  function handleReset() {
    resetEverything()
    setDraftMilestones([])   // store milestones are wiped — clear the local editor draft too
    setMilestoneDirty(false)
    setConfirmReset(false)
  }

  return (
    <div style={{ padding: '14px 14px', minHeight: '100%' }}>
      {showPopIn && (
        <VisualNovel script={FIRST_VISIT_SETTINGS} onComplete={dismissPopIn} onSkip={dismissPopIn} />
      )}
      <ScreenHeader title="✦ SETTINGS ✦" style={{ marginBottom: 14 }} />

      {/* Categories */}
      <PixelPanel color="lavender" title="CATEGORIES" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#7B5EA7', marginBottom: 10 }}>
          Group your habits by theme. Each category gets its own color.
        </div>

        {categories.length === 0 && !addingCat && (
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 15, color: '#9B7EC8', marginBottom: 10, textAlign: 'center' }}>
            No categories yet.
          </div>
        )}

        {categories.map(cat => (
          <div key={cat.id} style={{ marginBottom: 10 }}>
            {editingCat === cat.id ? (
              <div style={{
                background: `${cat.color}18`, border: `2px solid ${cat.color}`,
                borderRadius: 14, padding: '12px 14px',
              }}>
                <input
                  style={{ ...inputStyle, marginBottom: 8 }}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Category name"
                  autoFocus
                />
                <ColorSwatches selected={editColor} onSelect={setEditColor} />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <KawaiiButton variant="mint" size="sm" onClick={saveEdit}>✓ SAVE</KawaiiButton>
                  <KawaiiButton variant="ghost" size="sm" onClick={() => setEditingCat(null)}>CANCEL</KawaiiButton>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: `${cat.color}22`, border: `2px solid ${cat.color}`,
                borderRadius: 14, padding: '10px 14px',
              }}>
                <span style={{
                  fontFamily: 'Mulish, sans-serif', fontSize: 17, fontWeight: 700,
                  color: '#3D2B4F', flex: 1,
                }}>
                  {cat.name}
                </span>
                <KawaiiButton variant="secondary" size="sm" onClick={() => startEdit(cat)}>
                  ✏️
                </KawaiiButton>
                <KawaiiButton variant="danger" size="sm"
                  onClick={() => { if (window.confirm(`Delete "${cat.name}"? Habits in it keep their data but become uncategorized.`)) deleteCategory(cat.id) }}>
                  ✕
                </KawaiiButton>
              </div>
            )}
          </div>
        ))}

        {addingCat ? (
          <div style={{
            background: `${newCatColor}18`, border: `2px solid ${newCatColor}`,
            borderRadius: 14, padding: '12px 14px', marginBottom: 8,
          }}>
            <label style={labelStyle}>CATEGORY NAME</label>
            <input
              style={{ ...inputStyle, marginBottom: 8 }}
              placeholder="e.g. Health, Study, Creative…"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              autoFocus
            />
            <label style={labelStyle}>COLOR</label>
            <ColorSwatches selected={newCatColor} onSelect={setNewCatColor} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <KawaiiButton variant="mint" size="sm" onClick={handleAddCat}>✓ ADD</KawaiiButton>
              <KawaiiButton variant="ghost" size="sm" onClick={() => setAddingCat(false)}>CANCEL</KawaiiButton>
            </div>
          </div>
        ) : (
          <KawaiiButton variant="secondary" size="sm" onClick={() => { setAddingCat(true); setEditingCat(null) }}>
            + ADD CATEGORY
          </KawaiiButton>
        )}
      </PixelPanel>

      {/* Coin settings */}
      <PixelPanel color="yellow" title="COIN SETTINGS" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>$ PER COIN (0 = disabled)</label>
            <input
              style={inputStyle}
              type="number" min={0} step={0.01}
              value={settings.moneyPerCoin}
              onChange={e => updateSettings({ moneyPerCoin: parseFloat(e.target.value) || 0 })}
            />
            {settings.moneyPerCoin > 0 && (
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#7B5EA7', marginTop: 3 }}>
                LVL 1 win = ${(TIER_COINS.t1 * settings.moneyPerCoin).toFixed(2)} · LVL 3 = ${(TIER_COINS.t3 * settings.moneyPerCoin).toFixed(2)}
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>SECONDS PER COIN (0 = disabled)</label>
            <input
              style={inputStyle}
              type="number" min={0} step={0.1}
              value={settings.secondsPerCoin}
              onChange={e => updateSettings({ secondsPerCoin: parseFloat(e.target.value) || 0 })}
            />
            {settings.secondsPerCoin > 0 && (
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#7B5EA7', marginTop: 3 }}>
                LVL 1 win = {Math.round(TIER_COINS.t1 * settings.secondsPerCoin / 60)} min · LVL 3 = {Math.round(TIER_COINS.t3 * settings.secondsPerCoin / 60)} min
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>TIME ACTIVITY LABEL</label>
            <input
              style={inputStyle}
              placeholder="e.g. gaming, TikTok, reading"
              value={settings.timeActivity}
              onChange={e => updateSettings({ timeActivity: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>DEFAULT BONUS TIERS</label>
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#7B5EA7', marginBottom: 6 }}>
              Used when a habit hasn&apos;t set its own. The bonus wheel shows one of these when you land on ⭐ BONUS.
            </div>
            {BONUS_TIERS.map(t => (
              <input
                key={t.key}
                style={{ ...inputStyle, marginBottom: 8 }}
                placeholder={`${t.word} → ${t.discount}% off`}
                value={(settings.bonusTiers && settings.bonusTiers[t.key]) || ''}
                onChange={e => updateSettings({ bonusTiers: { ...(settings.bonusTiers || {}), [t.key]: e.target.value } })}
              />
            ))}
          </div>
        </div>
      </PixelPanel>

      {/* Milestones */}
      <PixelPanel color="mint" title="MILESTONES (JAR LINES)" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#7B5EA7', marginBottom: 10 }}>
          Set up to 3 milestone rewards. Lines appear on the jar as you fill it.
        </div>
        {draftMilestones.map(m => (
          <MilestoneRow
            key={m.id}
            milestone={m}
            onChange={updated => handleMilestoneChange(m.id, updated)}
            onDelete={() => handleMilestoneDelete(m.id)}
          />
        ))}
        {draftMilestones.length < 3 && (
          <KawaiiButton variant="mint" size="sm" onClick={handleAddMilestone}>
            + ADD MILESTONE
          </KawaiiButton>
        )}
        {milestoneDirty && (
          <KawaiiButton variant="primary" size="md" fullWidth onClick={saveMilestones}
            style={{ marginTop: 10, animation: 'bounce-in 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            💾 SAVE MILESTONES
          </KawaiiButton>
        )}
      </PixelPanel>

      {/* RotBlock */}
      <PixelPanel color="lavender" title="ROTBLOCK" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#3D2B4F', marginBottom: 10, lineHeight: 1.45 }}>
          Lock the apps & sites that eat your time behind your coins — using one spends your free time, and running out locks it.
        </div>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginBottom: 10 }}>
          {rotblock?.enabled ? '🛡️ On' : '💤 Off'} · {rotblock?.targets?.length || 0} Brainrot{(rotblock?.targets?.length || 0) === 1 ? '' : 's'}
        </div>
        <KawaiiButton variant="secondary" size="md" fullWidth onClick={() => navigate('/rotblock')}>
          🧠 Open RotBlock
        </KawaiiButton>
      </PixelPanel>

      {/* Display — scales the whole UI (the window stays the same size, just the
          contents shrink/grow). Helps on smaller screens. */}
      <PixelPanel color="cream" title="DISPLAY" style={{ marginBottom: 14 }}>
        <label style={labelStyle}>APP SIZE — {Math.round((settings.uiScale ?? 0.9) * 100)}%</label>
        <input
          type="range" min={0.7} max={1} step={0.05}
          value={settings.uiScale ?? 0.9}
          onChange={e => updateSettings({ uiScale: parseFloat(e.target.value) })}
          style={{ width: '100%', accentColor: '#9B7EC8', marginBottom: 8 }}
        />
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', textAlign: 'center' }}>
          Smaller fits more on screen · bigger is easier to read
        </div>
      </PixelPanel>

      {/* Sound */}
      <PixelPanel color="cream" title="SOUND" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontFamily: 'Mulish, sans-serif', fontSize: 17, color: '#3D2B4F' }}>
            {settings.muted ? '🔇 Muted' : '🔊 Sound on'}
          </span>
          <KawaiiButton
            variant={settings.muted ? 'ghost' : 'secondary'}
            size="sm"
            onClick={() => updateSettings({ muted: !settings.muted })}
          >
            {settings.muted ? 'UNMUTE' : 'MUTE'}
          </KawaiiButton>
        </div>

        {/* Level controls. MUTE is a master switch (it silences SFX *and* music),
            so when muted we dim these and the music row reads "Muted" — otherwise
            it would say "Music on" while nothing plays. They stay adjustable so you
            can preset levels before unmuting. */}
        <div style={{ opacity: settings.muted ? 0.5 : 1, transition: 'opacity 0.2s ease' }}>
          {/* Sound-effects volume */}
          <label style={labelStyle}>SOUND EFFECTS — {Math.round((settings.volume ?? 0.6) * 100)}%</label>
          <input
            type="range" min={0} max={1} step={0.05}
            value={settings.volume ?? 0.6}
            onChange={e => updateSettings({ volume: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: '#FF85A1', marginBottom: 18 }}
          />

          {/* Background music — its own on/off + volume (low by default) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: 'Mulish, sans-serif', fontSize: 17, color: '#3D2B4F' }}>
              {settings.muted
                ? '🔇 Muted'
                : ((settings.musicEnabled ?? true) ? '🎵 Music on' : '🎵 Music off')}
            </span>
            <KawaiiButton
              variant={(settings.musicEnabled ?? true) ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => updateSettings({ musicEnabled: !(settings.musicEnabled ?? true) })}
            >
              {(settings.musicEnabled ?? true) ? 'MUTE' : 'UNMUTE'}
            </KawaiiButton>
          </div>
          <label style={labelStyle}>MUSIC VOLUME — {Math.round((settings.musicVolume ?? 0.2) * 100)}%</label>
          <input
            type="range" min={0} max={1} step={0.05}
            value={settings.musicVolume ?? 0.2}
            onChange={e => updateSettings({ musicVolume: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: '#C8A2E0', marginBottom: 12 }}
          />
        </div>

        {/* Test — tapping this also unlocks the browser's audio */}
        <KawaiiButton variant="mint" size="md" fullWidth
          onClick={() => { if (settings.muted) updateSettings({ muted: false }); playWin('t3') }}
        >
          🔊 TEST SOUND
        </KawaiiButton>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#9B7EC8', marginTop: 6, textAlign: 'center' }}>
          No sound? Reload the page and tap once — browsers block audio until you interact.
        </div>
      </PixelPanel>

      {/* Backup / transfer */}
      <PixelPanel color="sky" title="BACKUP & TRANSFER" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#7B5EA7', marginBottom: 10 }}>
          Save everything — habits, beads, coins, jackpot, streak, settings — to a file you
          can keep in a folder and load back after any update, on any device. Your progress
          never has to start from scratch.
        </div>

        <KawaiiButton variant="secondary" size="md" fullWidth onClick={handleExport}>
          💾 EXPORT MY SAVE
        </KawaiiButton>

        <div style={{ height: 8 }} />

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onFilePicked}
          style={{ display: 'none' }}
        />

        {!pendingImport ? (
          <KawaiiButton variant="ghost" size="md" fullWidth onClick={() => fileRef.current?.click()}>
            📂 IMPORT A SAVE
          </KawaiiButton>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#3D2B4F',
              background: 'rgba(75,197,245,0.12)', border: '2px solid #B4E0F5', borderRadius: 12,
              padding: '10px 12px', textAlign: 'center',
            }}>
              This file has <strong>{pendingImport.summary.habits}</strong> habits ·{' '}
              <strong>{pendingImport.summary.beads}</strong> beads ·{' '}
              <strong>{pendingImport.summary.categories}</strong> categories (save v{pendingImport.summary.version}).
              <br />Loading it <strong>replaces</strong> everything you have now.
            </div>
            <KawaiiButton variant="primary" size="md" fullWidth onClick={applyImport}>
              REPLACE WITH THIS SAVE
            </KawaiiButton>
            <KawaiiButton variant="ghost" size="md" fullWidth onClick={() => setPendingImport(null)}>
              CANCEL
            </KawaiiButton>
          </div>
        )}

        {backupMsg && (
          <div style={{
            fontFamily: 'Mulish, sans-serif', fontSize: 13, marginTop: 8, textAlign: 'center',
            color: backupMsg.ok ? '#2A9BC8' : '#C44B6A',
          }}>
            {backupMsg.text}
          </div>
        )}
      </PixelPanel>

      {/* Danger zone */}
      <PixelPanel color="pink" title="DANGER ZONE" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, color: '#7B5EA7', marginBottom: 10 }}>
          Wipes all habits, beads, coins, categories, and progress. Keeps settings.
        </div>
        {!confirmReset ? (
          <KawaiiButton variant="danger" size="md" fullWidth onClick={() => setConfirmReset(true)}>
            🗑 RESET ALL DATA
          </KawaiiButton>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              fontFamily: "'Fredoka', cursive",
              fontSize: 25, color: '#C44B6A', textAlign: 'center', marginBottom: 4,
            }}>
              ARE YOU SURE?
            </div>
            <KawaiiButton variant="danger" size="md" fullWidth onClick={handleReset}>
              YES, WIPE IT
            </KawaiiButton>
            <KawaiiButton variant="ghost" size="md" fullWidth onClick={() => setConfirmReset(false)}>
              CANCEL
            </KawaiiButton>
          </div>
        )}
      </PixelPanel>
    </div>
  )
}

function darken(hex, amount) {
  try {
    const num = parseInt(hex.replace('#', ''), 16)
    const r = Math.max(0, (num >> 16) - amount)
    const g = Math.max(0, ((num >> 8) & 0xff) - amount)
    const b = Math.max(0, (num & 0xff) - amount)
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  } catch { return '#888' }
}
