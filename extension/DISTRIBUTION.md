# Publishing the RotBlock extension (for friends, with auto-update)

The CI workflow (`.github/workflows/extension.yml`) runs on every `vX.Y.Z` tag and:
- always builds **`rotblock-chrome.zip`** (for the Chrome Web Store),
- **signs Firefox** + publishes **`rotblock-firefox.xpi`** + **`updates.json`** *if* the AMO secrets exist,
- optionally pushes to the **Chrome Web Store** *if* the Chrome secrets exist.

Everything lands on the **public releases repo** (`SaladCup/my-habit-addiction-releases`)
next to the app installers. The extension version is kept in lockstep with the app version.

---

## Firefox — fully automated (do this first; it's your main browser)

Friends install a **signed `.xpi` in one click** from the releases page, and it **auto-updates**.

1. Sign in / create a Mozilla account, then open **https://addons.mozilla.org/developers/addon/api/key/**
2. Click **Generate new credentials**. Copy the two values (the **secret is shown once**):
   - **JWT issuer**  → secret name `WEB_EXT_API_KEY`
   - **JWT secret**  → secret name `WEB_EXT_API_SECRET`
3. In the **private** code repo (`SaladCup/my-habit-addiction`) → **Settings → Secrets and
   variables → Actions → New repository secret**, add both.
4. That's it. The next `vX.Y.Z` tag signs the add-on (unlisted, no human review) and publishes
   the `.xpi` + `updates.json`. Share this install link with friends:
   `https://github.com/SaladCup/my-habit-addiction-releases/releases/latest/download/rotblock-firefox.xpi`

---

## Chrome — Web Store (auto-updates via the store)

Chrome blocks self-hosted auto-update, so the store is the only auto-updating path.

1. Register at **https://chrome.google.com/webstore/devconsole** (one-time **$5** fee).
2. After the next release, download **`rotblock-chrome.zip`** from the releases page.
3. In the dev console: **New item → upload the zip →** fill the listing (set visibility to
   **Unlisted** for friends-only) → **Submit for review** (first review: hours–days).
4. Per release, upload the new `.zip` the same way — the store auto-updates everyone.

### (Optional) Automate Chrome uploads later
Once the item exists, you can let CI push updates. Add these secrets and the workflow does it:
- `CHROME_EXTENSION_ID` (the item id from the dev console)
- `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN` (Google Cloud OAuth —
  enable the "Chrome Web Store API", make a Desktop OAuth client, generate a refresh token).

---

## Reminder
The extension needs the **desktop app running** (v0.1.30+) to read your coins via the local
bridge. So friends install **both** the app and the extension.
