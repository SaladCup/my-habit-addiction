// RotBlock bridge — a tiny localhost HTTP server that lets the BROWSER EXTENSION
// share the app's RotBlock state (targets + coins + Break Glass), so site blocking
// stays part of the coin economy instead of being a disconnected blocker.
//
//   GET  /state      → { enabled, coins, breakGlassUntil, secondsPerCoin,
//                        testBlockUntil, siteTargets:[{id,label,match}] }
//   POST /drain      → { coins, host }  spend coins for time on a Brainrot site
//   POST /heartbeat  → extension check-in (so the desktop cover can stand down
//                      for SITES while the extension is the one enforcing them)
//
// Bound to 127.0.0.1 only. The renderer pushes fresh state in via IPC; drains are
// forwarded back to the renderer (the store is the single source of truth). Low
// sensitivity (a play-money habit app), so no token for now — localhost + the
// extension's host_permissions are the gate.
const http = require('node:http')

const DEFAULTS = {
  enabled: false, coins: 0, breakGlassUntil: 0, secondsPerCoin: 2,
  testBlockUntil: 0, siteTargets: [],
}

let server = null
let state = { ...DEFAULTS }
let extensionActiveUntil = 0
let onDrain = null   // ({coins, host}) => void, set by start()

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}
function sendJson(res, code, obj) {
  cors(res)
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}

function handle(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return }
  let pathname = '/'
  try { pathname = new URL(req.url, 'http://127.0.0.1').pathname } catch { /* */ }

  if (req.method === 'GET' && pathname === '/state') {
    return sendJson(res, 200, { ok: true, ...state, ts: Date.now() })
  }
  if (req.method === 'POST' && pathname === '/heartbeat') {
    extensionActiveUntil = Date.now() + 20000
    return sendJson(res, 200, { ok: true })
  }
  if (req.method === 'POST' && pathname === '/drain') {
    let body = ''
    req.on('data', (c) => { body += c; if (body.length > 10000) req.destroy() })
    req.on('end', () => {
      let p = {}
      try { p = JSON.parse(body || '{}') } catch { /* */ }
      const coins = Math.max(0, Math.floor(Number(p.coins) || 0))
      if (coins > 0 && onDrain) {
        try { onDrain({ coins, host: String(p.host || '').slice(0, 80) }) } catch { /* */ }
      }
      sendJson(res, 200, { ok: true })
    })
    req.on('error', () => { try { sendJson(res, 400, { ok: false }) } catch { /* */ } })
    return
  }
  sendJson(res, 404, { ok: false, error: 'not found' })
}

// Start the server once. `onDrain` is called when the extension reports coins to
// spend; the caller forwards it to the renderer's store. Non-fatal on failure
// (e.g. port in use) — site blocking just won't be available until restart.
function start({ port = 7691, onDrain: drainCb } = {}) {
  onDrain = drainCb || null
  if (server) return
  server = http.createServer(handle)
  server.on('error', (e) => { console.error('[rotblock-bridge]', e && e.message); server = null })
  server.listen(port, '127.0.0.1', () => console.log('[rotblock-bridge] listening on 127.0.0.1:' + port))
}

function stop() { if (server) { try { server.close() } catch { /* */ } server = null } }

// The renderer pushes the live RotBlock slice here (only site targets — apps stay
// with the desktop cover). Missing fields fall back to safe defaults.
function setState(next) {
  const n = next || {}
  state = {
    enabled: !!n.enabled,
    coins: Number(n.coins) || 0,
    breakGlassUntil: Number(n.breakGlassUntil) || 0,
    secondsPerCoin: Number(n.secondsPerCoin) || 2,
    testBlockUntil: Number(n.testBlockUntil) || 0,
    siteTargets: Array.isArray(n.siteTargets)
      ? n.siteTargets.map(t => ({ id: t.id, label: t.label, match: t.match })).slice(0, 200)
      : [],
  }
}

// True if the extension has checked in recently — the desktop enforcer uses this
// to STOP covering browser sites (the extension handles those), avoiding double-block.
function isExtensionActive() { return extensionActiveUntil > Date.now() }

module.exports = { start, stop, setState, isExtensionActive }
