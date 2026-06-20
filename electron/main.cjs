// Electron main process — the thin native shell that wraps the React app in a
// real desktop window (Mac + Windows) instead of a browser tab.
//
// In dev it loads the Vite dev server (hot reload). When packaged it serves the
// built dist/ through a custom `app://` protocol — NOT file:// — because Chromium
// blocks ES-module loading over file://, which would leave a blank screen.
const { app, BrowserWindow, shell, protocol } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

// Dev = loading the live Vite server. Packaged = loading the built files.
// HABIT_FORCE_PROD lets us test the built (app://) path without packaging.
const isDev = !app.isPackaged && !process.env.HABIT_FORCE_PROD
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
const DIST = path.join(__dirname, '..', 'dist')
const APP_URL = 'app://bundle/index.html'

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
    try {
      const data = await fs.promises.readFile(filePath)
      const ext = path.extname(filePath).toLowerCase()
      return new Response(data, { headers: { 'content-type': MIME[ext] || 'application/octet-stream' } })
    } catch {
      const data = await fs.promises.readFile(path.join(DIST, 'index.html'))
      return new Response(data, { headers: { 'content-type': 'text/html' } })
    }
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

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('did-fail-load', code, desc, url)
  })

  win.loadURL(isDev ? DEV_URL : APP_URL)

  // Links to external sites open in the user's real browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
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
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
