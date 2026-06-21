// electron-builder afterPack hook (CommonJS — runs under Node regardless of the
// project's "type": "module").
//
// WHY: we ship the Mac app UNSIGNED (no paid Apple Developer cert). On Apple
// Silicon, an app whose bundle isn't validly signed is reported by macOS as
// "“…” is damaged and can't be opened" — a dead end with no obvious bypass.
// Re-applying a valid AD-HOC signature here downgrades that to the ordinary,
// bypassable "unverified developer" prompt (right-click → Open, or
// Settings → Privacy & Security → Open Anyway).
//
// This is NOT notarization — downloads still show one warning. To make them open
// with zero warnings, enroll in the Apple Developer Program and switch to real
// Developer ID signing + notarization.
//
// HOW: sign every nested executable/bundle INSIDE-OUT, then the app bundle last.
// We deliberately do NOT use `codesign --deep`: it re-adds a FinderInfo (kHasBundle)
// xattr to nested bundles and then fails on its own "detritus not allowed" check.
// We also strip xattrs around the signing (FinderInfo / resource forks break
// codesign). On a headless CI runner there's no Finder re-adding those bits, so
// the sequence completes cleanly; locally the Finder can interfere, so any failure
// is non-fatal (we ship as-is, never worse than the previous unsigned build).
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] })
  // Sign with the STABLE self-signed certificate when CI provides it (SIGN_IDENTITY),
  // else ad-hoc ('-') for local builds. A stable identity is what lets macOS keep the
  // Accessibility (TCC) grant across updates instead of re-asking every version.
  const identity = process.env.SIGN_IDENTITY || '-'
  // Strip xattrs on the target (recursively) then sign — with a few retries, because
  // a local Finder can re-add the FinderInfo bit in the microsecond between the two.
  // Stripping right before each sign keeps that race window tiny; CI has no Finder.
  const sign = (p) => {
    let lastErr
    for (let attempt = 0; attempt < 5; attempt++) {
      try { run('xattr', ['-cr', p]) } catch { /* ignore */ }
      try { run('codesign', ['--force', '--sign', identity, p]); return } catch (e) { lastErr = e }
    }
    throw lastErr
  }

  try {
    // Collect nested signables, INSIDE-OUT (a bundle is pushed only after its
    // contents). Nested Mach-O helpers must be signed or they won't launch on arm64.
    const nested = []
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name)
        let st
        try { st = fs.lstatSync(full) } catch { continue }
        if (st.isSymbolicLink()) continue
        if (st.isDirectory()) {
          walk(full)
          if (name.endsWith('.app') || name.endsWith('.framework')) nested.push(full)
        } else if (/\.(dylib|node|so)$/.test(name) || name === 'chrome_crashpad_handler') {
          nested.push(full)
        }
      }
    }
    const fwDir = path.join(appPath, 'Contents', 'Frameworks')
    if (fs.existsSync(fwDir)) walk(fwDir)
    const unpacked = path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked')
    if (fs.existsSync(unpacked)) walk(unpacked)

    console.log(`[afterPack] ad-hoc signing ${path.basename(appPath)} (${nested.length} nested items)`)
    for (const p of nested) sign(p)   // inside-out
    sign(appPath)                     // the main bundle, last
    // Self-check (non-strict so a benign FinderInfo bit doesn't read as failure;
    // the cdhash validity is what decides "damaged" vs "unverified developer").
    try { run('xattr', ['-cr', appPath]) } catch { /* ignore */ }
    run('codesign', ['--verify', '--deep', appPath])
    console.log('[afterPack] ad-hoc signature applied + verified ✓')
  } catch (e) {
    console.warn('[afterPack] ad-hoc signing did not complete; shipping as-is '
      + '(no worse than an unsigned build). Reason:', e && e.message)
  }
}
