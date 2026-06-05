import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Always run on a fixed, known port so the launcher / bookmark always match.
  server: { port: 5173, strictPort: true },
})
