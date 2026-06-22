#!/usr/bin/env node
// Sign the updater-fetched artifacts with the project's Ed25519 PRIVATE key (held
// only in CI as the UPDATE_SIGNING_KEY secret — base64 of the PKCS8 PEM). Writes a
// detached <name>.sig (base64 of the raw 64-byte Ed25519 signature) next to each
// artifact. The app verifies these before installing (see electron/main.cjs
// verifyArtifactSignature). NO pre-hash: Ed25519 signs the raw file bytes, and Node
// requires the null algorithm for Ed25519.
//
// Runs on each matrix runner (macOS signs the -mac.zip/.dmg; Windows signs the .exe).
// Idempotent + skips non-matching files, so each runner only emits sigs for what it
// built. If the secret is absent it no-ops cleanly (the build still succeeds; those
// releases just won't self-install — the app falls back to the browser download).
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const b64 = process.env.UPDATE_SIGNING_KEY
if (!b64) { console.log('No UPDATE_SIGNING_KEY — skipping signing.'); process.exit(0) }

const pem = Buffer.from(b64, 'base64').toString('utf8')
let key
try { key = crypto.createPrivateKey(pem) } catch (e) {
  console.error('Could not parse UPDATE_SIGNING_KEY as a private key:', e.message); process.exit(1)
}
if (key.asymmetricKeyType !== 'ed25519') { console.error('Key is not ed25519'); process.exit(1) }

// Sign EXACTLY the artifacts the in-app updater fetches. The .dmg is browser-download
// only (not self-installed), but we sign it too so a future dmg self-install path is
// already covered.
const SIGN_EXT = [/-mac\.zip$/i, /\.exe$/i, /\.dmg$/i]
const dir = process.argv[2] || 'release'

let n = 0
for (const name of fs.readdirSync(dir)) {
  if (name.endsWith('.sig')) continue
  if (!SIGN_EXT.some(re => re.test(name))) continue
  const file = path.join(dir, name)
  const bytes = fs.readFileSync(file)
  const sig = crypto.sign(null, bytes, key)          // null algo == Ed25519
  fs.writeFileSync(file + '.sig', sig.toString('base64') + '\n')
  // Self-check: the matching public key must verify what we just wrote, so a
  // key/secret mismatch fails the build loudly instead of shipping bad sigs.
  if (process.env.UPDATE_PUBLIC_KEY_PEM) {
    const ok = crypto.verify(null, bytes, crypto.createPublicKey(process.env.UPDATE_PUBLIC_KEY_PEM), sig)
    if (!ok) { console.error('Self-verify FAILED for', name); process.exit(1) }
  }
  console.log('signed', name, '->', name + '.sig')
  n++
}
if (n === 0) console.log('No matching artifacts to sign in', dir)
