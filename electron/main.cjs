// Electron main process — the thin native shell that wraps the React app in a
// real desktop window (Mac + Windows) instead of a browser tab.
//
// In dev it loads the Vite dev server (hot reload). When packaged it serves the
// built dist/ through a custom `app://` protocol — NOT file:// — because Chromium
// blocks ES-module loading over file://, which would leave a blank screen.
const { app, BrowserWindow, shell, protocol, ipcMain, systemPreferences, screen } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const crypto = require('node:crypto')
const { spawn } = require('node:child_process')
const rotblockBridge = require('./rotblockBridge.cjs')

const BRIDGE_PORT = 7691   // localhost port the browser extension talks to

// Dev = loading the live Vite server. Packaged = loading the built files.
// HABIT_FORCE_PROD lets us test the built (app://) path without packaging.
const isDev = !app.isPackaged && !process.env.HABIT_FORCE_PROD
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
const DIST = path.join(__dirname, '..', 'dist')
const APP_URL = 'app://bundle/index.html'
let mainWin = null   // the app window, so blocker IPC can raise/cover it
let coverSavedBounds = null   // phone-size bounds saved while the window is grown to cover a Brainrot

// The custom scheme must be registered as privileged BEFORE the app is ready.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
}

// Serve dist/ over app:// with correct MIME types. Unknown paths fall back to
// index.html so client-side (hash) routing always resolves.
function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url)
    let rel = decodeURIComponent(pathname)
    if (rel === '/' || rel === '') rel = '/index.html'
    const filePath = path.normalize(path.join(DIST, rel))
    // Path-traversal guard. A bare `startsWith(DIST)` is too loose: it also passes
    // sibling dirs that merely share the prefix (e.g. DIST="/app/dist" would let
    // "/app/dist-secrets/…" through). Require either the DIST root itself OR a path
    // that begins with DIST + the OS separator, so only files genuinely INSIDE dist/
    // are served.
    if (filePath !== DIST && !filePath.startsWith(DIST + path.sep)) {
      return new Response('forbidden', { status: 403 })
    }
    // 'wasm-unsafe-eval' is REQUIRED: the 3D physics (rapier) compiles a WebAssembly
    // module, which a bare script-src 'self' blocks → blank screen. This flag allows
    // WASM compilation only, NOT general JS eval.
    const CSP = "default-src 'self' app:; img-src 'self' app: data:; media-src 'self' app:; font-src 'self' app: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'"
    try {
      const data = await fs.promises.readFile(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const headers = { 'content-type': MIME[ext] || 'application/octet-stream' }
      if (ext === '.html') headers['content-security-policy'] = CSP
      return new Response(data, { headers })
    } catch {
      const reqExt = path.extname(rel).toLowerCase()
      // Only fall back to index.html for navigation/SPA-route requests (no
      // extension or .html). Genuinely missing assets surface as real 404s.
      if (reqExt !== '' && reqExt !== '.html') return new Response('not found', { status: 404 })
      const data = await fs.promises.readFile(path.join(DIST, 'index.html'))
      return new Response(data, { headers: { 'content-type': 'text/html', 'content-security-policy': CSP } })
    }
  })
}

// ── Blocker: foreground-app detection (the enforcer's eyes) ──────────────
// get-windows is ESM-only, so load it lazily via dynamic import from this CJS
// file. On macOS it needs the Accessibility permission; we surface that state
// to the app instead of throwing, so onboarding can ask the user to grant it.
let _activeWindow = null
async function getActiveWindowFn() {
  if (!_activeWindow) {
    const mod = await import('get-windows')
    _activeWindow = mod.activeWindow
  }
  return _activeWindow
}

let _openWindows = null
async function getOpenWindowsFn() {
  if (!_openWindows) {
    const mod = await import('get-windows')
    _openWindows = mod.openWindows
  }
  return _openWindows
}

function registerBlockerIpc() {
  // List all currently-open apps (deduped), so the user can PICK the one to block
  // from a menu instead of the confusing "capture the front app" flow.
  ipcMain.handle('blocker:list-apps', async () => {
    if (process.platform === 'darwin'
        && typeof systemPreferences.isTrustedAccessibilityClient === 'function'
        && !systemPreferences.isTrustedAccessibilityClient(false)) {
      return { ok: false, needsPermission: true }
    }
    try {
      const openWindows = await getOpenWindowsFn()
      const wins = await openWindows({ screenRecordingPermission: false })
      const seen = new Map()
      for (const w of (wins || [])) {
        const name = w.owner && w.owner.name
        const bundleId = (w.owner && w.owner.bundleId) || null
        if (!name) continue
        if (bundleId === 'com.lauren.habitaddiction' || /habit addiction/i.test(name)) continue   // never self
        const key = bundleId || name
        if (!seen.has(key)) seen.set(key, { name, bundleId })
      }
      const apps = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
      return { ok: true, apps }
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) }
    }
  })

  ipcMain.handle('blocker:active-app', async () => {
    // macOS: check Accessibility trust SILENTLY first. If we're not trusted, return
    // needsPermission WITHOUT calling get-windows — get-windows pops the system
    // "control this computer" prompt on EVERY call when untrusted, which spams the
    // user every poll. They grant via the in-app "Open Accessibility Settings" button.
    if (process.platform === 'darwin'
        && typeof systemPreferences.isTrustedAccessibilityClient === 'function'
        && !systemPreferences.isTrustedAccessibilityClient(false)) {
      return { ok: false, needsPermission: true }
    }
    try {
      const activeWindow = await getActiveWindowFn()
      // Read the window TITLE only when Screen Recording is ALREADY granted (checked
      // silently) — otherwise get-windows would pop the Screen Recording prompt every
      // poll. The title is what lets us match sites in Firefox (no URL exposed there).
      const screenOk = process.platform !== 'darwin'
        || systemPreferences.getMediaAccessStatus('screen') === 'granted'
      const w = await activeWindow({ screenRecordingPermission: screenOk })
      if (!w) return { ok: true, app: null }
      return {
        ok: true,
        app: {
          name: w.owner?.name ?? null,
          bundleId: w.owner?.bundleId ?? null,
          path: w.owner?.path ?? null,
          pid: w.owner?.processId ?? null,
          title: w.title ?? null,
          // Active browser-tab URL (Chrome/Safari/Edge/Brave/Opera/Vivaldi on
          // macOS) so site Brainrots can be matched. null in other browsers/apps.
          url: w.url ?? null,
        },
      }
    } catch (e) {
      const msg = String(e?.message || e)
      // macOS surfaces the missing-permission case as a helper error.
      const needsPermission = /accessibility permission|screen recording/i.test(msg)
      return { ok: false, needsPermission, error: msg }
    }
  })

  // Block action (v1, non-destructive): bring OUR window to the front so the
  // lock screen covers the Brainrot, and (while blocked) keep it on top.
  ipcMain.handle('blocker:focus', () => {
    if (!mainWin || mainWin.isDestroyed()) return { ok: false }
    if (mainWin.isMinimized()) mainWin.restore()
    mainWin.show(); mainWin.focus()
    return { ok: true }
  })
  ipcMain.handle('blocker:on-top', (_e, on) => {
    if (!mainWin || mainWin.isDestroyed()) return { ok: false }
    mainWin.setAlwaysOnTop(!!on)
    return { ok: true }
  })

  // COVER (the real block): the app window is normally phone-narrow, so just
  // pulling it on top left the Brainrot visible — and CLICKABLE — around the
  // edges. Covering means filling the whole screen with our opaque window so the
  // Brainrot is fully hidden and every click lands on the lock screen, not the
  // video behind it. We grow the window to the display's work area + pin it at
  // screen-saver level (above normal + Cmd-Tabbed windows), and restore the
  // saved phone-size bounds when the block lifts. One window, one store — so
  // "do a habit / Break Glass" all keep working in place.
  ipcMain.handle('blocker:cover', (_e, on) => {
    if (!mainWin || mainWin.isDestroyed()) return { ok: false }
    if (on) {
      if (!coverSavedBounds) coverSavedBounds = mainWin.getBounds()   // remember phone size ONCE
      if (mainWin.isMinimized()) mainWin.restore()
      try {
        const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
        mainWin.setBounds(disp.workArea)   // fill the screen the user is looking at
      } catch { mainWin.maximize() }
      mainWin.setAlwaysOnTop(true, 'screen-saver')
      try { mainWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }) } catch { /* */ }
      mainWin.show(); mainWin.focus()
    } else {
      mainWin.setAlwaysOnTop(false)
      try { mainWin.setVisibleOnAllWorkspaces(false) } catch { /* */ }
      if (coverSavedBounds) { mainWin.setBounds(coverSavedBounds); coverSavedBounds = null }
    }
    return { ok: true }
  })

  // Open the macOS Accessibility settings pane directly (so the user can grant the
  // permission RotBlock needs to see the front app + browser URL).
  ipcMain.handle('blocker:open-accessibility', () => {
    if (process.platform === 'darwin') {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')
    }
    return { ok: true }
  })

  // Screen Recording: needed (macOS only) to read a window's TITLE, which is how we
  // match sites in Firefox. Report status silently + open its settings pane.
  ipcMain.handle('blocker:screen-status', () => {
    if (process.platform !== 'darwin') return 'granted'
    try { return systemPreferences.getMediaAccessStatus('screen') } catch { return 'unknown' }
  })
  ipcMain.handle('blocker:open-screen-recording', () => {
    if (process.platform === 'darwin') {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
    }
    return { ok: true }
  })

  // ── Browser-extension bridge IPC ──
  // The renderer pushes the live RotBlock slice (site targets + coins + Break
  // Glass) to the bridge server so the extension can read it; drains posted by the
  // extension are forwarded back here → the renderer spends the coins.
  ipcMain.handle('rb:publish-state', (_e, st) => { rotblockBridge.setState(st); return { ok: true } })
  ipcMain.handle('rb:extension-active', () => rotblockBridge.isExtensionActive())

  // UI scale: the renderer pushes the user's "App size" setting; we apply it as a
  // page zoom (window size unchanged — only the content scales).
  ipcMain.handle('ui:zoom', (_e, z) => {
    const f = Math.max(0.5, Math.min(1.2, Number(z) || 0.9))
    if (mainWin && !mainWin.isDestroyed()) { try { mainWin.webContents.setZoomFactor(f) } catch { /* */ } }
    return { ok: true }
  })
}

// ── Auto-update check ────────────────────────────────────────────────────
// Installers are published to a PUBLIC "releases" repo (the code repo stays
// private). The app reads that repo's latest release over the public GitHub API
// — no token needed — compares versions, and (if newer) the renderer shows a
// prompt whose button opens the right installer to download. Save data lives in
// userData, untouched by installing a new version.
const RELEASES_REPO = 'SaladCup/my-habit-addiction-releases'

// ── Update signing: independent Ed25519 integrity layer ───────────────────
// This is SEPARATE from the macOS code-signing cert (which only governs Gatekeeper
// + TCC/Accessibility persistence). The updater downloads attacker-influenceable
// bytes from a public URL; THIS Ed25519 check is what makes the app REFUSE to
// install anything not signed by Lauren's private key (held only as the CI secret
// UPDATE_SIGNING_KEY, never in the cert chain or the repo). The matching PUBLIC key
// is safe to hardcode here — it can only verify, never sign.
const UPDATE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEADaUVjYMYxlN5HDJGdewWMSwlzm3JS9scLJtfExB3iL4=
-----END PUBLIC KEY-----
`
let _updatePubKey = null
function getUpdatePublicKey() {
  if (!_updatePubKey) _updatePubKey = crypto.createPublicKey(UPDATE_PUBLIC_KEY_PEM)
  return _updatePubKey
}
// Download <artifact>.sig (base64 of the raw 64-byte Ed25519 signature), and verify
// it over the bytes of the already-downloaded artifact at `filePath`. Ed25519 hashes
// internally, so we sign/verify the RAW file bytes with the null algorithm — NOT a
// pre-computed digest. Returns true ONLY on a valid signature from our key; ANY error
// (missing sig, bad base64, wrong length, mismatch) returns false and the caller MUST
// abort the install — the renderer then falls back to the plain browser download.
async function verifyArtifactSignature(filePath, sigUrl) {
  try {
    const res = await fetch(sigUrl, { headers: { 'User-Agent': 'my-habit-addiction' } })
    if (!res.ok) { console.error('[update] sig download failed', res.status); return false }
    const sig = Buffer.from((await res.text()).trim(), 'base64')
    if (sig.length !== 64) { console.error('[update] sig wrong length', sig.length); return false }
    const bytes = await fs.promises.readFile(filePath)
    const ok = crypto.verify(null, bytes, getUpdatePublicKey(), sig)   // null algo == Ed25519
    if (!ok) console.error('[update] SIGNATURE MISMATCH — refusing to install', path.basename(filePath))
    return ok
  } catch (e) {
    console.error('[update] verify error', e)
    return false
  }
}

// Is `latest` a higher semver than `current`? (plain numeric x.y.z compare)
function isNewerVersion(latest, current) {
  const a = String(latest).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
  const b = String(current).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0)
    if (d !== 0) return d > 0
  }
  return false
}

async function checkForUpdate() {
  try {
    const res = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'my-habit-addiction' },
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    const currentVersion = app.getVersion()
    const latestVersion = String(data.tag_name || '').replace(/^v/, '')
    const assets = Array.isArray(data.assets) ? data.assets : []
    const byExt = (suffix) => assets.find(a => String(a.name || '').toLowerCase().endsWith(suffix))
    const isMac = process.platform === 'darwin'
    const dmg = byExt('.dmg'), exe = byExt('.exe'), macZip = byExt('-mac.zip')
    // downloadUrl = the human installer (dmg/exe, opened in the browser as a
    // fallback). installUrl = what the one-click self-installer fetches: the .app
    // zip on Mac, the .exe on Windows.
    const installer = isMac ? dmg : exe
    const selfInstall = isMac ? macZip : exe
    return {
      ok: true,
      updateAvailable: !!latestVersion && isNewerVersion(latestVersion, currentVersion),
      latestVersion,
      currentVersion,
      downloadUrl: installer ? installer.browser_download_url : data.html_url,
      installUrl: selfInstall ? selfInstall.browser_download_url : null,
      // The detached Ed25519 signature published next to the self-install artifact.
      // GitHub serves release assets at a stable .../releases/download/<tag>/<name>
      // URL, so appending '.sig' resolves to the uploaded <name>.sig asset.
      signatureUrl: selfInstall ? selfInstall.browser_download_url + '.sig' : null,
      releaseUrl: data.html_url,
    }
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) }
  }
}

// Stream a URL to a file, reporting fractional progress to the window.
async function downloadFile(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': 'my-habit-addiction' } })
  if (!res.ok || !res.body) throw new Error(`download HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length')) || 0
  const out = fs.createWriteStream(dest)
  const reader = res.body.getReader()
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    out.write(Buffer.from(value))
    received += value.length
    if (total && mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('update:progress', Math.min(1, received / total))
    }
  }
  await new Promise((resolve, reject) => out.end(err => (err ? reject(err) : resolve())))
}

// One-click update on macOS: download the .app zip, extract it, then hand off to a
// DETACHED script that waits for us to quit, swaps the app in place (keeping a
// backup so a mid-swap failure can't brick the install), clears quarantine, and
// relaunches. No admin needed when the app lives in a user-writable /Applications.
async function installMac(url, sigUrl) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'habit-update-'))
  const zipPath = path.join(tmp, 'update.zip')
  await downloadFile(url, zipPath)
  // INTEGRITY GATE: verify the Ed25519 signature over the downloaded zip BEFORE we
  // extract / ditto / spawn anything. Fail closed — if it doesn't verify, abort and
  // let the renderer fall back to the plain browser download. Nothing runs unsigned.
  if (!sigUrl || !(await verifyArtifactSignature(zipPath, sigUrl))) {
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch { /* */ }
    return { ok: false, error: 'signature verification failed' }
  }
  const extractDir = path.join(tmp, 'x')
  fs.mkdirSync(extractDir, { recursive: true })
  await new Promise((resolve, reject) => {
    const p = spawn('/usr/bin/ditto', ['-x', '-k', zipPath, extractDir], { stdio: 'ignore' })
    p.on('exit', code => (code === 0 ? resolve() : reject(new Error('unzip failed'))))
    p.on('error', reject)
  })
  const newApp = fs.readdirSync(extractDir).map(n => path.join(extractDir, n)).find(p => p.endsWith('.app'))
  if (!newApp) throw new Error('no .app in update')
  const dest = app.getPath('exe').split('/Contents/MacOS/')[0]   // /Applications/My Habit Addiction.app
  const script = path.join(tmp, 'swap.sh')
  fs.writeFileSync(script, [
    '#!/bin/bash',
    'PID="$1"; NEW="$2"; DEST="$3"',
    'for i in $(seq 1 60); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done',
    'sleep 1',
    'INCOMING="${DEST}.incoming"; BACKUP="${DEST}.bak"',
    'rm -rf "$INCOMING" "$BACKUP"',
    '/usr/bin/ditto "$NEW" "$INCOMING" || { /usr/bin/open "$DEST"; exit 1; }',
    '/usr/bin/xattr -dr com.apple.quarantine "$INCOMING" 2>/dev/null',
    '/bin/mv "$DEST" "$BACKUP" 2>/dev/null',
    'if /bin/mv "$INCOMING" "$DEST"; then rm -rf "$BACKUP"; else /bin/mv "$BACKUP" "$DEST" 2>/dev/null; fi',
    '/usr/bin/open "$DEST"',
  ].join('\n') + '\n')
  fs.chmodSync(script, 0o755)
  spawn('/bin/bash', [script, String(process.pid), newApp, dest], { detached: true, stdio: 'ignore' }).unref()
  setTimeout(() => app.quit(), 400)
  return { ok: true, installing: true }
}

// One-click update on Windows: download the NSIS installer and run it silently;
// it replaces the app in place and relaunches. We quit so files aren't locked.
async function installWin(url, sigUrl) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'habit-update-'))
  const exePath = path.join(tmp, 'Setup.exe')
  await downloadFile(url, exePath)
  // INTEGRITY GATE: verify before we run the installer (fail closed).
  if (!sigUrl || !(await verifyArtifactSignature(exePath, sigUrl))) {
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch { /* */ }
    return { ok: false, error: 'signature verification failed' }
  }
  spawn(exePath, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref()
  setTimeout(() => app.quit(), 400)
  return { ok: true, installing: true }
}

// Only ever fetch/open update URLs from GitHub's own hosts. The renderer hands us a
// URL it read from the releases API, but we re-validate here (the trust boundary is
// main, not the renderer): require HTTPS and a hostname of exactly github.com or a
// *.githubusercontent.com subdomain (where release assets are actually served).
// Anything else (other host, http, embedded credentials, IP) is rejected — this stops
// a compromised/spoofed renderer from turning the auto-installer into "download and
// run an arbitrary .exe / swap in an arbitrary .app".
function isAllowedUpdateUrl(url) {
  if (typeof url !== 'string') return false
  let u
  try { u = new URL(url) } catch { return false }
  if (u.protocol !== 'https:') return false
  if (u.username || u.password) return false           // no user:pass@evil.com tricks
  const h = u.hostname.toLowerCase()
  return h === 'github.com'
    || h === 'githubusercontent.com'
    || h.endsWith('.githubusercontent.com')
}

function registerUpdateIpc() {
  ipcMain.handle('update:check', () => checkForUpdate())
  ipcMain.handle('update:open', (_e, url) => {
    if (!isAllowedUpdateUrl(url)) return { ok: false, error: 'bad url' }
    shell.openExternal(url)
    return { ok: true }
  })
  // One-click self-install. On any failure the renderer falls back to opening the
  // plain download, so the user is never left stuck.
  ipcMain.handle('update:install', async (_e, url, sigUrl) => {
    if (!isAllowedUpdateUrl(url)) return { ok: false, error: 'bad url' }
    // The signature URL is MANDATORY and must also be a GitHub host. Making it
    // required is the secure default: an attacker who controls the feed can't strip
    // the .sig to skip the check, and a release published without a .sig simply won't
    // self-install (the renderer falls back to the browser download). Old, unsigned
    // releases are therefore never self-installed — exactly what we want.
    if (!isAllowedUpdateUrl(sigUrl)) return { ok: false, error: 'missing signature url' }
    try {
      if (process.platform === 'darwin') return await installMac(url, sigUrl)
      if (process.platform === 'win32') return await installWin(url, sigUrl)
      return { ok: false, error: 'unsupported platform' }
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) }
    }
  })
}

function createWindow() {
  // Keep the normal window size; only cap it if the screen genuinely can't fit it
  // (so it never opens off-screen on a small display). The CONTENT is what scales
  // down — see the zoom below — not the window.
  let winH = 880
  try {
    winH = Math.min(880, screen.getPrimaryDisplay().workAreaSize.height)
  } catch { /* */ }
  const win = new BrowserWindow({
    width: 430,            // the UI is designed phone-portrait, so the window is narrow
    height: winH,
    minWidth: 360,
    minHeight: 480,
    backgroundColor: '#FBEAF3',   // kawaii pink, shown before the app paints
    title: 'My Habit Addiction',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,     // renderer can't touch Node directly (secure default)
      nodeIntegration: false,
      // Run the renderer in the OS sandbox. SAFE with this preload: it uses ONLY
      // contextBridge + ipcRenderer (invoke/on/removeListener), all of which are
      // available to sandboxed preloads. It does NOT require any other Node built-in
      // at runtime, so no `require()` breaks. (Electron has defaulted preloads to
      // sandboxed since v20; we set it explicitly so it can't regress.)
      sandbox: true,
    },
  })

  mainWin = win

  win.on('closed', () => { if (mainWin === win) mainWin = null })

  // Pin the window to its own origin. This app is a HashRouter SPA, so in-app route
  // changes are hash updates that do NOT fire will-navigate/will-redirect — only a
  // REAL navigation (a stray window.location =, a form post, an injected link) does.
  // Anything not pointing at our own origin is cancelled and (if external http/s)
  // opened in the real browser instead.
  const ORIGIN = isDev ? DEV_URL : APP_URL
  const isSameOrigin = (target) => {
    try {
      const u = new URL(target)
      const base = new URL(ORIGIN)
      return u.protocol === base.protocol && u.host === base.host
    } catch { return false }
  }
  const guardNav = (e, url) => {
    if (isSameOrigin(url)) return            // legit same-origin (rare; hash routing won't hit this)
    e.preventDefault()
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)   // send real web links to the browser
  }
  win.webContents.on('will-navigate', guardNav)
  win.webContents.on('will-redirect', guardNav)

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('did-fail-load', code, desc, url)
  })

  // NOTE: content scaling is now done IN the app by AppScaleStage (one transform that
  // fits the fixed-design UI to the window). So we leave the native zoomFactor at its
  // default 1 — applying zoom here too would double-scale. The "App size" slider feeds
  // AppScaleStage as a fine-tune multiplier.

  win.loadURL(isDev ? DEV_URL : APP_URL)

  // Links to external sites open in the user's real browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Headless verification hook: with HABIT_CAPTURE set to a file path, snapshot
  // the window after it paints and quit. Lets us prove the build renders without
  // a human looking at the screen. No-op in normal use.
  if (process.env.HABIT_CAPTURE) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const img = await win.webContents.capturePage()
          fs.writeFileSync(process.env.HABIT_CAPTURE, img.toPNG())
          const len = await win.webContents.executeJavaScript('document.getElementById("root")?.innerHTML.length || 0')
          console.log('CAPTURE rootHtmlLength=' + len)
          // Music diagnostic: did the Web Audio buffer decode + is it set up?
          const music = await win.webContents.executeJavaScript(
            'window.__musicState ? JSON.stringify(window.__musicState()) : "no-state"')
          console.log('CAPTURE music=' + music)
        } catch (e) { console.error('capture failed', e) }
        app.quit()
      }, 2800)
    })
  }
}

app.whenReady().then(() => {
  registerAppProtocol()
  registerBlockerIpc()
  registerUpdateIpc()
  createWindow()
  // Start the localhost bridge for the browser extension. Drains it reports are
  // forwarded to the renderer, which spends the coins through the store.
  rotblockBridge.start({
    port: BRIDGE_PORT,
    onDrain: (payload) => {
      if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('rb:drain', payload)
    },
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
