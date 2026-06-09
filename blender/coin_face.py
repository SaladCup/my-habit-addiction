"""Render a clean FACE-ON coin sprite (orthographic, transparent) for the
falling-coin cascade. Run: blender --background --python coin_face.py
"""
import bpy, math
BASE = "/Users/laurenmcnamara/Documents/Claude/Projects/My Habit Addiction/app"
OUT  = BASE + "/public/ui/coin_face.png"

bpy.ops.wm.open_mainfile(filepath=BASE + "/blender/coin_gold.blend")
scene = bpy.context.scene
coin = bpy.data.objects.get("GoldCoin")
coin.rotation_euler = (math.radians(90), 0, 0)   # face straight at the camera

cam = scene.camera
cam.location = (0, -4.3, 0)                       # dead-centre in front
cam.data.type = 'ORTHO'                           # flat, no perspective skew
cam.data.ortho_scale = 2.25

try:
    p = bpy.context.preferences.addons['cycles'].preferences
    p.compute_device_type = 'METAL'; p.refresh_devices()
    for d in p.devices: d.use = True
    scene.cycles.device = 'GPU'
except Exception:
    scene.cycles.device = 'CPU'
scene.cycles.samples = 200; scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("FACE DONE ->", OUT)
