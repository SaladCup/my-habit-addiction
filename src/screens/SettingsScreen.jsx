import { useState, useRef } from 'react'
import useStore, { KAWAII_COLORS, PERSIST_VERSION } from '../store/useStore'
import { TIER_COINS } from '../engine/gameLogic'
import { playWin } from '../engine/sounds'
import { KawaiiButton, PixelPanel } from '../components/ui'

// The localStorage key Zustand persists under (see useStore persist config).
const STORE_KEY = 'my-habit-addiction'

function ColorSwatches({ selected, onSelect }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {KAWAII_COLORS.map(c => (
        <button
          key={c.hex}
          title={c.name}
          onClick={() => onSelect(c.hex)}
          style={{
            width: 28, height: 28, borderRadius: '50%', padding: 0, cursor: 'pointer',
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
  fontFamily: 'Mulish, sans-serif', fontSize: 22,
  padding: '9px 11px',
  border: '2px solid #C8B4E0', borderRadius: 10,
  background: '#FFF5F9', color: '#3D2B4F',
  outline: 'none', boxSizing: 'border-box',
}

export default function SettingsScreen() {
  const {
    settings, updateSettings,
    categories, addCategory, updateCategory, deleteCategory,
    milestones, addMilestone, updateMilestone, deleteMilestone,
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
  const [pendingImport, setPendingImport] = useState(null)  // { text, summary } awaiting confirm
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
        const text = String(reader.result)
        const parsed = JSON.parse(text)
        const s = parsed?.state
        const looksValid = s && typeof s === 'object' && typeof parsed.version === 'number'
          && ('habits' in s || 'wallet' in s || 'coinTotals' in s)
        if (!looksValid) {
          setPendingImport(null)
          setBackupMsg({ ok: false, text: "That isn't a Habit Addiction save file." })
          return
        }
        if (parsed.version > PERSIST_VERSION) {
          // Newer save than this app — persist would SKIP migrate() and load an
          // unmigrated, future-shaped state the current code may mishandle.
          setPendingImport(null)
          setBackupMsg({ ok: false, text: `That save is from a newer version (v${parsed.version}) than this app (v${PERSIST_VERSION}). Update the app first, then import.` })
          return
        }
        const beads = (s.wallet?.length || 0) + (s.jarBeads?.length || 0)
        setBackupMsg(null)
        setPendingImport({
          text,
          summary: {
            habits: s.habits?.length || 0,
            categories: s.categories?.length || 0,
            beads,
            version: parsed.version,
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
      localStorage.setItem(STORE_KEY, pendingImport.text)
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
    fontSize: 24, color: '#7B5EA7',
    display: 'block', marginBottom: 6,
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

  function handleReset() {
    resetEverything()
    setDraftMilestones([])   // store milestones are wiped — clear the local editor draft too
    setMilestoneDirty(false)
    setConfirmReset(false)
  }

  return (
    <div style={{ padding: '20px 16px', minHeight: '100%' }}>
      <h2 style={{
        fontFamily: "'Fredoka', cursive",
        fontSize: 21, color: '#3D2B4F', marginBottom: 18,
      }}>
        ✦ SETTINGS ✦
      </h2>

      {/* Categories */}
      <PixelPanel color="lavender" title="CATEGORIES" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 21, color: '#7B5EA7', marginBottom: 12 }}>
          Group your habits by theme. Each category gets its own color.
        </div>

        {categories.length === 0 && !addingCat && (
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#9B7EC8', marginBottom: 12, textAlign: 'center' }}>
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
                  fontFamily: 'Mulish, sans-serif', fontSize: 24, fontWeight: 700,
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
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 21, color: '#7B5EA7', marginTop: 4 }}>
                T1 win = ${(TIER_COINS.t1 * settings.moneyPerCoin).toFixed(2)} · T3 = ${(TIER_COINS.t3 * settings.moneyPerCoin).toFixed(2)}
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
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 21, color: '#7B5EA7', marginTop: 4 }}>
                T1 win = {Math.round(TIER_COINS.t1 * settings.secondsPerCoin / 60)} min · T3 = {Math.round(TIER_COINS.t3 * settings.secondsPerCoin / 60)} min
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
            <label style={labelStyle}>BONUS TASK ("just a bit more")</label>
            <input
              style={inputStyle}
              placeholder="e.g. 10 push-ups"
              value={settings.bonusActivity || ''}
              onChange={e => updateSettings({ bonusActivity: e.target.value })}
            />
            <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 21, color: '#7B5EA7', marginTop: 4 }}>
              The quick task you do when a spin lands on ⭐ BONUS.
            </div>
          </div>
        </div>
      </PixelPanel>

      {/* Milestones */}
      <PixelPanel color="mint" title="MILESTONES (JAR LINES)" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 21, color: '#7B5EA7', marginBottom: 12 }}>
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

      {/* Sound */}
      <PixelPanel color="cream" title="SOUND" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontFamily: 'Mulish, sans-serif', fontSize: 24, color: '#3D2B4F' }}>
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
            <span style={{ fontFamily: 'Mulish, sans-serif', fontSize: 24, color: '#3D2B4F' }}>
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
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 19, color: '#9B7EC8', marginTop: 8, textAlign: 'center' }}>
          No sound? Reload the page and tap once — browsers block audio until you interact.
        </div>
      </PixelPanel>

      {/* Backup / transfer */}
      <PixelPanel color="sky" title="BACKUP & TRANSFER" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 21, color: '#7B5EA7', marginBottom: 12 }}>
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
              fontFamily: 'Mulish, sans-serif', fontSize: 20, color: '#3D2B4F',
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
            fontFamily: 'Mulish, sans-serif', fontSize: 19, marginTop: 10, textAlign: 'center',
            color: backupMsg.ok ? '#2A9BC8' : '#C44B6A',
          }}>
            {backupMsg.text}
          </div>
        )}
      </PixelPanel>

      {/* Danger zone */}
      <PixelPanel color="pink" title="DANGER ZONE" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 21, color: '#7B5EA7', marginBottom: 12 }}>
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
