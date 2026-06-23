import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import './styles/global.css'
import useStore from './store/useStore'
import { setMusicConfig } from './engine/music'
import { playHover, playSwoosh } from './engine/sounds'
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
import PlinkoScreen       from './screens/casino/PlinkoScreen'
import HiLoScreen         from './screens/casino/HiLoScreen'
import BlackjackScreen    from './screens/casino/BlackjackScreen'
import SlotsBetScreen     from './screens/casino/SlotsBetScreen'
import WheelBetScreen     from './screens/casino/WheelBetScreen'
import RotBlockScreen     from './screens/RotBlockScreen'
import BreakGlassScreen   from './screens/BreakGlassScreen'
import BlockedScreen      from './screens/BlockedScreen'
import RotBlockEnforcer   from './components/RotBlockEnforcer'
import RotBlockBridge     from './components/RotBlockBridge'
import AudioRainbow       from './components/AudioRainbow'
import UpdatePrompt       from './components/UpdatePrompt'
import VisualNovel        from './components/VisualNovel'
import SpotlightTour      from './components/SpotlightTour'
import AppScaleStage      from './components/AppScaleStage'
import { ONBOARDING_INTRO, NAV_TOUR } from './content/habitChanScript'

/* global __APP_VERSION__ -- replaced at build time by Vite's define (see vite.config) */

const ICON_V = '8'   // bump to force browsers to reload updated icon art
const NAV_ITEMS = [
  { to: '/',         label: 'Home',     icon: `/ui/icon_home.png?v=${ICON_V}` },
  { to: '/casino',   label: 'Casino',   icon: `/ui/icon_casino.png?v=${ICON_V}` },
  { to: '/spend',    label: 'Spend',    icon: `/ui/icon_spend.png?v=${ICON_V}` },
  { to: '/stats',    label: 'Stats',    icon: `/ui/icon_stats.png?v=${ICON_V}` },
  { to: '/edit',     label: 'Habits',   icon: `/ui/icon_editor.png?v=${ICON_V}` },
  { to: '/settings', label: 'Settings', icon: `/ui/icon_settings.png?v=${ICON_V}` },
]

const HIDDEN_NAV_ROUTES = ['/meet', '/cash-in', '/spin', '/bonus', '/reward', '/break-glass', '/blocked', '/casino/coinflip', '/casino/crash', '/casino/penguin', '/casino/mines', '/casino/plinko', '/casino/hilo', '/casino/blackjack', '/casino/slots', '/casino/wheel']

// Preview/standalone player for Habit-Chan's intro (route: /meet). The real
// onboarding will mount VisualNovel inline; this lets us watch it on its own.
function MeetHabitChan() {
  const navigate = useNavigate()
  return <VisualNovel script={ONBOARDING_INTRO} onComplete={() => navigate('/')} onSkip={() => navigate('/')} />
}

// Standalone player for the bottom-nav coach-mark tour (route: /tour). NOT in
// HIDDEN_NAV_ROUTES — the nav must stay on screen for the spotlight to highlight it.
// Renders the real Home screen behind so the "see the homepage, then fog out" reveal
// works (in the real onboarding the tour will simply overlay whatever screen you're on).
function NavTourDemo() {
  const navigate = useNavigate()
  return (
    <>
      <HomeScreen />
      <SpotlightTour steps={NAV_TOUR} onComplete={() => navigate('/')} />
    </>
  )
}

// Only chirp the hover sound for a real mouse. On touch, a tap synthesizes a
// pointerenter right before the click, which would otherwise stack hover+swoosh.
function handleNavHover(e) { if (e.pointerType === 'mouse') playHover() }

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
          data-tour={item.label.toLowerCase()}
          onPointerEnter={handleNavHover}
          onClick={playSwoosh}
        >
          {({ isActive }) => (
            <img
              className="nav-icon"
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
                // Active = pink glow. Hover grows + wiggles (see .nav-icon in global.css).
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

// Drives the background music: pushes the live audio settings into the music
// engine whenever they change. The engine handles the autoplay-unlock gesture,
// so music begins on the first tap (e.g. dismissing the warning splash).
function MusicController() {
  const musicEnabled = useStore(s => s.settings.musicEnabled ?? true)
  const musicVolume  = useStore(s => s.settings.musicVolume ?? 0.2)
  const muted        = useStore(s => s.settings.muted)
  useEffect(() => {
    // Force music OFF in dev/preview (the loop got grating during rapid reload-
    // testing); the packaged production app respects the user's setting.
    const enabled = import.meta.env.DEV ? false : musicEnabled
    setMusicConfig({ musicEnabled: enabled, musicVolume, muted })
  }, [musicEnabled, musicVolume, muted])
  return null
}

function AppShell({ showWarning }) {
  const onboardingComplete = useStore(s => s.onboardingComplete)
  const setOnboardingComplete = useStore(s => s.setOnboardingComplete)
  // 'intro' → typewriter intro, then 'tour' → nav spotlight, then null (done)
  const [phase, setPhase] = useState(() => (onboardingComplete ? null : 'intro'))
  // Don't show while the age-gate warning splash is still up
  const active = !showWarning && phase !== null

  return (
    <div className="app-shell">
      <MusicController />
      <RotBlockEnforcer />
      <RotBlockBridge />
      <AudioRainbow />
      <UpdatePrompt />
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
          <Route path="/casino/plinko"   element={<PlinkoScreen />} />
          <Route path="/casino/hilo"     element={<HiLoScreen />} />
          <Route path="/casino/blackjack" element={<BlackjackScreen />} />
          <Route path="/casino/slots"    element={<SlotsBetScreen />} />
          <Route path="/casino/wheel"    element={<WheelBetScreen />} />
          <Route path="/spin"     element={<SpinScreen />} />
          <Route path="/bonus"    element={<BonusScreen />} />
          <Route path="/reward"   element={<RewardScreen />} />
          <Route path="/rotblock"    element={<RotBlockScreen />} />
          <Route path="/break-glass" element={<BreakGlassScreen />} />
          <Route path="/blocked"     element={<BlockedScreen />} />
          <Route path="/meet"        element={<MeetHabitChan />} />
          <Route path="/tour"        element={<NavTourDemo />} />
        </Routes>
      </main>
      <BottomNav />
      {active && phase === 'intro' && (
        <VisualNovel
          script={ONBOARDING_INTRO}
          onComplete={() => setPhase('tour')}
          onSkip={() => setPhase('tour')}
        />
      )}
      {active && phase === 'tour' && (
        <SpotlightTour
          steps={NAV_TOUR}
          onComplete={() => { setOnboardingComplete(); setPhase(null) }}
        />
      )}
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

  // Show the version in the window title bar (baked in by Vite — see vite.config).
  useEffect(() => {
    const v = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''
    document.title = `My Habit Addiction ✨${v ? ` · v${v}` : ''}`
  }, [])

  function dismissWarning() {
    localStorage.setItem('habitAddict_seenWarning', '1')
    setShowWarning(false)
  }

  return (
    <>
      {/* Blurred dreamy backdrop fills the window behind the card (the letterbox). */}
      <div className="dreamy-backdrop" />
      {/* One scale stage: everything inside scales together to fit any window/display. */}
      <AppScaleStage>
        {showWarning && <WarningSplash onDismiss={dismissWarning} />}
        <HashRouter>
          <AppShell showWarning={showWarning} />
        </HashRouter>
        {!showWarning && !streakDone && <StreakPopup onClose={() => setStreakDone(true)} />}
      </AppScaleStage>
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
