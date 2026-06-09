"""Make a lightweight coin .glb for the 3D cascade (many instances need low polys).
Run: blender --background --python decimate_coin.py
"""
import bpy
BASE = "/Users/laurenmcnamara/Documents/Claude/Projects/My Habit Addiction/app"
OUT = BASE + "/public/models/coin_low.glb"

bpy.ops.wm.open_mainfile(filepath=BASE + "/blender/coin_gold.blend")
coin = bpy.data.objects.get("GoldCoin")
bpy.ops.object.select_all(action='DESELECT')
coin.select_set(True); bpy.context.view_layer.objects.active = coin

before = len(coin.data.polygons)
dec = coin.modifiers.new("dec", 'DECIMATE')
dec.decimate_type = 'COLLAPSE'; dec.ratio = 0.02
bpy.ops.object.modifier_apply(modifier="dec")

coin.rotation_euler = (0, 0, 0)   # canonical: flat in XY, axis = Z
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True)
print("DECIMATE %d -> %d tris" % (before, len(coin.data.polygons)))
