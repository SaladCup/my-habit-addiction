import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built app loads over file:// inside Electron
  // (and still works fine when served over http). Pairs with HashRouter.
  base: './',
  // Always run on a fixed, known port so the launcher / bookmark / Electron match.
  server: { port: 5173, strictPort: true },
})
