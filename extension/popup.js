const BRIDGE = 'http://127.0.0.1:7691'
const EXT_HEADER = { 'X-RotBlock-Ext': '1' }
const $ = (id) => document.getElementById(id)

// Token handshake (same scheme as the background worker). The popup has
// host_permissions, so it bypasses CORS and may read /token + carry the headers.
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

async function load() {
  let cfg = null
  try { cfg = await bridgeState() } catch (e) { /* */ }

  if (!cfg || !cfg.ok) {
    $('conn').innerHTML = '<span class="dot bad"></span>not running'
    $('enabled').textContent = '—'
    $('coins').textContent = '—'
    $('sites').textContent = '—'
    $('hint').textContent = 'Open My Habit Addiction so the extension can read your coins.'
    return
  }
  $('conn').innerHTML = '<span class="dot ok"></span>connected'
  $('enabled').textContent = cfg.enabled ? 'On' : 'Off'
  const coins = cfg.coins || 0
  const secs = coins * (cfg.secondsPerCoin || 2)
  $('coins').textContent = coins + ' (' + fmt(secs) + ')'
  $('sites').textContent = (cfg.siteTargets || []).length
}

function fmt(sec) {
  const m = Math.floor(sec / 60)
  if (m < 1) return Math.max(0, Math.round(sec)) + 's'
  if (m < 60) return m + 'm'
  return Math.floor(m / 60) + 'h' + (m % 60) + 'm'
}

load()
setInterval(load, 2000)
