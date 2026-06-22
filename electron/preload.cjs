// Preload — the ONLY bridge between the web app and the native shell. Runs with
// access to Electron APIs but exposes a tiny, explicit surface to the React app
// via window.desktop. This is where the blocker's native controls are exposed,
// one method at a time.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,            // the web app checks this to enable desktop-only features
  platform: process.platform, // 'darwin' (Mac) | 'win32' (Windows)

  // Which app is in the foreground right now. Resolves to:
  //   { ok: true,  app: { name, bundleId, path, pid, title } | null }
  //   { ok: false, needsPermission: true, error }   ← macOS Accessibility not granted yet
  getActiveApp: () => ipcRenderer.invoke('blocker:active-app'),
  // List all open apps so the user can pick one to block from a menu.
  listOpenApps: () => ipcRenderer.invoke('blocker:list-apps'),

  // Block actions (v1, non-destructive): pull our lock-screen window to the
  // front and keep it on top of the Brainrot until unblocked.
  focusSelf: () => ipcRenderer.invoke('blocker:focus'),
  setOnTop: (on) => ipcRenderer.invoke('blocker:on-top', on),
  // The real block: grow our window to fill the screen (opaque, click-blocking)
  // so the Brainrot is fully covered, and restore phone size when unblocked.
  cover: (on) => ipcRenderer.invoke('blocker:cover', on),

  // UI scale ("App size") — scales the page content; window size is unchanged.
  setUiZoom: (z) => ipcRenderer.invoke('ui:zoom', z),
  openAccessibilitySettings: () => ipcRenderer.invoke('blocker:open-accessibility'),
  // Screen Recording = needed to read the window title (how we match Firefox sites).
  getScreenStatus: () => ipcRenderer.invoke('blocker:screen-status'),
  openScreenRecordingSettings: () => ipcRenderer.invoke('blocker:open-screen-recording'),

  // Browser-extension bridge: the renderer pushes RotBlock state to the local
  // server the extension reads; the extension's coin drains come back via onRbDrain.
  rbPublishState: (state) => ipcRenderer.invoke('rb:publish-state', state),
  rbExtensionActive: () => ipcRenderer.invoke('rb:extension-active'),
  onRbDrain: (cb) => {
    const handler = (_e, payload) => cb(payload)
    ipcRenderer.on('rb:drain', handler)
    return () => ipcRenderer.removeListener('rb:drain', handler)
  },

  // Auto-update: ask the public releases repo whether a newer version exists,
  // and open the right installer to download. Resolves to:
  //   { ok, updateAvailable, latestVersion, currentVersion, downloadUrl, releaseUrl }
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  openUpdateDownload: (url) => ipcRenderer.invoke('update:open', url),
  // One-click self-install: downloads + swaps the app + relaunches. Resolves
  // { ok: true, installing: true } (the app then quits) or { ok: false } to fall back.
  installUpdate: (url) => ipcRenderer.invoke('update:install', url),
  // Subscribe to download progress (0..1). Returns an unsubscribe function.
  onUpdateProgress: (cb) => {
    const handler = (_e, frac) => cb(frac)
    ipcRenderer.on('update:progress', handler)
    return () => ipcRenderer.removeListener('update:progress', handler)
  },
})
