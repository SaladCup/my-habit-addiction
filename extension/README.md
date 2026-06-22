# RotBlock browser extension

Reliable, granular website blocking for **My Habit Addiction**, tied to your coins.
Unlike the desktop window-cover, this reads the real URL in every browser — so it can
block **just `youtube.com/shorts`** (or a keyword, or a whole site) and leave the rest alone.

## How it works
- The desktop app runs a tiny local server on `127.0.0.1:7691` (only while the app is open).
- The extension reads your RotBlock targets + coin balance + Break Glass from it.
- When you open a Brainrot site with **0 free time**, the tab is redirected to a "Brainrot locked" page.
- While you browse a Brainrot with time left, it **spends coins** just like the desktop app does.
- The app must be running for site blocking to enforce (no app = no coin data = fail-open).

## Rule formats (set them in the app: Spend → RotBlock → add a site)
| You type | Blocks |
|---|---|
| `youtube.com` | all of YouTube |
| `youtube.com/shorts` | **only Shorts** — normal videos stay open |
| `reddit.com/r/all` | just that path |
| `tiktok` | any URL containing "tiktok" (keyword) |

## Build the loadable folders
```
node extension/build.mjs
```
This generates `extension/dist/chrome/` and `extension/dist/firefox/`.

## Load it
**Chrome / Edge / Brave:**
1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → pick `extension/dist/chrome`

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → pick `extension/dist/firefox/manifest.json`
   *(Temporary add-ons clear on Firefox restart — a signed permanent build comes later.)*

Click the ✨ RotBlock toolbar icon to confirm it says **connected**.

## Notes / limitations (MVP)
- There can be a brief flash of the page before it redirects (a network-level block to
  remove the flash is a planned upgrade).
- The "Open My Habit Addiction" button tries a `habitaddiction://` link; until the app
  registers that, just open the app manually to earn time.
