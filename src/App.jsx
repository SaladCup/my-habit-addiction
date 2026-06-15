import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import './styles/global.css'
import { WarningSplash } from './components/ui'
import StreakPopup from './components/StreakPopup'
import HomeScreen     from './screens/HomeScreen'
import WalletScreen   from './screens/WalletScreen'
import SpendScreen    from './screens/SpendScreen'
import StatsScreen    from './screens/StatsScreen'
import EditorScreen   from './screens/EditorScreen'
import SettingsScreen from './screens/SettingsScreen'
import SpinScreen     from './screens/SpinScreen'
import BonusScreen    from './screens/BonusScreen'
import RewardScreen   from './screens/RewardScreen'
import CashInScreen   from './screens/CashInScreen'
import CasinoScreen   from './screens/CasinoScreen'
import CoinFlipScreen from './screens/casino/CoinFlipScreen'
import CrashScreen    from './screens/casino/CrashScreen'
import PenguinCrossScreen from './screens/casino/PenguinCrossScreen'
import MinesScreen        from './screens/casino/MinesScreen'

const ICON_V = '7'   // bump to force browsers to reload updated icon art
const NAV_ITEMS = [
  { to: '/',         label: 'Home',     icon: `/ui/icon_home.png?v=${ICON_V}` },
  { to: '/casino',   label: 'Casino',   icon: `/ui/icon_spin.png?v=${ICON_V}` },
  { to: '/spend',    label: 'Spend',    icon: `/ui/icon_spend.png?v=${ICON_V}` },
  { to: '/stats',    label: 'Stats',    icon: `/ui/icon_stats.png?v=${ICON_V}` },
  { to: '/edit',     label: 'Habits',   icon: `/ui/icon_editor.png?v=${ICON_V}` },
  { to: '/settings', label: 'Settings', icon: `/ui/icon_settings.png?v=${ICON_V}` },
]

const HIDDEN_NAV_ROUTES = ['/cash-in', '/spin', '/bonus', '/reward', '/casino/coinflip', '/casino/crash', '/casino/penguin', '/casino/mines']

function BottomNav() {
  const { pathname } = useLocation()
  if (HIDDEN_NAV_ROUTES.includes(pathname)) return null
  return (
    <nav style={navStyle}>
      {NAV_ITEMS.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          style={navItemStyle}
          aria-label={item.label}
        >
          {({ isActive }) => (
            <img
              src={item.icon}
              alt={item.label}
              title={item.label}
              style={{
                width: '100%',
                height: 'auto',
                maxWidth: '76px',
                maxHeight: '76px',
                objectFit: 'contain',
                display: 'block',
                margin: '0 auto',
                transition: 'transform 200ms ease, filter 200ms ease',
                // Every icon identical size AND position (no scale, no lift) so
                // the active one never sits higher/bigger. Active = pink glow only.
                transform: 'none',
                filter: isActive
                  ? 'drop-shadow(0 4px 10px rgba(255,133,161,0.95))'
                  : 'drop-shadow(0 3px 6px rgba(120,90,160,0.45))',
              }}
            />
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function AppShell() {
  return (
    <div className="app-shell">
      <main className="screen">
        <Routes>
          <Route path="/"         element={<HomeScreen />} />
          <Route path="/wallet"   element={<WalletScreen />} />
          <Route path="/spend"    element={<SpendScreen />} />
          <Route path="/stats"    element={<StatsScreen />} />
          <Route path="/edit"     element={<EditorScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/cash-in"  element={<CashInScreen />} />
          <Route path="/casino"          element={<CasinoScreen />} />
          <Route path="/casino/coinflip" element={<CoinFlipScreen />} />
          <Route path="/casino/crash"    element={<CrashScreen />} />
          <Route path="/casino/penguin"  element={<PenguinCrossScreen />} />
          <Route path="/casino/mines"    element={<MinesScreen />} />
          <Route path="/spin"     element={<SpinScreen />} />
          <Route path="/bonus"    element={<BonusScreen />} />
          <Route path="/reward"   element={<RewardScreen />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  const [showWarning, setShowWarning] = useState(
    () => !localStorage.getItem('habitAddict_seenWarning')
  )
  // Daily streak check-in popup, once per app open (self-dismisses if already
  // done today). Held until the first-run warning is gone so they don't stack.
  const [streakDone, setStreakDone] = useState(false)

  function dismissWarning() {
    localStorage.setItem('habitAddict_seenWarning', '1')
    setShowWarning(false)
  }

  return (
    <>
      {showWarning && <WarningSplash onDismiss={dismissWarning} />}
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
      {!showWarning && !streakDone && <StreakPopup onClose={() => setStreakDone(true)} />}
    </>
  )
}

const navStyle = {
  width: '100%',
  height: 'var(--nav-height)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-around',
  background: 'transparent',          // no banner — icons float over the bg
  zIndex: 'var(--z-nav)',
  paddingBottom: 'env(safe-area-inset-bottom)',
  flexShrink: 0,
}

const navItemStyle = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px 2px',
  textDecoration: 'none',
}
