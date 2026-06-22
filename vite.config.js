import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Bake the app version in so the UI can show it (see App.jsx — window title).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Relative asset paths so the built app loads over file:// inside Electron
  // (and still works fine when served over http). Pairs with HashRouter.
  base: './',
  // Always run on a fixed, known port so the launcher / bookmark / Electron match.
  server: { port: 5173, strictPort: true },
})
