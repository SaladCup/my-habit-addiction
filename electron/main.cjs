// Electron main process — the thin native shell that wraps the React app in a
// real desktop window (Mac + Windows) instead of a browser tab.
//
// In dev it loads the Vite dev server (hot reload). When packaged it serves the
// built dist/ through a custom `app://` protocol — NOT file:// — because Chromium
// blocks ES-module loading over file://, which would leave a blank screen.
const { app, BrowserWindow, shell, protocol, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

// Dev = loading the live Vite server. Packaged = loading the built files.
// HABIT_FORCE_PROD lets us test the built (app://) path without packaging.
const isDev = !app.isPackaged && !process.env.HABIT_FORCE_PROD
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
const DIST = path.join(__dirname, '..', 'dist')
const APP_URL = 'app://bundle/index.html'
let mainWin = null   // the app window, so blocker IPC can raise/cover it

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
    if (!filePath.startsWith(DIST)) return new Response('forbidden', { status: 403 })
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

function registerBlockerIpc() {
  ipcMain.handle('blocker:active-app', async () => {
    try {
      const activeWindow = await getActiveWindowFn()
      const w = await activeWindow()
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

  // Open the macOS Accessibility settings pane directly (so the user can grant the
  // permission RotBlock needs to see the front app + browser URL).
  ipcMain.handle('blocker:open-accessibility', () => {
    if (process.platform === 'darwin') {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')
    }
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
    // Pick the installer for this OS: .dmg on Mac, .exe on Windows.
    const wantExt = process.platform === 'darwin' ? '.dmg' : '.exe'
    const asset = assets.find(a => String(a.name || '').toLowerCase().endsWith(wantExt))
    return {
      ok: true,
      updateAvailable: !!latestVersion && isNewerVersion(latestVersion, currentVersion),
      latestVersion,
      currentVersion,
      downloadUrl: asset ? asset.browser_download_url : data.html_url,
      releaseUrl: data.html_url,
    }
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) }
  }
}

function registerUpdateIpc() {
  ipcMain.handle('update:check', () => checkForUpdate())
  ipcMain.handle('update:open', (_e, url) => {
    if (typeof url === 'string' && /^https:\/\//.test(url)) shell.openExternal(url)
    return { ok: true }
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 430,            // the UI is designed phone-portrait, so the window is narrow
    height: 880,
    minWidth: 360,
    minHeight: 600,
    backgroundColor: '#FBEAF3',   // kawaii pink, shown before the app paints
    title: 'My Habit Addiction',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,     // renderer can't touch Node directly (secure default)
      nodeIntegration: false,
    },
  })

  mainWin = win

  win.on('closed', () => { if (mainWin === win) mainWin = null })

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('did-fail-load', code, desc, url)
  })

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
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
