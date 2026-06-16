import { useState, useMemo } from 'react'
import useStore from '../store/useStore'
import { BeadDisplay, PixelPanel } from '../components/ui'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

const TABS = ['Day', 'Week', 'Month', 'Year', 'All']

function getBucketKey(ts, tab) {
  const d = new Date(ts)
  if (tab === 'Day')   return d.toLocaleTimeString([], { hour: '2-digit' })
  if (tab === 'Week')  return d.toLocaleDateString([], { weekday: 'short' })
  if (tab === 'Month') return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  if (tab === 'Year')  return d.toLocaleDateString([], { month: 'short' })
  return d.getFullYear().toString()
}

function filterByTab(items, tab, key = 'earnedAt') {
  const now = Date.now()
  const cutoff = {
    Day:   now - 86400000,
    Week:  now - 7 * 86400000,
    Month: now - 30 * 86400000,
    Year:  now - 365 * 86400000,
    All:   0,
  }[tab]
  return items.filter(item => (item[key] || item.timestamp || 0) >= cutoff)
}

function useStats(tab) {
  const { wallet, jarBeads, coinLog, habits } = useStore()

  return useMemo(() => {
    const allBeads = [...wallet, ...jarBeads]
    const filteredBeads = filterByTab(allBeads, tab)
    const filteredCoins = filterByTab(coinLog.filter(e => e.type === 'earned'), tab, 'timestamp')

    // Bead buckets + per-slot counts
    const beadBuckets = {}
    const slotCounts = { gold: 0 }
    filteredBeads.forEach(b => {
      const key = getBucketKey(b.earnedAt || b.cashedAt || 0, tab)
      beadBuckets[key] = (beadBuckets[key] || 0) + 1
      if (b.isGold) slotCounts.gold += 1
      else slotCounts[b.slot] = (slotCounts[b.slot] || 0) + 1
    })

    // Coin buckets
    const coinBuckets = {}
    filteredCoins.forEach(e => {
      const key = getBucketKey(e.timestamp, tab)
      coinBuckets[key] = (coinBuckets[key] || 0) + e.amount
    })

    // Merge keys
    const allKeys = [...new Set([...Object.keys(beadBuckets), ...Object.keys(coinBuckets)])]
    const chartData = allKeys.map(k => ({
      label: k,
      beads: beadBuckets[k] || 0,
      coins: coinBuckets[k] || 0,
    }))

    // Streaks (consecutive days with any bead earned)
    const daySet = new Set(allBeads.map(b => {
      const d = new Date(b.earnedAt || b.cashedAt || 0)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    }))
    let streak = 0, best = 0, cur = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (daySet.has(key)) { cur++; best = Math.max(best, cur) }
      else { if (i === 0) streak = cur; cur = 0 }
    }
    if (streak === 0) streak = cur

    // Per-habit counts
    const habitCounts = {}
    allBeads.forEach(b => {
      if (b.habitId) habitCounts[b.habitId] = (habitCounts[b.habitId] || 0) + 1
    })

    return {
      chartData,
      totalBeads: filteredBeads.length,
      totalCoins: filteredCoins.reduce((s, e) => s + e.amount, 0),
      totalMoney: filteredCoins.reduce((s, e) => s + e.amount, 0),
      streak, best,
      habitCounts,
      slotCounts,
      habits,
    }
  }, [tab, wallet, jarBeads, coinLog, habits])
}

const KAWAII_BAR = '#C8B4E0'
const KAWAII_LINE = '#FF85A1'

const tooltipStyle = {
  background: '#FFF5F9',
  border: '2px solid #C8B4E0',
  borderRadius: 10,
  fontFamily: 'Mulish, sans-serif',
  fontSize: 15,
}

export default function StatsScreen() {
  const [tab, setTab] = useState('Week')
  const { chartData, totalBeads, totalCoins, streak, best, habitCounts, slotCounts, habits } = useStats(tab)
  const { settings, gambling, getCasinoNet } = useStore()
  const coinName = 'coins'
  const casinoNet = getCasinoNet()
  const hasGambled = (gambling?.wagered ?? 0) > 0

  const moneyValue = settings.moneyPerCoin > 0
    ? `$${(totalCoins * settings.moneyPerCoin).toFixed(2)}`
    : null
  const timeValue = settings.secondsPerCoin > 0
    ? formatTime(totalCoins * settings.secondsPerCoin)
    : null

  return (
    <div style={{ padding: '20px 16px', minHeight: '100%' }}>
      <h2 style={{
        fontFamily: "'Fredoka', cursive",
        fontSize: 34, color: '#3D2B4F', marginBottom: 16,
      }}>
        ✦ STATS ✦
      </h2>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              fontFamily: "'Fredoka', cursive",
              fontSize: 22,
              padding: '7px 16px',
              background: tab === t ? '#9B7EC8' : '#F5F0FF',
              color: tab === t ? '#fff' : '#7B5EA7',
              border: `2px solid ${tab === t ? '#9B7EC8' : '#C8B4E0'}`,
              borderRadius: 10,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 150ms ease',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <StatCard label="BEADS EARNED" value={totalBeads} emoji="🫙" color="#C8B4E0" />
        <StatCard label={`${coinName.toUpperCase()} EARNED`} value={totalCoins} emoji="⭐" color="#FFE9A0" />
        <StatCard label="CURRENT STREAK" value={`${streak}d`} emoji="🔥" color="#FFB7C5" />
        <StatCard label="BEST STREAK" value={`${best}d`} emoji="🏆" color="#B4E0C8" />
      </div>

      {/* Coin value (money + time) */}
      {(moneyValue || timeValue) && (
        <PixelPanel color="yellow" style={{ marginBottom: 14, textAlign: 'center' }}>
          <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 20, color: '#7B5EA7', marginBottom: 6 }}>
            VALUE EARNED THIS {tab.toUpperCase()}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
            {moneyValue && (
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 26, fontWeight: 800, color: '#5C3A00' }}>
                💰 {moneyValue}
              </div>
            )}
            {timeValue && (
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 26, fontWeight: 800, color: '#5C3A00' }}>
                ⏱ {timeValue} {settings.timeActivity || ''}
              </div>
            )}
          </div>
        </PixelPanel>
      )}

      {/* Casino record (all-time — the gambling tally is separate from habit earnings) */}
      {hasGambled && (
        <PixelPanel color="lavender" title="🎰 CASINO · ALL-TIME" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, fontWeight: 700, color: '#9B7EC8' }}>WAGERED</div>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 24, color: '#7B5EA7' }}>{(gambling.wagered ?? 0).toLocaleString()} 🪙</div>
            </div>
            <div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, fontWeight: 700, color: '#9B7EC8' }}>WON BACK</div>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 24, color: '#7B5EA7' }}>{(gambling.won ?? 0).toLocaleString()} 🪙</div>
            </div>
            <div>
              <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 13, fontWeight: 700, color: '#9B7EC8' }}>NET</div>
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 24, color: casinoNet >= 0 ? '#3E9B6A' : '#C44B6A' }}>
                {casinoNet >= 0 ? '+' : '−'}{Math.abs(casinoNet).toLocaleString()} 🪙
              </div>
            </div>
          </div>
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 14, color: '#7B5EA7', textAlign: 'center', marginTop: 10 }}>
            {casinoNet >= 0 ? "You're up on the house — quit while you're ahead? 😏" : 'Down at the tables — go do a habit and win it back. 💪'}
          </div>
        </PixelPanel>
      )}

      {/* Per-slot bead breakdown */}
      {totalBeads > 0 && (
        <PixelPanel color="cream" title="BEADS BY COLOR" style={{ marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {settings.beadSlots.map(bs => (
              <div key={bs.slot} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 4px', background: `${bs.color}22`,
                border: `2px solid ${bs.color}`, borderRadius: 12,
              }}>
                <BeadDisplay color={bs.color} slot={bs.slot} size="md" />
                <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 20, color: '#3D2B4F' }}>
                  ×{slotCounts[bs.slot] || 0}
                </div>
              </div>
            ))}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 4px', background: 'rgba(255,215,0,0.2)',
              border: '2px solid #FFD700', borderRadius: 12,
            }}>
              <BeadDisplay isGold size="md" />
              <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 20, color: '#5C3A00' }}>
                ×{slotCounts.gold || 0}
              </div>
            </div>
          </div>
        </PixelPanel>
      )}

      {/* Beads chart */}
      {chartData.length > 0 ? (
        <>
          <PixelPanel color="lavender" style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#3D1A6E', marginBottom: 12 }}>
              BEADS OVER TIME
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D8F5" />
                <XAxis dataKey="label" tick={{ fontFamily: 'Mulish', fontSize: 14 }} />
                <YAxis tick={{ fontFamily: 'Mulish', fontSize: 14 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="beads" fill={KAWAII_BAR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </PixelPanel>

          <PixelPanel color="pink" style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'Fredoka', cursive", fontSize: 22, color: '#7A2040', marginBottom: 12 }}>
              {coinName.toUpperCase()} OVER TIME
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FFE0EC" />
                <XAxis dataKey="label" tick={{ fontFamily: 'Mulish', fontSize: 14 }} />
                <YAxis tick={{ fontFamily: 'Mulish', fontSize: 14 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line dataKey="coins" stroke={KAWAII_LINE} strokeWidth={2} dot={{ fill: KAWAII_LINE, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </PixelPanel>
        </>
      ) : (
        <PixelPanel color="cream" style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#7B5EA7' }}>
            No data for this period yet. Start tracking habits!
          </div>
        </PixelPanel>
      )}

      {/* Per-habit breakdown */}
      {habits.length > 0 && (
        <PixelPanel color="mint" title="PER HABIT">
          {habits.map(h => {
            const count = habitCounts[h.id] || 0
            return (
              <div key={h.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #D8F0E8',
              }}>
                <div style={{ fontFamily: 'Mulish, sans-serif', fontSize: 22, color: '#3D2B4F' }}>
                  {h.name}
                </div>
                <div style={{
                  fontFamily: 'Mulish, sans-serif', fontWeight: 800,
                  fontSize: 24, color: '#1A5C3A',
                  background: '#B4E0C8', padding: '6px 16px', borderRadius: 999,
                  minWidth: 52, textAlign: 'center',
                }}>
                  ×{count}
                </div>
              </div>
            )
          })}
        </PixelPanel>
      )}
    </div>
  )
}

function StatCard({ label, value, emoji, color }) {
  return (
    <div style={{
      background: `${color}33`,
      border: `3px solid ${color}`,
      borderRadius: 16,
      padding: '12px',
      textAlign: 'center',
      boxShadow: `0 4px 0 ${darken(color, 30)}`,
    }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>{emoji}</div>
      <div style={{
        fontFamily: "'Fredoka', cursive",
        fontSize: 34, color: '#3D2B4F',
        marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: "'Fredoka', cursive",
        fontSize: 20, color: '#7B5EA7',
        lineHeight: 1.4,
      }}>
        {label}
      </div>
    </div>
  )
}

function formatTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`
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
