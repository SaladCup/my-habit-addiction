"""Generate a NORMAL MAP for the coin face (concentric rings + puffy heart) from
a smooth height field. Applied to a flat low-poly disk in Three.js, the scene
light reveals the relief — smooth, sharp, and almost free (no geometry).
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = "/Users/laurenmcnamara/Documents/Claude/Projects/My Habit Addiction/app/public/ui/coin_normal.png"
N = 1024

yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
c = (N - 1) / 2.0
dx = (xx - c) / (N / 2); dy = (yy - c) / (N / 2)      # normalized −1..1
r = np.sqrt(dx * dx + dy * dy)

h = np.zeros((N, N), np.float32)

# concentric rings — smooth rounded annulus bumps
def ring(rr, w, amp): return amp * np.exp(-((r - rr) / w) ** 2)
h += ring(0.79, 0.050, 1.00)    # thick outer ring (near the rim)
h += ring(0.46, 0.032, 0.78)    # inner ring framing the heart

# puffy heart in the centre (parametric outline → filled → blurred dome)
mask = Image.new('L', (N, N), 0)
pts = []
for i in range(400):
    t = (i / 400) * 2 * math.pi
    hx = 16 * math.sin(t) ** 3
    hy = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
    pts.append((hx, hy))
xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
hcx = (min(xs) + max(xs)) / 2; hcy = (min(ys) + max(ys)) / 2
span = max(max(xs) - min(xs), max(ys) - min(ys))
sc = (0.30 * N) / span
ImageDraw.Draw(mask).polygon([(c + (px - hcx) * sc, c - (py - hcy) * sc) for (px, py) in pts], fill=255)
m = np.asarray(mask, np.float32) / 255.0
mb = np.asarray(mask.filter(ImageFilter.GaussianBlur(N * 0.030)), np.float32) / 255.0
heart = mb * m
if heart.max() > 0: heart = (heart / heart.max()) ** 0.7
h += heart * 1.05
h = h / h.max()

# height → tangent-space normal map (OpenGL convention: +Y up = green)
S = 38.0
gx, gy = np.gradient(h * S)
inv = 1.0 / np.sqrt(gx * gx + gy * gy + 1.0)
nx = -gx * inv; ny = gy * inv; nz = inv
rgb = np.stack([nx * 0.5 + 0.5, ny * 0.5 + 0.5, nz * 0.5 + 0.5], axis=-1)
Image.fromarray((rgb * 255).astype(np.uint8), 'RGB').save(OUT)
print("saved normal map", OUT)
