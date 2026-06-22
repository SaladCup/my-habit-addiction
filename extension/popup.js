const BRIDGE = 'http://127.0.0.1:7691'
const $ = (id) => document.getElementById(id)

async function load() {
  let cfg = null
  try { cfg = await (await fetch(BRIDGE + '/state', { cache: 'no-store' })).json() } catch (e) { /* */ }

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
