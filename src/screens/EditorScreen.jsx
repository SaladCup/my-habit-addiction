import { useState } from 'react'
import useStore, { KAWAII_COLORS } from '../store/useStore'
import { BeadDisplay, KawaiiButton, PixelPanel } from '../components/ui'

const BLANK_HABIT = {
  name: '', description: '', categoryId: null, beadSlot: 1,
  rewards: { t1: '', t2: '', t3: '', jackpot: '', bonusActivity: '' },
}

function BeadSlotPicker({ value, onSelect, beadSlots }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
      {beadSlots.map(bs => {
        const active = value === bs.slot
        return (
          <button
            key={bs.slot}
            type="button"
            title={bs.name}
            onClick={() => onSelect(bs.slot)}
            style={{
              background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              transform: active ? 'translateY(-2px) scale(1.05)' : 'none',
              transition: 'transform 140ms ease',
            }}
          >
            <BeadDisplay color={bs.color} slot={bs.slot} size="lg" selected={active} />
            <span style={{
              fontFamily: 'Nunito, sans-serif', fontSize: 14,
              color: active ? '#3D2B4F' : '#9B7EC8',
              fontWeight: active ? 700 : 500,
            }}>
              {bs.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ColorSwatches({ selected, onSelect }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {KAWAII_COLORS.map(c => (
        <button
          key={c.hex}
          type="button"
          title={c.name}
          onClick={() => onSelect(c.hex)}
          style={{
            width: 26, height: 26, borderRadius: '50%', padding: 0, cursor: 'pointer',
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

function CategoryPicker({ value, onChange, categories, onCreateCategory }) {
  const [creating, setCreating]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [newColor, setNewColor]   = useState('#FFB7C5')

  function handleCreate() {
    if (!newName.trim()) return
    const cat = onCreateCategory({ name: newName.trim(), color: newColor })
    onChange(cat.id)
    setCreating(false)
    setNewName('')
    setNewColor('#FFB7C5')
  }

  return (
    <div>
      {categories.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: creating ? 12 : 0 }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onChange(value === cat.id ? null : cat.id)}
              style={{
                background: value === cat.id ? cat.color : `${cat.color}33`,
                border: `2px solid ${cat.color}`,
                borderRadius: 20,
                padding: '6px 14px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: value === cat.id ? `0 3px 0 ${darken(cat.color, 30)}` : 'none',
                transition: 'all 140ms ease',
                userSelect: 'none',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, opacity: value === cat.id ? 1 : 0.6 }} />
              <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 22, fontWeight: 700, color: '#3D2B4F' }}>
                {cat.name}
              </span>
              {value === cat.id && (
                <span style={{ fontSize: 16, color: '#3D2B4F', opacity: 0.55, marginLeft: 2 }}>✕</span>
              )}
            </button>
          ))}
        </div>
      )}

      {categories.length > 0 && (
        <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 18, color: '#9B7EC8', marginTop: 6, marginBottom: creating ? 4 : 0 }}>
          {value ? 'Tap the selected category again to clear it.' : 'Optional — tap a category to assign one.'}
        </div>
      )}

      {!creating ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          style={{
            marginTop: categories.length > 0 ? 8 : 0,
            background: 'transparent', border: '2px dashed #C8B4E0',
            borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
            fontFamily: 'Nunito, sans-serif', fontSize: 22, color: '#9B7EC8',
            transition: 'all 140ms ease',
          }}
        >
          + new category
        </button>
      ) : (
        <div style={{
          marginTop: 8, background: `${newColor}18`,
          border: `2px solid ${newColor}`, borderRadius: 14, padding: '12px 14px',
        }}>
          <input
            style={{ ...inputStyle, marginBottom: 8 }}
            placeholder="Category name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
          />
          <ColorSwatches selected={newColor} onSelect={setNewColor} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <KawaiiButton variant="mint" size="sm" onClick={handleCreate}>✓ CREATE</KawaiiButton>
            <KawaiiButton variant="ghost" size="sm" onClick={() => setCreating(false)}>CANCEL</KawaiiButton>
          </div>
        </div>
      )}
    </div>
  )
}

function HabitForm({ initial, onSave, onCancel, categories, onCreateCategory, beadSlots }) {
  const [form, setForm] = useState(() => {
    const base = initial || BLANK_HABIT
    return {
      ...BLANK_HABIT,
      ...base,
      rewards: { ...BLANK_HABIT.rewards, ...(base.rewards || {}) },
    }
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const setReward = (key, val) => setForm(f => ({ ...f, rewards: { ...f.rewards, [key]: val } }))

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>HABIT NAME *</label>
        <input
          style={inputStyle}
          placeholder="e.g. Morning Run"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          required
        />
      </div>

      <div>
        <label style={labelStyle}>DESCRIPTION</label>
        <input
          style={inputStyle}
          placeholder="e.g. 20 min jog"
          value={form.description}
          onChange={e => set('description', e.target.value)}
        />
      </div>

      <div>
        <label style={labelStyle}>CATEGORY</label>
        <CategoryPicker
          value={form.categoryId}
          onChange={v => set('categoryId', v)}
          categories={categories}
          onCreateCategory={onCreateCategory}
        />
      </div>

      <div>
        <label style={labelStyle}>BEAD SLOT</label>
        <BeadSlotPicker
          value={form.beadSlot}
          onSelect={v => set('beadSlot', v)}
          beadSlots={beadSlots}
        />
      </div>

      <div>
        <label style={labelStyle}>REWARDS (what you give yourself when you win)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <RewardRow tier="T1" hint="small treat" value={form.rewards.t1} onChange={v => setReward('t1', v)} />
          <RewardRow tier="T2" hint="medium reward" value={form.rewards.t2} onChange={v => setReward('t2', v)} />
          <RewardRow tier="T3" hint="big reward" value={form.rewards.t3} onChange={v => setReward('t3', v)} />
          <RewardRow tier="🌟 JACKPOT" hint="dream reward" value={form.rewards.jackpot} onChange={v => setReward('jackpot', v)} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>BONUS CHALLENGE (shown during bonus round)</label>
        <input
          style={inputStyle}
          placeholder="e.g. 5 more minutes of running"
          value={form.rewards.bonusActivity}
          onChange={e => setReward('bonusActivity', e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <KawaiiButton type="submit" variant="mint" size="md" fullWidth>
          ✓ SAVE HABIT
        </KawaiiButton>
        <KawaiiButton type="button" variant="ghost" size="md" onClick={onCancel}>
          ✕ CANCEL
        </KawaiiButton>
      </div>
    </form>
  )
}

function RewardRow({ tier, hint, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        fontFamily: "'Bunny Snaps', cursive", fontSize: 18, color: '#7B5EA7',
        minWidth: 78, textAlign: 'right',
      }}>
        {tier}
      </div>
      <input
        style={{ ...inputStyle, fontSize: 20, padding: '8px 10px' }}
        placeholder={hint}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

export default function EditorScreen() {
  const { habits, categories, addHabit, updateHabit, deleteHabit, addCategory, settings } = useStore()
  const [editing, setEditing] = useState(null)

  const categoryMap = categories.reduce((acc, c) => { acc[c.id] = c; return acc }, {})

  function handleSave(form) {
    if (editing === 'new') {
      addHabit(form)
    } else {
      updateHabit(editing, form)
    }
    setEditing(null)
  }

  return (
    <div style={{ padding: '20px 16px', minHeight: '100%' }}>
      <h2 style={{
        fontFamily: "'Bunny Snaps', cursive",
        fontSize: 38, color: '#3D2B4F', marginBottom: 4,
      }}>
        ✦ MY HABITS ✦
      </h2>
      <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 22, color: '#7B5EA7', marginBottom: 18 }}>
        {habits.length} habit{habits.length !== 1 ? 's' : ''}
      </div>

      {editing && (
        <PixelPanel color="lavender" style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "'Bunny Snaps', cursive", fontSize: 27, color: '#3D1A6E', marginBottom: 14 }}>
            {editing === 'new' ? '+ NEW HABIT' : '✏️ EDIT HABIT'}
          </div>
          <HabitForm
            key={editing}
            initial={editing === 'new' ? null : habits.find(h => h.id === editing)}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
            categories={categories}
            onCreateCategory={addCategory}
            beadSlots={settings.beadSlots}
          />
        </PixelPanel>
      )}

      {habits.map(habit => {
        const cat = categoryMap[habit.categoryId]
        const color = cat?.color || '#C8B4E0'
        const slot = habit.beadSlot || 1
        const slotInfo = settings.beadSlots.find(s => s.slot === slot)
        return (
          <PixelPanel key={habit.id} color="cream" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <BeadDisplay color={slotInfo?.color || color} slot={slot} size="md" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Bunny Snaps', cursive", fontSize: 27, color: '#3D2B4F', marginBottom: 3 }}>
                  {habit.name}
                </div>
                {habit.description && (
                  <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 21, color: '#7B5EA7' }}>
                    {habit.description}
                  </div>
                )}
                {cat && (
                  <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 21, color: '#9B7EC8', marginTop: 2 }}>
                    {cat.name}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <KawaiiButton variant="secondary" size="sm"
                  onClick={() => setEditing(habit.id)}
                  style={{ fontSize: 22 }}
                >
                  ✏️
                </KawaiiButton>
                <KawaiiButton variant="danger" size="sm"
                  onClick={() => { if (window.confirm(`Delete "${habit.name}"?`)) deleteHabit(habit.id) }}
                  style={{ fontSize: 22 }}
                >
                  ✕
                </KawaiiButton>
              </div>
            </div>
          </PixelPanel>
        )
      })}

      {!editing && (
        <KawaiiButton variant="primary" size="md" fullWidth onClick={() => setEditing('new')}>
          + ADD NEW HABIT
        </KawaiiButton>
      )}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  fontFamily: 'Nunito, sans-serif', fontSize: 24,
  padding: '10px 12px',
  border: '2px solid #C8B4E0', borderRadius: 10,
  background: '#FFF5F9', color: '#3D2B4F',
  outline: 'none', boxSizing: 'border-box',
}

const labelStyle = {
  fontFamily: "'Bunny Snaps', cursive",
  fontSize: 24, color: '#7B5EA7',
  display: 'block', marginBottom: 6,
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
