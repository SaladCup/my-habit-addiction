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

## 🆕 To generate (Phase 2)

### Beads — **256 × 256** each (square, transparent, centered, identical size & lighting)
Current beads are ~171px and slightly inconsistent — regenerate the whole set uniform.
`bead-1` `bead-2` `bead-3` `bead-4` `bead-5` `bead-6` `bead-gold` → 7 files, all **256×256**.
Glossy glass-marble look; 6 distinct pastel colors + 1 gold (special).

### Wheel
Pick ONE approach and tell me:
- **A (preferred, keeps values dynamic):** decorative pieces only — `wheel_hub` **240×240** (center cap), `wheel_pointer` **180×260** (top ticker), optional `wheel_rim` **1024×1024** (outer ring). I draw the colored segments + numbers dynamically inside.
- **B (fully painted):** `wheel_face` **1024×1024** square with segments + values baked in (then values are fixed and can't scale by tier).

### Coin — **128 × 128** (for the Phase-3 coin cascade)
`coin` 128×128, square, transparent, glossy gold coin (a heart or star face fits the theme). One is enough to start.

---

## Quick reference — everything that must be 216×216
All nav icons + the new bank icon. If it goes in the bottom nav, it's 216×216.
