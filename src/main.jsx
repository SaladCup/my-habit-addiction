import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (bundled into the build) so they work offline AND under the
// strict desktop Content-Security-Policy — no Google Fonts network dependency.
import '@fontsource/fredoka/400.css'
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/fredoka/700.css'
import '@fontsource/mulish/400.css'
import '@fontsource/mulish/500.css'
import '@fontsource/mulish/600.css'
import '@fontsource/mulish/700.css'
import '@fontsource/mulish/800.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
