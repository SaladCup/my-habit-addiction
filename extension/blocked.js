// Block page logic: show which site was blocked, poll the app's bridge for your
// coin balance, and let you back in once you've earned time (or Break Glass'd).
const BRIDGE = 'http://127.0.0.1:7691'
const EXT_HEADER = { 'X-RotBlock-Ext': '1' }
const params = new URLSearchParams(location.search)

// Token handshake (same scheme as the background worker). blocked.html is a
// web_accessible_resource on the extension origin, so it has host_permissions →
// bypasses CORS, can read /token, and can carry the auth headers.
let token = ''
try { chrome.storage.local.get(['token'], (r) => { if (r && typeof r.token === 'string') token = r.token }) } catch (e) { /* */ }
async function fetchToken() {
  try {
    const d = await (await fetch(BRIDGE + '/token', { cache: 'no-store', headers: EXT_HEADER })).json()
    if (d && d.ok && d.token) { token = d.token; try { chrome.storage.local.set({ token }) } catch (e) { /* */ } }
  } catch (e) { /* */ }
  return token
}
async function bridgeState() {
  const hdrs = () => Object.assign({}, EXT_HEADER, token ? { 'X-RotBlock-Token': token } : {})
  if (!token) await fetchToken()
  let res = await fetch(BRIDGE + '/state', { cache: 'no-store', headers: hdrs() })
  if (res.status === 403) { await fetchToken(); res = await fetch(BRIDGE + '/state', { cache: 'no-store', headers: hdrs() }) }
  return res.json()
}
const from = params.get('from') || ''
const site = params.get('site') || 'this site'

const $ = (id) => document.getElementById(id)
$('site').textContent = site

const goback = $('goback')
let unlocked = false

goback.addEventListener('click', (e) => {
  e.preventDefault()
  if (unlocked && from) location.href = from
})

// Try to surface the desktop app. A custom protocol may be registered by a future
// app version; if not, the hint text tells the user to open it manually.
$('openapp').addEventListener('click', () => {
  try { location.href = 'habitaddiction://rotblock' } catch (e) { /* */ }
})

async function poll() {
  let cfg = null
  try { cfg = await bridgeState() } catch (e) { /* */ }

  if (!cfg || !cfg.ok) {
    $('coins').textContent = 'My Habit Addiction isn’t running'
    $('status').textContent = 'Open the app to earn time and unlock.'
    setUnlocked(false)
    return
  }

  const coins = cfg.coins || 0
  const bg = cfg.breakGlassUntil && cfg.breakGlassUntil > Date.now()
  const test = cfg.testBlockUntil && cfg.testBlockUntil > Date.now()
  const secs = coins * (cfg.secondsPerCoin || 2)

  if (test) {
    $('coins').textContent = '👀 Test block'
    $('status').textContent = 'This is what a block looks like. End the test in the app.'
    setUnlocked(false)
  } else if (bg) {
    $('coins').textContent = '🔨 Break Glass active'
    $('status').textContent = 'You’re unlocked for now — head back when ready.'
    setUnlocked(true)
  } else if (coins > 0) {
    $('coins').textContent = coins + ' coins · ' + fmt(secs) + ' of time'
    $('status').textContent = 'You’ve got time again — head back when ready.'
    setUnlocked(true)
  } else {
    $('coins').textContent = '0 coins'
    $('status').textContent = 'You’re out of free time. Do a habit in the app to earn more — or Break Glass.'
    setUnlocked(false)
  }
}

function setUnlocked(v) {
  unlocked = v
  goback.classList.toggle('disabled', !v)
}

function fmt(sec) {
  const m = Math.floor(sec / 60)
  if (m < 1) return Math.max(0, Math.round(sec)) + ' sec'
  if (m < 60) return m + ' min'
  return Math.floor(m / 60) + 'h ' + (m % 60) + 'm'
}

poll()
setInterval(poll, 2000)
