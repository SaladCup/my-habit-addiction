// RotBlock bridge — a tiny localhost HTTP server that lets the BROWSER EXTENSION
// share the app's RotBlock state (targets + coins + Break Glass), so site blocking
// stays part of the coin economy instead of being a disconnected blocker.
//
//   GET  /hello      → { ok:true }  UNAUTHENTICATED liveness probe ONLY (no data,
//                      no token). Lets the extension/popup show "app up" + bootstrap.
//   GET  /token      → { ok:true, token }  one-time token handoff for the extension.
//                      Requires the X-RotBlock-Ext header → forces a CORS preflight a
//                      website cannot satisfy, so only the extension can read it.
//   GET  /state      → { enabled, coins, breakGlassUntil, secondsPerCoin,
//                        testBlockUntil, siteTargets:[{id,label,match}] }   (auth)
//   POST /drain      → { coins, host }  spend coins for time on a Brainrot site (auth)
//   POST /heartbeat  → extension check-in (so the desktop cover can stand down
//                      for SITES while the extension is the one enforcing them) (auth)
//
// THREAT MODEL. Bound to 127.0.0.1, but ANY website the user visits can also reach
// 127.0.0.1 from the user's browser. With the old `Access-Control-Allow-Origin: *`
// and no token, a malicious page could GET /state (read the blocklist + coin
// balance) and — crucially — POST /drain to zero the user's coins. A CORS "simple
// request" POST (Content-Type text/plain, no custom headers) is sent by the browser
// WITHOUT a preflight, so the server SIDE-EFFECT runs even though the page can't read
// the (CORS-blocked) response. So "*" is not the only problem: dropping it stops the
// READ but not the blind WRITE.
//
// DEFENSE (two independent gates on every data endpoint):
//   1. Custom request header `X-RotBlock-Ext: 1`. This is NOT a CORS-safelisted
//      header, so a cross-origin fetch carrying it is forced into a PREFLIGHT
//      (OPTIONS). We answer the preflight WITHOUT Access-Control-Allow-Origin /
//      -Allow-Headers, so the browser refuses to send the real request → the drain
//      side-effect never reaches us from a web page. The extension is exempt from
//      CORS entirely (it talks to us via host_permissions), so it just sends it.
//   2. A random per-launch token (`X-RotBlock-Token`). Generated here at startup,
//      handed to the extension once via /token (itself header-gated), stored in
//      chrome.storage. Defense-in-depth: even if a future browser quirk let a page
//      skip the preflight, it still can't guess the token.
//   We send NO Access-Control-Allow-* on the data endpoints — the extension does not
//   need CORS (host_permissions bypasses it), and emitting ACAO is exactly what would
//   re-enable cross-origin reads. Only /hello carries permissive CORS, and it returns
//   no data. (Chrome 142+ Local Network Access adds a further public-site→loopback
//   permission prompt, but we do not rely on it: not all browsers ship it and
//   enterprise policy can whitelist origins.)
const http = require('node:http')
const crypto = require('node:crypto')

const DEFAULTS = {
  enabled: false, coins: 0, breakGlassUntil: 0, secondsPerCoin: 2,
  testBlockUntil: 0, siteTargets: [],
}

// A single drain call can never spend more than this, regardless of what the
// extension claims — bounds a buggy/compromised caller, and is clamped again to the
// live balance below. ~25s of time at the default 2s/coin.
const DRAIN_CEILING = 12

const EXT_HEADER = 'x-rotblock-ext'      // presence forces a preflight a page can't pass
const TOKEN_HEADER = 'x-rotblock-token'  // per-launch shared secret

let server = null
let state = { ...DEFAULTS }
let extensionActiveUntil = 0
let onDrain = null   // ({coins, host}) => void, set by start()
let TOKEN = ''       // random per-launch; regenerated each start()

// Permissive CORS for the liveness probe ONLY (it returns no data). Data endpoints
// deliberately get NO Access-Control-Allow-* headers.
function helloCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Vary', 'Origin')
}
function sendJson(res, code, obj, { cors = false } = {}) {
  if (cors) helloCors(res)
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}

// Constant-time token compare (lengths may differ → guard before timingSafeEqual).
function tokenOk(req) {
  const got = req.headers[TOKEN_HEADER]
  if (typeof got !== 'string' || got.length !== TOKEN.length || !TOKEN) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(TOKEN))
  } catch { return false }
}
// The extension always sends this header; a cross-origin page that tries to send it
// is forced into a preflight we refuse, so it can never reach here with it set.
function extHeaderOk(req) { return req.headers[EXT_HEADER] === '1' }

function handle(req, res) {
  let pathname = '/'
  try { pathname = new URL(req.url, 'http://127.0.0.1').pathname } catch { /* */ }

  // Preflight. We ONLY okay it for /hello (the harmless probe). For every other
  // path we answer 403 with NO Access-Control-Allow-* → the browser blocks the
  // follow-up request, so a website can neither read /state nor fire /drain.
  if (req.method === 'OPTIONS') {
    if (pathname === '/hello') { helloCors(res); res.writeHead(204); res.end(); return }
    res.writeHead(403); res.end(); return
  }

  // Unauthenticated liveness probe — returns ok-ness, never any data.
  if (req.method === 'GET' && pathname === '/hello') {
    return sendJson(res, 200, { ok: true }, { cors: true })
  }

  // Token handoff. Header-gated (so a website can't read it), but no token required
  // (this is how the extension GETS the token). Same-origin extension fetch passes.
  if (req.method === 'GET' && pathname === '/token') {
    if (!extHeaderOk(req)) return sendJson(res, 403, { ok: false, error: 'forbidden' })
    return sendJson(res, 200, { ok: true, token: TOKEN })
  }

  // From here on: BOTH gates required.
  if (!extHeaderOk(req) || !tokenOk(req)) {
    return sendJson(res, 403, { ok: false, error: 'forbidden' })
  }

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
      // Clamp to: requested ≥0, the per-call ceiling, AND the live balance. The
      // extension is not trusted to send a sane number — the store is the source of
      // truth, but the bridge still refuses to authorize spending more than exists.
      const want = Math.max(0, Math.floor(Number(p.coins) || 0))
      const coins = Math.min(want, DRAIN_CEILING, Math.max(0, Math.floor(state.coins) || 0))
      if (coins > 0 && onDrain) {
        try { onDrain({ coins, host: String(p.host || '').slice(0, 80) }) } catch { /* */ }
      }
      sendJson(res, 200, { ok: true, drained: coins })
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
  TOKEN = crypto.randomBytes(32).toString('hex')   // fresh secret each launch
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
