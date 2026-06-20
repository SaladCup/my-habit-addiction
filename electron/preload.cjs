// Preload — the ONLY bridge between the web app and the native shell. Runs with
// access to Electron APIs but exposes a tiny, explicit surface to the React app
// via window.desktop. This is where the blocker's native controls (detect the
// foreground app, block/unblock, etc.) will be exposed later, one method at a time.
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,            // the web app checks this to enable desktop-only features
  platform: process.platform, // 'darwin' (Mac) | 'win32' (Windows)
})
