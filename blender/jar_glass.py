"""
jar_glass.py - Procedural build for the "bead jar" hero asset (My Habit Addiction).

Companion to jar_glass.blend, which is the CANONICAL file: it contains everything
this script builds PLUS the two external assets the script can't fetch standalone:

  * BOW  - Sketchfab "Pink Ribbon Bow" by BAHDDIE.TS4 (license: CC-Attribution),
           UID cbb9fe662260481197632d1594166e98. Imported via BlenderMCP at
           target_size ~1.2, tinted with the Satin material, then placed with
           tuck_bow() (recline + push back to the no-clip line).
           ATTRIBUTION required if shipped: "Pink Ribbon Bow - BAHDDIE.TS4 / Sketchfab".
  * HDRI - PolyHaven "brown_photostudio_02" (2k, CC0), set as the world environment
           for glass reflections + lighting. The visible background is overridden by
           a dreamy pastel gradient for camera rays only (setup_backdrop()).

Everything else - both jar bodies, the pink glass, pearl necklaces, the 7 shimmer
gem materials, and the deterministically-packed marble fill - is built here.

Run inside the saved file:   blender jar_glass.blend --python jar_glass.py
(or a fresh scene, then re-import the bow + HDRI before tuck_bow/render).

Notes:
 - Beads are PLACED deterministically (hex-ish packing), NOT physics-simulated -
   headless rigid-body baking proved unreliable; packing is exact and clip-free.
 - Render: Cycles, Metal GPU. AgX view transform suits the glass highlights.
"""
import bpy, math, random

# ----------------------------------------------------------------- parameters
# (radius, z) silhouettes, revolved around Z. Rounded matches the app PNG jar.
PROFILE_ROUNDED = [(0.00,0.00),(0.55,0.00),(0.72,0.05),(0.80,0.16),(0.84,0.45),
    (0.85,0.95),(0.84,1.28),(0.78,1.50),(0.62,1.66),(0.50,1.74),(0.48,1.82),
    (0.50,1.90),(0.47,1.93)]
PROFILE_APOTHECARY = [(0.00,0.00),(0.62,0.00),(0.74,0.06),(0.76,0.18),(0.75,0.40),
    (0.74,2.30),(0.72,2.55),(0.78,2.68),(0.80,2.78),(0.76,2.82)]
ROUNDED_X, APOTH_X = -1.35, 1.5            # side-by-side placement

# 7 bead colors: app DEFAULT_BEAD_SLOTS, saturated for 3D, + a gold that matches
# coin_gold.py. (App slots: Rose Quartz, Orchid, Sky, Mint, Coral, Rainbow —
# the rainbow is the WILD CARD bead and gets its own gradient gem material.)
BEAD_COLORS = [("RoseQuartz","#FF8FB8"),("Orchid","#C77BE6"),("Sky","#6FB4F2"),
    ("Mint","#5FD3A8"),("Coral","#FF9472")]
GOLD_LINEAR = (1.0, 0.79, 0.32)            # lightened warm gold ~ the coin


def hex_to_lin(h):
    """sRGB hex -> Blender scene-linear RGB."""
    h = h.lstrip('#'); s = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
    return tuple(f(c) for c in s)


def _set(bsdf, name, val):
    if name in bsdf.inputs:
        bsdf.inputs[name].default_value = val


# ----------------------------------------------------------------- materials
def make_glass():
    """Faint-pink Cycles glass (full transmission, thin solidified wall)."""
    mat = bpy.data.materials.get("GlassPink") or bpy.data.materials.new("GlassPink")
    mat.use_nodes = True
    b = mat.node_tree.nodes.get("Principled BSDF")
    _set(b, "Base Color", (1.0, 0.86, 0.91, 1.0))
    _set(b, "Metallic", 0.0); _set(b, "Roughness", 0.03); _set(b, "IOR", 1.45)
    if "Transmission Weight" in b.inputs: _set(b, "Transmission Weight", 1.0)
    else: _set(b, "Transmission", 1.0)
    return mat


def make_pearl():
    """Waxy pearlescent white: subsurface + glossy coat."""
    mat = bpy.data.materials.get("Pearl") or bpy.data.materials.new("Pearl")
    mat.use_nodes = True
    b = mat.node_tree.nodes.get("Principled BSDF")
    _set(b, "Base Color", (0.96, 0.94, 0.93, 1.0))
    _set(b, "Roughness", 0.13)
    _set(b, "Subsurface Weight", 0.3); _set(b, "Subsurface Radius", (0.3, 0.2, 0.2))
    _set(b, "Coat Weight", 1.0); _set(b, "Coat Roughness", 0.06)
    return mat


def make_gem(name, hexcol=None, gold=False):
    """Glossy translucent gem: colored core glow + white star sparkle + coat.
    gold=True makes a lighter metallic gold matching the coin."""
    col = GOLD_LINEAR if gold else hex_to_lin(hexcol)
    mat = bpy.data.materials.get("Gem_"+name) or bpy.data.materials.new("Gem_"+name)
    mat.use_nodes = True; nt = mat.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (1250, 0)
    b = nt.nodes.new("ShaderNodeBsdfPrincipled"); b.location = (450, 250)
    _set(b, "Base Color", (*col, 1)); _set(b, "Roughness", 0.05); _set(b, "IOR", 1.48)
    _set(b, "Coat Weight", 1.0); _set(b, "Coat Roughness", 0.015)
    if gold:
        _set(b, "Metallic", 0.75); _set(b, "Roughness", 0.14)
    else:
        _set(b, "Transmission Weight", 0.38)      # translucent gem body
    tc = nt.nodes.new("ShaderNodeTexCoord"); tc.location = (-950, 0)
    # colored inner glow, radial from sphere centre
    d = nt.nodes.new("ShaderNodeVectorMath"); d.operation = 'DISTANCE'; d.location = (-720, 200)
    d.inputs[1].default_value = (0.5, 0.5, 0.5)
    nt.links.new(tc.outputs["Generated"], d.inputs[0])
    cr = nt.nodes.new("ShaderNodeValToRGB"); cr.location = (-520, 200)
    cr.color_ramp.elements[0].position = 0.0;  cr.color_ramp.elements[0].color = (1,1,1,1)
    cr.color_ramp.elements[1].position = 0.55; cr.color_ramp.elements[1].color = (0,0,0,1)
    nt.links.new(d.outputs["Value"], cr.inputs["Fac"])
    cm = nt.nodes.new("ShaderNodeMath"); cm.operation = 'MULTIPLY'; cm.location = (-300, 200)
    cm.inputs[1].default_value = 0.9
    nt.links.new(cr.outputs["Color"], cm.inputs[0])
    eG = nt.nodes.new("ShaderNodeEmission"); eG.location = (450, -60)
    eG.inputs["Color"].default_value = (*[min(1, c*1.7) for c in col], 1)
    nt.links.new(cm.outputs[0], eG.inputs["Strength"])
    # white star sparkle (voronoi -> tight ramp -> emission)
    v = nt.nodes.new("ShaderNodeTexVoronoi"); v.location = (-720, -220); v.inputs["Scale"].default_value = 22.0
    nt.links.new(tc.outputs["Generated"], v.inputs["Vector"])
    sr = nt.nodes.new("ShaderNodeValToRGB"); sr.location = (-520, -220)
    sr.color_ramp.elements[0].position = 0.0;  sr.color_ramp.elements[0].color = (1,1,1,1)
    sr.color_ramp.elements[1].position = 0.055; sr.color_ramp.elements[1].color = (0,0,0,1)
    nt.links.new(v.outputs["Distance"], sr.inputs["Fac"])
    sm = nt.nodes.new("ShaderNodeMath"); sm.operation = 'MULTIPLY'; sm.location = (-300, -220)
    sm.inputs[1].default_value = 20.0
    nt.links.new(sr.outputs["Color"], sm.inputs[0])
    eS = nt.nodes.new("ShaderNodeEmission"); eS.location = (450, -260); eS.inputs["Color"].default_value = (1,1,1,1)
    nt.links.new(sm.outputs[0], eS.inputs["Strength"])
    a1 = nt.nodes.new("ShaderNodeAddShader"); a1.location = (850, 100)
    a2 = nt.nodes.new("ShaderNodeAddShader"); a2.location = (1050, 0)
    nt.links.new(b.outputs[0], a1.inputs[0]); nt.links.new(eG.outputs[0], a1.inputs[1])
    nt.links.new(a1.outputs[0], a2.inputs[0]); nt.links.new(eS.outputs[0], a2.inputs[1])
    nt.links.new(a2.outputs[0], out.inputs[0])
    return mat


def make_gem_rainbow():
    """RAINBOW wild-card gem: a soft pastel hue sweep across the bead (object-
    space gradient -> hue) through the same glossy translucent gem body."""
    mat = bpy.data.materials.get("Gem_Rainbow") or bpy.data.materials.new("Gem_Rainbow")
    mat.use_nodes = True; nt = mat.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (900, 0)
    b = nt.nodes.new("ShaderNodeBsdfPrincipled"); b.location = (520, 100)
    _set(b, "Roughness", 0.05); _set(b, "IOR", 1.48)
    _set(b, "Transmission Weight", 0.38)
    _set(b, "Coat Weight", 1.0); _set(b, "Coat Roughness", 0.015)
    # object-space diagonal gradient -> pastel hue wheel
    tc = nt.nodes.new("ShaderNodeTexCoord"); tc.location = (-900, 0)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); sep.location = (-700, 0)
    nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath"); add.operation = 'ADD'; add.location = (-520, 0)
    nt.links.new(sep.outputs["X"], add.inputs[0]); nt.links.new(sep.outputs["Z"], add.inputs[1])
    rng = nt.nodes.new("ShaderNodeMapRange"); rng.location = (-340, 0)
    rng.inputs["From Min"].default_value = -1.4; rng.inputs["From Max"].default_value = 1.4
    nt.links.new(add.outputs[0], rng.inputs["Value"])
    hsv = nt.nodes.new("ShaderNodeCombineColor"); hsv.mode = 'HSV'; hsv.location = (-150, 0)
    nt.links.new(rng.outputs["Result"], hsv.inputs[0])     # hue sweeps 0..1
    hsv.inputs[1].default_value = 0.42                      # pastel saturation
    hsv.inputs[2].default_value = 1.0
    nt.links.new(hsv.outputs["Color"], b.inputs["Base Color"])
    # gentle inner glow follows the gradient too
    eG = nt.nodes.new("ShaderNodeEmission"); eG.location = (520, -160)
    nt.links.new(hsv.outputs["Color"], eG.inputs["Color"])
    eG.inputs["Strength"].default_value = 0.35
    mix = nt.nodes.new("ShaderNodeAddShader"); mix.location = (730, 0)
    nt.links.new(b.outputs[0], mix.inputs[0]); nt.links.new(eG.outputs[0], mix.inputs[1])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return mat


# ----------------------------------------------------------------- geometry
def build_jar(name, profile, loc, glass, wall=0.03, sub=2):
    """Revolve a profile into a glass shell (Screw -> Solidify -> Subsurf)."""
    verts = [(x, 0.0, z) for (x, z) in profile]
    edges = [(i, i+1) for i in range(len(verts)-1)]
    me = bpy.data.meshes.new(name+"_mesh"); me.from_pydata(verts, edges, []); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    sc = ob.modifiers.new("Screw", 'SCREW')
    sc.axis = 'Z'; sc.angle = math.radians(360); sc.steps = 96; sc.use_merge_vertices = True
    so = ob.modifiers.new("Solidify", 'SOLIDIFY'); so.thickness = wall; so.offset = 0.0
    sm = ob.modifiers.new("Subsurf", 'SUBSURF'); sm.levels = sub; sm.render_levels = sub
    ob.location = loc
    for p in me.polygons: p.use_smooth = True
    ob.data.materials.append(glass)
    return ob


def profile_r(profile, z):
    """Outer radius of a (radius-by-z used as z-by-radius) profile at height z."""
    pts = [(zz, r) for (r, zz) in profile]      # (z, radius)
    if z <= pts[0][0]: return pts[0][1]
    for i in range(len(pts)-1):
        z0, r0 = pts[i]; z1, r1 = pts[i+1]
        if z0 <= z <= z1:
            return r0 + (r1-r0) * ((z-z0)/(z1-z0))
    return pts[-1][1]


def outer_radius_at(obj_name, z, band=0.022):
    """Evaluated (post-modifier) outer radius of a jar at height z, narrow band."""
    deps = bpy.context.evaluated_depsgraph_get()
    ob = bpy.data.objects[obj_name]; ev = ob.evaluated_get(deps); me = ev.to_mesh()
    cx = ob.location.x; rmax = 0.0
    for v in me.vertices:
        co = ob.matrix_world @ v.co
        if abs(co.z - z) <= band:
            r = ((co.x - cx)**2 + co.y**2) ** 0.5
            if r > rmax: rmax = r
    ev.to_mesh_clear(); return rmax


# ----------------------------------------------------------------- pearls
def pearl_ring(tag, jar_name, cx, z, pearl_mesh, pearl_mat, pr=0.056, off=0.8):
    """Ring of linked-mesh pearls seated snug just outside the measured neck."""
    for o in list(bpy.data.objects):
        if o.name.startswith(tag+"_pearl") or o.name == tag+"_Pearls":
            bpy.data.objects.remove(o, do_unlink=True)
    gr = outer_radius_at(jar_name, z); ring_r = gr + pr * off
    parent = bpy.data.objects.new(tag+"_Pearls", None); bpy.context.collection.objects.link(parent)
    count = max(16, round(2*math.pi*ring_r / (pr*2.05)))
    for i in range(count):
        a = 2*math.pi*i/count
        ob = bpy.data.objects.new(f"{tag}_pearl_{i}", pearl_mesh); ob.scale = (pr, pr, pr)
        ob.location = (cx + ring_r*math.cos(a), ring_r*math.sin(a), z)
        bpy.context.collection.objects.link(ob); ob.parent = parent
    return count


def _bow_meshes(top_name):
    top = bpy.data.objects.get(top_name); res = []
    def rec(o):
        if o.type == 'MESH': res.append(o)
        for c in o.children: rec(c)
    if top: rec(top)
    return res


def fit_pearls(tag, bow_top, margin=0.004):
    """Hide only the pearls that physically intersect the bow mesh."""
    bows = _bow_meshes(bow_top); hidden = 0
    for o in bpy.data.objects:
        if not o.name.startswith(tag+"_pearl_"): continue
        pr = o.scale.x; pt = o.location.copy(); clip = False
        for mo in bows:
            ok, loc, n, i = mo.closest_point_on_mesh(mo.matrix_world.inverted() @ pt)
            if ok and ((mo.matrix_world @ loc) - pt).length < pr + margin:
                clip = True; break
        o.hide_render = clip; o.hide_viewport = clip; hidden += clip
    return hidden


# ----------------------------------------------------------------- bead fill
def fill_jar(tag, profile, cx, mats, bead_mesh, R=0.06, top_z=1.34, wall=0.04, seed=9):
    """Deterministic hex-ish marble packing inside the jar interior (no physics)."""
    random.seed(seed)
    HS = R * 2.2; VS = R * 1.87      # horizontal / vertical spacing (clip-free)
    for o in list(bpy.data.objects):
        if o.name.startswith(tag+"Bead"): bpy.data.objects.remove(o, do_unlink=True)
    idx = 0; layer = 0; z = R + 0.09
    while z < top_z:
        ur = profile_r(profile, z) - wall - R
        pts = [(0.0, 0.0)] if ur > 0 else []
        off = (HS*0.5) if (layer % 2) else 0.0
        ring = HS
        while ring <= ur + 0.001:
            n = max(1, int(round(2*math.pi*ring/HS)))
            for k in range(n):
                a = 2*math.pi*k/n + off/ring + random.uniform(-0.05, 0.05)
                pts.append((ring*math.cos(a), ring*math.sin(a)))
            ring += HS
        for (px, py) in pts:
            bm = bead_mesh.copy(); bm.materials.clear(); bm.materials.append(mats[idx % len(mats)])
            ob = bpy.data.objects.new(f"{tag}Bead_{idx}", bm); ob.scale = (R, R, R)
            ob.location = (cx+px+random.uniform(-0.008,0.008), py+random.uniform(-0.008,0.008),
                           z+random.uniform(-0.01,0.01))
            ob.rotation_euler = (random.uniform(0, 6.28),)*3
            bpy.context.collection.objects.link(ob); idx += 1
        z += VS; layer += 1
    return idx


# ----------------------------------------------------------------- bow placement
def tuck_bow(bow_top, profile, cx, neck_z, recline_deg=-5, margin=0.02):
    """Recline the (already-imported, tinted) bow and push it back to the closest
    position that doesn't intersect the jar surface/opening. Returns final y."""
    rim_z = profile[-1][1] if False else max(z for (_, z) in profile) - 0.06
    open_r = profile_r(profile, rim_z) - 0.02
    def worst_pen():
        deps = bpy.context.evaluated_depsgraph_get(); w = -99.0
        for mo in _bow_meshes(bow_top):
            ev = mo.evaluated_get(deps); me = ev.to_mesh(); mw = mo.matrix_world; vs = me.vertices
            for i in range(0, len(vs), 11):
                co = mw @ vs[i].co; z = co.z
                r = ((co.x-cx)**2 + co.y**2) ** 0.5
                cR = profile_r(profile, z) if (0.1 < z <= rim_z) else (open_r if z > rim_z else None)
                if cR is None: continue
                if cR - r > w: w = cR - r
            ev.to_mesh_clear()
        return w
    bow = bpy.data.objects.get(bow_top)
    bow.rotation_euler = (math.radians(recline_deg), 0, 0)
    bow.location.x = cx; bow.location.z = neck_z; bow.location.y = -(profile_r(profile, neck_z) + 0.7)
    for _ in range(60):
        bow.location.y += 0.02
        if worst_pen() > -margin:
            bow.location.y -= 0.02; break
    return bow.location.y


# ----------------------------------------------------------------- backdrop
def setup_backdrop():
    """Camera sees a soft pink->lavender gradient; reflections still see the HDRI."""
    world = bpy.context.scene.world; nt = world.node_tree
    env = next((n for n in nt.nodes if n.type == 'TEX_ENVIRONMENT'), None)
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_WORLD'), None)
    bgH = next((n for n in nt.nodes if n.type == 'BACKGROUND'), None) or nt.nodes.new('ShaderNodeBackground')
    if env: nt.links.new(env.outputs['Color'], bgH.inputs['Color'])
    texco = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(texco.outputs['Window'], sep.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[0].color = (0.97, 0.86, 0.91, 1)
    ramp.color_ramp.elements[1].position = 1.0; ramp.color_ramp.elements[1].color = (0.83, 0.79, 0.93, 1)
    ramp.color_ramp.elements.new(0.5).color = (0.93, 0.85, 0.95, 1)
    nt.links.new(sep.outputs['Y'], ramp.inputs['Fac'])
    bgC = nt.nodes.new('ShaderNodeBackground'); nt.links.new(ramp.outputs['Color'], bgC.inputs['Color'])
    lp = nt.nodes.new('ShaderNodeLightPath'); mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(bgH.outputs['Background'], mix.inputs[1])   # reflections -> HDRI
    nt.links.new(bgC.outputs['Background'], mix.inputs[2])   # camera     -> gradient
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])


# ----------------------------------------------------------------- driver
def main():
    """Rebuild the procedural scene. Bow + HDRI come from jar_glass.blend / BlenderMCP."""
    glass = make_glass(); pearl_mat = make_pearl()
    gem_mats = ([make_gem(n, h) for (n, h) in BEAD_COLORS]
                + [make_gem_rainbow(), make_gem("Gold", gold=True)])

    build_jar("Jar_Rounded", PROFILE_ROUNDED, (ROUNDED_X, 0, 0.02), glass)
    build_jar("Jar_Apothecary", PROFILE_APOTHECARY, (APOTH_X, 0, 0.02), glass)

    # shared low-poly bead + pearl template meshes
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(0, 0, -9))
    bead = bpy.context.active_object; bead.name = "BeadTemplateXS"; bpy.ops.object.shade_smooth()
    bead.hide_render = bead.hide_viewport = True
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=1.0, location=(0, 0, -9))
    pearl = bpy.context.active_object; pearl.name = "PearlTemplate"; bpy.ops.object.shade_smooth()
    pearl.data.materials.append(pearl_mat); pearl.hide_render = pearl.hide_viewport = True

    pearl_ring("Rounded", "Jar_Rounded", ROUNDED_X, 1.77, pearl.data, pearl_mat)
    pearl_ring("Apoth", "Jar_Apothecary", APOTH_X, 2.60, pearl.data, pearl_mat)

    fill_jar("Jar", PROFILE_ROUNDED, ROUNDED_X, gem_mats, bead.data, R=0.06, top_z=1.34, seed=13)
    fill_jar("Apoth", PROFILE_APOTHECARY, APOTH_X, gem_mats, bead.data, R=0.06, top_z=2.28, seed=21)

    # EXTERNAL: import bow (Sketchfab cbb9fe66...) + HDRI (PolyHaven brown_photostudio_02)
    # via BlenderMCP, tint the bow with a satin pink material, then:
    #   tuck_bow("Sketchfab_model", PROFILE_ROUNDED, ROUNDED_X, 1.80)
    #   tuck_bow("Bow_Apoth",       PROFILE_APOTHECARY, APOTH_X, 2.60)
    #   fit_pearls("Rounded", "Sketchfab_model"); fit_pearls("Apoth", "Bow_Apoth")
    setup_backdrop()
    print("jar_glass: procedural build complete (bow + HDRI come from the .blend)")


if __name__ == "__main__":
    main()
