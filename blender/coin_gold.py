"""Kawaii locket coin: thick glossy gold outer ring + inner ring framing a big
PUFFY gold heart. Renders a hero (transparent PNG), exports .glb, saves .blend.
Run headless:  blender --background --python coin_gold.py
"""
import bpy, bmesh, math
from math import radians

BASE  = "/Users/laurenmcnamara/Documents/Claude/Projects/My Habit Addiction/app"
HERO  = BASE + "/public/ui/coin_gold_3d.png"
GLB   = BASE + "/public/models/coin_gold.glb"
BLEND = BASE + "/blender/coin_gold.blend"

DEPTH = 0.13
TOP   = DEPTH / 2

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def make_active(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.context.view_layer.objects.active = o

def gold(name, color, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    def s(k, v):
        try: b.inputs[k].default_value = v
        except Exception: pass
    s("Base Color", color); s("Metallic", 1.0); s("Roughness", rough)
    s("Coat Weight", 0.4); s("Coat Roughness", 0.06)
    return m

MAT  = gold("Gold",      (1.0, 0.76, 0.26, 1.0), 0.11)   # rings + body — rich yellow gold
MATH = gold("HeartGold", (1.0, 0.80, 0.33, 1.0), 0.09)   # heart, a touch brighter + glossier

parts = []

# ── body disc ───────────────────────────────────────────────────────
bpy.ops.mesh.primitive_cylinder_add(vertices=160, radius=1.0, depth=DEPTH)
body = bpy.context.active_object
bev = body.modifiers.new("b", 'BEVEL'); bev.width = 0.035; bev.segments = 5; bev.limit_method = 'ANGLE'
make_active(body); bpy.ops.object.modifier_apply(modifier="b")
body.data.materials.append(MAT)   # body kept separate; the detail (rings+heart) gets mirrored to the back

# ── two concentric gold rings on the front face ─────────────────────
def ring(major, minor):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=(0, 0, TOP),
                                     major_segments=72, minor_segments=16)
    r = bpy.context.active_object
    make_active(r); bpy.ops.object.shade_smooth()
    r.data.materials.append(MAT); parts.append(r)
ring(0.86, 0.09)   # thick rounded outer ring (near the rim)
ring(0.50, 0.04)   # inner ring — sits over the heart-disc edge to hide the seam

# ── heart emboss: displace a fine grid with the heart height-map ────
# (image-driven → smooth, perfectly centered, no jaggedy procedural geometry)
HEART_PNG = BASE + "/blender/heart_height.png"
bpy.ops.mesh.primitive_grid_add(x_subdivisions=440, y_subdivisions=440, size=1.1,
                                location=(0, 0, TOP + 0.002))
disc = bpy.context.active_object; disc.name = "HeartEmboss"
# clip the square grid to a CIRCLE (radius 0.5) → no box edge; the circular edge
# tucks under the inner ring so there's no visible seam.
me = disc.data; bmc = bmesh.new(); bmc.from_mesh(me)
bmesh.ops.delete(bmc, geom=[v for v in bmc.verts if (v.co.x*v.co.x + v.co.y*v.co.y) > 0.25], context='VERTS')
bmc.to_mesh(me); bmc.free()
himg = bpy.data.images.load(HEART_PNG)
himg.colorspace_settings.name = 'Non-Color'   # raw height data, no sRGB curve
htex = bpy.data.textures.new("heartTex", 'IMAGE'); htex.image = himg; htex.extension = 'EXTEND'
disp = disc.modifiers.new("disp", 'DISPLACE')
disp.texture = htex; disp.texture_coords = 'UV'; disp.mid_level = 0.0; disp.strength = 0.11
make_active(disc); bpy.ops.object.modifier_apply(modifier="disp")
bpy.ops.object.shade_smooth()
disc.data.materials.append(MAT); parts.append(disc)   # same gold as body

# ── join the front detail, MIRROR it to the back, then merge with the body ──
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join(); detail = bpy.context.active_object
mirO = bpy.data.objects.new("MirO", None); scene.collection.objects.link(mirO)   # mirror plane at world z=0
mir = detail.modifiers.new("mir", 'MIRROR'); mir.use_axis = (False, False, True); mir.mirror_object = mirO
make_active(detail); bpy.ops.object.modifier_apply(modifier="mir")
bpy.data.objects.remove(mirO, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); detail.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join(); coin = bpy.context.active_object; coin.name = "GoldCoin"

# face toward camera; gentle tilt to catch the gloss
coin.rotation_euler = (radians(87), 0, 0)

# ── world: bright warm env for shiny speculars ──────────────────────
world = bpy.data.worlds.new("W"); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.52, 0.45, 0.32, 1.0); bg.inputs[1].default_value = 1.2

# ── lighting: bright key + rim for glossy highlights ────────────────
def area(name, loc, energy, size):
    bpy.ops.object.light_add(type='AREA', location=loc)
    L = bpy.context.active_object; L.name = name; L.data.energy = energy; L.data.size = size
    c = L.constraints.new('TRACK_TO'); c.target = coin; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
area("Key",  (-2.6, -3.4, 3.6), 4600, 1.8)   # brighter + sharper → hot glossy highlight
area("Fill", ( 3.4, -2.6, 1.4),  900, 6.0)
area("Rim",  ( 1.6,  3.2, 3.0), 2400, 3.2)
area("Top",  ( 0.0, -1.0, 4.2), 1400, 4.0)

# ── camera: mostly front, slight upper-left ─────────────────────────
bpy.ops.object.camera_add(location=(-0.7, -4.3, 1.0)); cam = bpy.context.active_object
cam.data.lens = 78
c = cam.constraints.new('TRACK_TO'); c.target = coin; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
scene.camera = cam

# ── render ──────────────────────────────────────────────────────────
scene.render.engine = 'CYCLES'
try:
    p = bpy.context.preferences.addons['cycles'].preferences
    p.compute_device_type = 'METAL'; p.refresh_devices()
    for d in p.devices: d.use = True
    scene.cycles.device = 'GPU'
except Exception as e:
    scene.cycles.device = 'CPU'; print("CPU", e)
scene.cycles.samples = 220; scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = 1400
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

make_active(coin)
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
scene.render.filepath = HERO
bpy.ops.render.render(write_still=True)
print("DONE ->", HERO)

# ── turntable: spin about world Z, render frames so you can see all sides ──
import os
SPINDIR = BASE + "/public/ui/coin_spin"
os.makedirs(SPINDIR, exist_ok=True)
spin = bpy.data.objects.new("Spin", None); scene.collection.objects.link(spin)
coin.parent = spin
coin.matrix_parent_inverse = spin.matrix_world.inverted()   # keep the coin's tilt
scene.render.resolution_x = scene.render.resolution_y = 480
scene.cycles.samples = 96
FRAMES = 30
for i in range(FRAMES):
    spin.rotation_euler.z = (i / FRAMES) * 2 * math.pi
    bpy.context.view_layer.update()
    scene.render.filepath = SPINDIR + ("/frame_%03d.png" % i)
    bpy.ops.render.render(write_still=True)
print("TURNTABLE DONE", FRAMES, "frames ->", SPINDIR)
