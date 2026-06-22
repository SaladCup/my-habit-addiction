// RotBlock extension — background.
// Runs as a Chrome MV3 service worker AND a Firefox MV2 event page (same code).
// Talks to the desktop app's localhost bridge for state (targets + coins + Break
// Glass), blocks matching tabs by redirecting them to the block page, and drains
// coins for time spent on a Brainrot site. The store in the app stays the single
// source of truth — this just enforces it in the browser.

const BRIDGE = 'http://127.0.0.1:7691'
const BLOCK_PAGE = chrome.runtime.getURL('blocked.html')
const STALE_MS = 3000          // re-fetch state if older than this
const HEARTBEAT_MS = 10000     // tell the app "extension is alive" at most this often

let cfg = { enabled: false, coins: 0, breakGlassUntil: 0, secondsPerCoin: 2, testBlockUntil: 0, siteTargets: [] }
let cfgAt = 0
let lastHeartbeat = 0
const drainAcc = {}            // tabId -> leftover seconds not yet converted to a coin

// Restore last-known state so a freshly-woken worker isn't totally blind.
try { chrome.storage.local.get(['cfg'], (r) => { if (r && r.cfg) cfg = r.cfg }) } catch (e) { /* */ }

const now = () => Date.now()

async function refreshCfg(force) {
  if (!force && now() - cfgAt < STALE_MS) return cfg
  try {
    const res = await fetch(BRIDGE + '/state', { cache: 'no-store' })
    const data = await res.json()
    if (data && data.ok) {
      cfg = data; cfgAt = now()
      try { chrome.storage.local.set({ cfg }) } catch (e) { /* */ }
    }
  } catch (e) {
    // App not running / bridge down → we can't know the coin balance, so we do NOT
    // block (fail-open). Site blocking only enforces while the app is open.
  }
  if (now() - lastHeartbeat > HEARTBEAT_MS) {
    lastHeartbeat = now()
    fetch(BRIDGE + '/heartbeat', { method: 'POST' }).catch(() => {})
  }
  return cfg
}

// ── URL matching: domain, path-prefix (youtube.com/shorts), or bare keyword ──
function normTarget(match) {
  let m = (match || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '')
  const slash = m.indexOf('/')
  const host = slash === -1 ? m : m.slice(0, slash)
  const path = slash === -1 ? '' : m.slice(slash)   // e.g. "/shorts"
  return { host, path, isKeyword: !host.includes('.'), raw: m }
}
function urlMatchesTarget(urlStr, target) {
  let u
  try { u = new URL(urlStr) } catch { return false }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const n = normTarget(target.match)
  if (n.raw.length < 3) return false
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  if (n.isKeyword) {
    // keyword: appears anywhere in host + path + query (e.g. "shorts", "reddit")
    return (host + u.pathname + u.search).toLowerCase().includes(n.raw)
  }
  const hostOk = host === n.host || host.endsWith('.' + n.host)
  if (!hostOk) return false
  if (!n.path) return true                            // whole-site target
  const p = (u.pathname || '').toLowerCase()
  // "/shorts" matches "/shorts" and "/shorts/abc" but not "/shortstack"
  return p === n.path || p.startsWith(n.path.endsWith('/') ? n.path : n.path + '/') || p === n.path + '/'
}
function isBlockPage(u) { return !!u && u.indexOf(BLOCK_PAGE) === 0 }
function matchTarget(urlStr) {
  if (!cfg.enabled || !urlStr || isBlockPage(urlStr)) return null
  return (cfg.siteTargets || []).find(t => urlMatchesTarget(urlStr, t)) || null
}
function isBroke() {
  if (!cfg.enabled) return false
  if (cfg.breakGlassUntil && cfg.breakGlassUntil > now()) return false   // Break Glass window
  if (cfg.testBlockUntil && cfg.testBlockUntil > now()) return true      // "Test a block" demo
  return (cfg.coins || 0) <= 0
}

function blockTab(tabId, url, target) {
  const dest = BLOCK_PAGE
    + '?from=' + encodeURIComponent(url)
    + '&site=' + encodeURIComponent(target.label || target.match || 'this site')
  try { chrome.tabs.update(tabId, { url: dest }) } catch (e) { /* */ }
}

async function enforceTab(tab) {
  if (!tab || tab.id == null || !tab.url) return
  await refreshCfg()
  const target = matchTarget(tab.url)
  if (target && isBroke()) blockTab(tab.id, tab.url, target)
}

// Block on navigation / tab switch (these events wake the worker, so cfg is fresh).
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'loading' || info.url) enforceTab(tab)
})
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (t) => { if (!chrome.runtime.lastError) enforceTab(t) })
})

// Content-script heartbeat (~every 5s on the focused tab): drain coins for time on
// a Brainrot, and block late if the balance hit zero while sitting on the page.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'tick') return
  const tabId = sender.tab && sender.tab.id
  const url = msg.url || (sender.tab && sender.tab.url)
  if (tabId == null || !url) { try { sendResponse({}) } catch (e) { /* */ } return }
  refreshCfg().then(() => {
    const target = matchTarget(url)
    if (!target) { delete drainAcc[tabId]; try { sendResponse({ brainrot: false }) } catch (e) { /* */ } return }
    if (isBroke()) { blockTab(tabId, url, target); try { sendResponse({ blocked: true }) } catch (e) { /* */ } return }
    const dt = Math.min(15, Math.max(1, Number(msg.dt) || 5))
    drainAcc[tabId] = (drainAcc[tabId] || 0) + dt
    const per = cfg.secondsPerCoin || 2
    if (drainAcc[tabId] >= per) {
      const coins = Math.floor(drainAcc[tabId] / per)
      drainAcc[tabId] -= coins * per
      let host = 'site'; try { host = new URL(url).hostname } catch { /* */ }
      fetch(BRIDGE + '/drain', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coins, host }),
      }).catch(() => {})
    }
    try { sendResponse({ brainrot: true }) } catch (e) { /* */ }
  })
  return true   // keep the message channel open for the async sendResponse
})

// Backstop poll (~1 min): catches "sitting still past 0 coins" without navigating,
// and keeps state fresh if the user isn't generating tab events.
try {
  chrome.alarms.create('rb-poll', { periodInMinutes: 1 })
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name !== 'rb-poll') return
    refreshCfg(true).then(() => {
      chrome.tabs.query({ active: true }, (tabs) => (tabs || []).forEach(enforceTab))
    })
  })
} catch (e) { /* alarms may be unavailable in some contexts */ }
