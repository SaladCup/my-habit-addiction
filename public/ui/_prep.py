#!/usr/bin/env python3
"""Prep raw kawaii UI art into clean, web-sized, transparent PNGs."""
import os
from collections import deque
from PIL import Image

UI = os.path.dirname(os.path.abspath(__file__))

def load_rgba(name):
    return Image.open(os.path.join(UI, name)).convert("RGBA")

def is_whiteish(px, thr=238):
    r, g, b, a = px
    return a > 10 and r >= thr and g >= thr and b >= thr

def flood_remove_white(img, thr=238):
    """Make the exterior white background transparent via BFS from all edges.
    Interior whites (wings, highlights, sparkles) are preserved because they
    are not connected to the border through white pixels."""
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    q = deque()
    def consider(x, y):
        i = y * w + x
        if seen[i]:
            return
        seen[i] = 1
        if is_whiteish(px[x, y], thr):
            px[x, y] = (255, 255, 255, 0)
            q.append((x, y))
    for x in range(w):
        consider(x, 0); consider(x, h - 1)
    for y in range(h):
        consider(0, y); consider(w - 1, y)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                consider(nx, ny)
    return img

def trim(img):
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img

def fit(img, max_w=None, max_h=None):
    w, h = img.size
    s = 1.0
    if max_w: s = min(s, max_w / w)
    if max_h: s = min(s, max_h / h)
    if s < 1.0:
        img = img.resize((round(w*s), round(h*s)), Image.LANCZOS)
    return img

def save(img, name):
    p = os.path.join(UI, name)
    img.save(p, optimize=True)
    print(f"  {name}: {img.size[0]}x{img.size[1]}  ({os.path.getsize(p)//1024} KB)")

# ---- 1. slice the icon sprite sheet into 4 tiles -------------------------
print("icon sheet ->")
sheet = flood_remove_white(load_rgba("_src_iconsheet.png"))
w, h = sheet.size
px = sheet.load()
# column has content if any pixel has alpha
col_has = []
for x in range(w):
    has = False
    for y in range(0, h, 3):
        if px[x, y][3] > 20:
            has = True; break
    col_has.append(has)
# find contiguous runs of content columns
runs = []
start = None
for x in range(w):
    if col_has[x] and start is None:
        start = x
    elif not col_has[x] and start is not None:
        if x - start > 40:
            runs.append((start, x))
        start = None
if start is not None:
    runs.append((start, w))
print(f"  detected {len(runs)} tiles")
names = ["icon_home", "icon_settings", "icon_stats", "icon_spin"]
for i, (a, b) in enumerate(runs[:4]):
    tile = trim(sheet.crop((a, 0, b, h)))
    tile = fit(tile, max_w=200, max_h=200)
    save(tile, f"{names[i]}.png")

# ---- 2. quill (editor tab icon) -----------------------------------------
print("quill ->")
save(fit(trim(flood_remove_white(load_rgba("_src_quill.png"))), max_w=200, max_h=200), "icon_editor.png")

# ---- 3. jar (bead collection) -------------------------------------------
print("jar ->")
save(fit(trim(flood_remove_white(load_rgba("_src_jar.png"))), max_w=600), "jar.png")

# ---- 4. logo ------------------------------------------------------------
print("logo ->")
save(fit(trim(flood_remove_white(load_rgba("_src_logo.png"))), max_w=700), "logo.png")

# ---- 5. slot cabinet ----------------------------------------------------
print("slot cabinet ->")
save(fit(trim(flood_remove_white(load_rgba("_src_slotcabinet.png"))), max_w=900), "slot_cabinet.png")

# ---- 6. backgrounds (keep opaque, just web-size) ------------------------
print("backgrounds ->")
save(fit(load_rgba("_src_bg_clouds.png").convert("RGB").convert("RGBA"), max_w=900), "bg_clouds.png")
save(fit(load_rgba("_src_bg_sunburst.png").convert("RGB").convert("RGBA"), max_w=900), "bg_sunburst.png")

print("done.")
