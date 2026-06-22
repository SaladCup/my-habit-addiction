// Builds loadable extension folders for each browser from the shared source:
//   dist/chrome   → load via chrome://extensions (Developer mode → Load unpacked)
//   dist/firefox  → load via about:debugging (Load Temporary Add-on → pick manifest.json)
// Each browser wants a file literally named manifest.json, so we copy the right one.
import { rmSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const shared = ['background.js', 'content.js', 'blocked.html', 'blocked.css', 'blocked.js', 'popup.html', 'popup.js']

for (const browser of ['chrome', 'firefox']) {
  const out = join(root, 'dist', browser)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(join(out, 'icons'), { recursive: true })
  for (const f of shared) copyFileSync(join(root, f), join(out, f))
  for (const f of readdirSync(join(root, 'icons'))) copyFileSync(join(root, 'icons', f), join(out, 'icons', f))
  copyFileSync(join(root, `manifest.${browser}.json`), join(out, 'manifest.json'))
  console.log('built dist/' + browser)
}
