// Preload — the ONLY bridge between the web app and the native shell. Runs with
// access to Electron APIs but exposes a tiny, explicit surface to the React app
// via window.desktop. This is where the blocker's native controls are exposed,
// one method at a time.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,            // the web app checks this to enable desktop-only features
  platform: process.platform, // 'darwin' (Mac) | 'win32' (Windows)

  // Which app is in the foreground right now. Resolves to:
  //   { ok: true,  app: { name, bundleId, path, title } | null }
  //   { ok: false, needsPermission: true, error }   ← macOS Accessibility not granted yet
  getActiveApp: () => ipcRenderer.invoke('blocker:active-app'),
})
