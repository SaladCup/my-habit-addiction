"""Render the remaining turntable frames (24-29) from the saved coin .blend,
to complete a full 30-frame 360° loop. Run: blender --background --python finish_spin.py
"""
import bpy, math
BASE = "/Users/laurenmcnamara/Documents/Claude/Projects/My Habit Addiction/app"
SPINDIR = BASE + "/public/ui/coin_spin"

bpy.ops.wm.open_mainfile(filepath=BASE + "/blender/coin_gold.blend")
scene = bpy.context.scene
coin = bpy.data.objects.get("GoldCoin")

try:
    p = bpy.context.preferences.addons['cycles'].preferences
    p.compute_device_type = 'METAL'; p.refresh_devices()
    for d in p.devices: d.use = True
    scene.cycles.device = 'GPU'
except Exception as e:
    scene.cycles.device = 'CPU'
scene.cycles.samples = 96; scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = 480
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

spin = bpy.data.objects.new("Spin", None); scene.collection.objects.link(spin)
coin.parent = spin
coin.matrix_parent_inverse = spin.matrix_world.inverted()
for i in range(24, 30):
    spin.rotation_euler.z = (i / 30) * 2 * math.pi
    bpy.context.view_layer.update()
    scene.render.filepath = SPINDIR + ("/frame_%03d.png" % i)
    bpy.ops.render.render(write_still=True)
print("FILLED FRAMES 24-29")
