# Asset Spec — exact dimensions (source of truth)

Generate every art asset to these exact pixel sizes. This stops the size churn.

**Global rules**
- **Transparent-background PNG** for everything except full-bleed backgrounds.
- Consistent light source (top-left), consistent kawaii / magical-girl style.
- Square assets must be *truly* square with the art centered and **even margins** (so they render identically).
- Keep a high-res master; I down-size web copies in `public/ui/` via the prep pipeline.
- Drop new art in `~/Desktop/My Habit Addiciton Assets/` and tell me.

Legend: ✅ done · 🆕 to generate

---

## Icons — **216 × 216** (square, transparent, identical framing)
The pink ornate tile + heart-gem-on-top style, content centered, even padding.
| Asset | Size | Status |
|---|---|---|
| `icon_home` (castle) | 216×216 | ✅ |
| `icon_beads` (rainbow orb) | 216×216 | ✅ |
| `icon_stats` (crown bars) | 216×216 | ✅ |
| `icon_editor` (quill) | 216×216 | ✅ |
| `icon_settings` (gear) | 216×216 | ✅ |
| `icon_bank` (bank/piggy/vault) | **216×216** | 🆕 — must match the others exactly |

## App icon — **1024 × 1024** (square)
| Asset | Size | Status |
|---|---|---|
| `app-icon` (jar-with-face) | 1024×1024 | ✅ (favicon + dock derived from it) |

---

## Logos / baked text graphics (transparent)
| Asset | Size | Status |
|---|---|---|
| `logo` ("My Habit Addiction" + tagline) | 700×467 | ✅ |
| `tap_banner` ("Tap a habit to earn a bead, silly!") | 760×253 | ✅ |
_Note: after we pick a font, future labels should be live text, not baked images, so they stay editable._

## Frames / containers (transparent, ornate border, flat interior, even borders)
| Asset | Size | Ratio | Status |
|---|---|---|---|
| `frame_popup` (cash prompt, celebrations) | 600×900 | 2:3 | ✅ |
| `frame_onboard` (tall first-run form) | 600×1200 | 1:2 | ✅ |
| `frame_med` (compact popups) | 396×352 | ~9:8 | ✅ |
| `habit_card` (row; border-image, flat middle + rose caps) | 720×480 | 3:2 | ✅ |

## Big art
| Asset | Size | Status |
|---|---|---|
| `bg_sunburst` (framed background; app locks to this ratio) | 768×1344 | ✅ |
| `jar` (beads render inside; opening + interior matter for physics) | 600×874 | ✅ |
| `slot_cabinet` (3×3 cells + SPIN + 2 display screens) | 900×1815 | ✅ |

---

## Phase 2 art

### Beads — **256 × 256** each (square, transparent, centered, identical size & lighting) ✅
`bead-1..6` + `bead-gold` → 7 files, all **256×256**, sliced uniform from the marble sheet.
Glossy glass-marble look; 6 pastels + 1 gold. Slot colors/names synced to the art
(1 Rose Quartz · 2 Orchid · 3 Sky · 4 Mint · 5 Coral · 6 Cherry).

### Wheel — **Option A chosen** ✅ (decorative pieces; segments drawn dynamically so values scale by tier)
| Asset | Spec | Actual | Status |
|---|---|---|---|
| `wheel_rim` (outer ring) | 1024×1024 | 1024×1024 | ✅ |
| `wheel_hub` (center cap) | 240×240 | 240×240 | ✅ |
| `wheel_pointer` (top ticker) | ~180×260 | **323×280** (native aspect kept; art is a downward heart-gem plaque, wider than tall) | ✅ |
Wired in `components/Wheel.jsx`: rim/hub/pointer are static overlays; SVG value
segments (R=142 in a 320 box) spin underneath the rim's inner lip.

### Bonus wheel — decorative pieces ✅ (same approach as the main wheel)
The bonus round (`/bonus`, `components/BonusWheel.jsx`) now uses its own kawaii
chrome; the 5 weighted slices + labels are drawn in code. **Slices (fixed):** `75%`
(biggest), `FREE 🎁`, `50%`, `25%`, `FREE 🎁`.
| Asset | Size | Status |
|---|---|---|
| `bonus_rim` (outer ring) | 1024×1024 | ✅ |
| `bonus_hub` (center cap) | 512×512 | ✅ |
| `bonus_pointer` (top ticker) | 318×300 | ✅ |
Wired bigger than before (BOX 300 → **440**); rim/hub/pointer are static overlays,
slices spin underneath (R=195 in a 440 box), same as the main wheel.

### 🆕 Coin — **128 × 128** (for the Phase-3 coin cascade)
`coin` 128×128, square, transparent, glossy gold coin (a heart or star face fits the theme). One is enough to start.

### Spend tab icon — **216 × 216** ✅
`icon_spend` — coin pouch spilling gold coins (cash-out, not a piggy bank). Wired as
the 6th nav tab → `/spend` (`screens/SpendScreen.jsx`): balance + log-a-treat + history.

---

## Quick reference — everything that must be 216×216
All nav icons + the new bank icon. If it goes in the bottom nav, it's 216×216.
