"""Generate a smooth heart height-map (white puffy heart on black) for Blender
displacement. Anti-aliased silhouette + domed interior = clean, non-jaggedy emboss.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = "/Users/laurenmcnamara/Documents/Claude/Projects/My Habit Addiction/app/blender/heart_height.png"
SS  = 2048          # supersample, downscaled at the end for clean anti-aliasing

# ── parametric heart outline (many samples = smooth curve) ──
n = 600
pts = []
for i in range(n):
    t = (i / n) * 2 * math.pi
    x = 16 * math.sin(t) ** 3
    y = 13 * math.cos(t) - 5 * math.cos(2*t) - 2 * math.cos(3*t) - math.cos(4*t)
    pts.append((x, y))
xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
cx = (min(xs)+max(xs))/2; cy = (min(ys)+max(ys))/2
span = max(max(xs)-min(xs), max(ys)-min(ys))
margin = 0.22   # heart fills ~56% of the frame (it's mapped onto a larger disc in Blender)
scale = SS * (1 - 2*margin) / span
img_pts = [(SS/2 + (x-cx)*scale, SS/2 - (y-cy)*scale) for (x, y) in pts]   # flip y → upright

# ── filled mask ──
mask_img = Image.new('L', (SS, SS), 0)
ImageDraw.Draw(mask_img).polygon(img_pts, fill=255)
mask = np.asarray(mask_img, dtype=np.float32) / 255.0

# ── dome: blur the mask, clip to the sharp silhouette → defined edge + puffy top ──
blur_img = mask_img.filter(ImageFilter.GaussianBlur(radius=SS * 0.10))
blur = np.asarray(blur_img, dtype=np.float32) / 255.0
height = blur * mask
height = height / height.max()
height = height ** 0.7                      # rounder dome

# Save 16-BIT (no banding → smooth displacement). Resize the float first.
hf = Image.fromarray(height.astype(np.float32), mode='F').resize((1024, 1024), Image.LANCZOS)
h16 = (np.clip(np.asarray(hf, dtype=np.float32), 0.0, 1.0) * 65535.0).astype(np.uint16)
Image.fromarray(h16).save(OUT)
print("saved 16-bit", OUT)
