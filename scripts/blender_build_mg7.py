import bpy
import math
import os


OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "models", "turrets", "mg7_modular")


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)
    for block in bpy.data.images:
        bpy.data.images.remove(block)


def ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def make_material(name, base, metallic, roughness, emission=(0, 0, 0, 1), emission_strength=0.0):
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    bsdf = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        raise RuntimeError(f"Could not find Principled BSDF for material {name}")
    bsdf.inputs["Base Color"].default_value = base
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Emission Color"].default_value = emission
    bsdf.inputs["Emission Strength"].default_value = emission_strength
    return material


def add_bevel(obj, width=0.02, segments=3):
    mod = obj.modifiers.new(name="Bevel", type="BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(30)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def shade_smooth(obj, auto_angle=math.radians(40)):
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()
    if hasattr(bpy.ops.object, "shade_auto_smooth"):
        bpy.ops.object.shade_auto_smooth(angle=auto_angle)
    obj.select_set(False)


def set_material(obj, material):
    if obj.data.materials:
      obj.data.materials[0] = material
    else:
      obj.data.materials.append(material)


def cube(name, size, location, scale=(1, 1, 1), rotation=(0, 0, 0), material=None, bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(size=size, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        add_bevel(obj, width=bevel, segments=3)
    if material:
        set_material(obj, material)
    shade_smooth(obj)
    return obj


def cylinder(name, radius, depth, location, rotation=(0, 0, 0), vertices=24, material=None, bevel=0.01):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    if bevel:
        add_bevel(obj, width=bevel, segments=2)
    if material:
        set_material(obj, material)
    shade_smooth(obj)
    return obj


def empty(name, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    obj.location = location
    bpy.context.scene.collection.objects.link(obj)
    return obj


def parent(child, parent_obj):
    child.parent = parent_obj
    return child


def add_bolt_ring(parent_obj, radius, z, count, mat):
    for idx in range(count):
        angle = (idx / count) * math.pi * 2
        x = math.cos(angle) * radius
        y = math.sin(angle) * radius
        bolt = cylinder(
            f"bolt_{count}_{idx}",
            radius=0.022,
            depth=0.02,
            location=(x, y, z),
            material=mat,
            bevel=0.003,
            vertices=12,
        )
        parent(bolt, parent_obj)


def build_base(base_static, mats):
    skirt = cylinder("pedestal_skirt", 0.62, 0.4, (0, 0, 0.18), material=mats["base_dark"], vertices=10, bevel=0.016)
    parent(skirt, base_static)
    lower_ring = cylinder("pedestal_lower_ring", 0.68, 0.04, (0, 0, 0.01), material=mats["weapon_dark"], vertices=24, bevel=0.008)
    parent(lower_ring, base_static)
    ring = cylinder("pedestal_ring", 0.4, 0.06, (0, 0, 0.39), material=mats["weapon_mid"], vertices=24, bevel=0.01)
    parent(ring, base_static)
    collar = cylinder("pedestal_collar", 0.16, 0.18, (0, 0, 0.5), material=mats["edge"], vertices=20, bevel=0.01)
    parent(collar, base_static)
    deck = cube("turret_deck", 1.0, (0, 0.01, 0.61), scale=(0.42, 0.42, 0.045), material=mats["weapon_dark"], bevel=0.014)
    parent(deck, base_static)
    pivot_cap = cylinder("pivot_cap", 0.1, 0.04, (0, 0, 0.62), material=mats["base_mid"], vertices=20, bevel=0.006)
    parent(pivot_cap, base_static)
    add_bolt_ring(base_static, 0.17, 0.57, 10, mats["edge"])


def build_hull(turret_yaw, mats):
    lower = cube("hull_lower", 1.0, (0, -0.01, 0.73), scale=(0.43, 0.33, 0.09), material=mats["shadow"], bevel=0.016)
    parent(lower, turret_yaw)
    body = cube("hull_main", 1.0, (0, -0.02, 0.95), scale=(0.34, 0.28, 0.24), material=mats["hull"], bevel=0.024)
    parent(body, turret_yaw)
    roof = cube("roof", 1.0, (0, -0.02, 1.18), scale=(0.32, 0.24, 0.03), rotation=(math.radians(4), 0, 0), material=mats["shadow"], bevel=0.014)
    parent(roof, turret_yaw)
    back = cube("rear_box", 1.0, (0, -0.18, 0.9), scale=(0.12, 0.06, 0.12), material=mats["shadow"], bevel=0.014)
    parent(back, turret_yaw)

    left_cheek = cube("front_cheek_left", 1.0, (-0.145, 0.2, 0.98), scale=(0.065, 0.08, 0.15), rotation=(math.radians(-28), 0, math.radians(6)), material=mats["edge"], bevel=0.014)
    parent(left_cheek, turret_yaw)
    right_cheek = cube("front_cheek_right", 1.0, (0.145, 0.2, 0.98), scale=(0.065, 0.08, 0.15), rotation=(math.radians(-28), 0, math.radians(-6)), material=mats["edge"], bevel=0.014)
    parent(right_cheek, turret_yaw)
    roof_slope = cube("roof_slope", 1.0, (0, 0.12, 1.1), scale=(0.13, 0.075, 0.06), rotation=(math.radians(-18), 0, 0), material=mats["edge"], bevel=0.012)
    parent(roof_slope, turret_yaw)
    brow = cube("front_brow", 1.0, (0, 0.18, 0.82), scale=(0.17, 0.03, 0.03), material=mats["shadow"], bevel=0.008)
    parent(brow, turret_yaw)
    slot_back = cube("slot_back", 1.0, (0, 0.1, 0.96), scale=(0.06, 0.03, 0.16), material=mats["shadow"], bevel=0.008)
    parent(slot_back, turret_yaw)

    left_panel = cube("side_panel_left", 1.0, (-0.28, -0.03, 0.9), scale=(0.07, 0.045, 0.095), rotation=(0, math.radians(6), math.radians(4)), material=mats["shadow"], bevel=0.008)
    parent(left_panel, turret_yaw)
    side_stub = cube("side_stub", 1.0, (0.29, -0.06, 0.86), scale=(0.045, 0.035, 0.07), material=mats["edge"], bevel=0.008)
    parent(side_stub, turret_yaw)

    indicator_top = cube("indicator_top", 1.0, (0.05, -0.01, 1.23), scale=(0.025, 0.025, 0.035), material=mats["light"], bevel=0.003)
    indicator_top.name = "indicator_top"
    parent(indicator_top, turret_yaw)
    indicator_side = cube("indicator_side", 1.0, (0.2, 0.18, 0.84), scale=(0.028, 0.028, 0.028), material=mats["light"], bevel=0.003)
    indicator_side.name = "indicator_side"
    parent(indicator_side, turret_yaw)


def build_weapon(gun_pitch, level, mats):
    trunnion_left = cylinder("trunnion_left", 0.055, 0.06, (-0.08, 0.17, 0.97), rotation=(0, math.radians(90), 0), material=mats["weapon_mid"], vertices=18, bevel=0.006)
    parent(trunnion_left, gun_pitch)
    trunnion_right = cylinder("trunnion_right", 0.055, 0.06, (0.08, 0.17, 0.97), rotation=(0, math.radians(90), 0), material=mats["weapon_mid"], vertices=18, bevel=0.006)
    parent(trunnion_right, gun_pitch)

    yoke = cube("yoke", 1.0, (0, 0.16, 0.97), scale=(0.12, 0.04, 0.18), material=mats["shadow"], bevel=0.01)
    parent(yoke, gun_pitch)
    mantlet = cylinder("mantlet", 0.09 + level * 0.012, 0.12, (0, 0.18, 0.97), rotation=(math.radians(90), 0, 0), material=mats["weapon_mid"], vertices=24, bevel=0.008)
    mantlet.name = "mantlet"
    parent(mantlet, gun_pitch)
    shroud = cube("shroud", 1.0, (0, 0.28, 0.97), scale=(0.1 + level * 0.03, 0.05, 0.055), material=mats["weapon_dark"], bevel=0.01)
    parent(shroud, gun_pitch)
    recoil_sleeve = cylinder("recoil_sleeve", 0.045 + level * 0.006, 0.16, (0, 0.32, 0.97), rotation=(math.radians(90), 0, 0), material=mats["edge"], vertices=20, bevel=0.006)
    parent(recoil_sleeve, gun_pitch)

    barrel_cluster = empty("barrel_cluster", (0, 0, 0))
    parent(barrel_cluster, gun_pitch)

    if level < 4:
        barrel_count = level + 1
    else:
        barrel_count = 6

    if barrel_count == 1:
        positions = [(0.0, 0.0)]
    elif barrel_count == 2:
        positions = [(-0.04, 0.0), (0.04, 0.0)]
    elif barrel_count == 3:
        positions = [(0.0, 0.045), (-0.05, -0.03), (0.05, -0.03)]
    elif barrel_count == 4:
        positions = [(-0.045, 0.035), (0.045, 0.035), (-0.045, -0.035), (0.045, -0.035)]
    else:
        radius = 0.06
        positions = [(math.cos(i / 6 * math.pi * 2) * radius, math.sin(i / 6 * math.pi * 2) * radius) for i in range(6)]
        spindle = cylinder("spindle", 0.022, 0.92, (0, 0.54, 0.97), rotation=(math.radians(90), 0, 0), material=mats["weapon_mid"], vertices=14, bevel=0.004)
        parent(spindle, barrel_cluster)

    cradle = cube("cradle", 1.0, (0, 0.33, 0.96), scale=(0.09 + barrel_count * 0.026, 0.045 + barrel_count * 0.008, 0.05), material=mats["weapon_mid"], bevel=0.01)
    parent(cradle, barrel_cluster)

    barrel_len = 0.68 if level < 4 else 0.88
    for idx, (x, z_offset) in enumerate(positions, start=1):
        barrel = cylinder(
            f"barrel_{idx:02d}",
            0.018 if level < 4 else 0.015,
            barrel_len,
            (x, 0.54, 0.97 + z_offset),
            rotation=(math.radians(90), 0, 0),
            material=mats["weapon_dark"],
            vertices=16,
            bevel=0.004,
        )
        parent(barrel, barrel_cluster)
        muzzle = cylinder(
            f"muzzle_{idx:02d}",
            0.022 if level < 4 else 0.018,
            0.06,
            (x, 0.54 + barrel_len / 2 + 0.03, 0.97 + z_offset),
            rotation=(math.radians(90), 0, 0),
            material=mats["weapon_mid"],
            vertices=14,
            bevel=0.003,
        )
        muzzle.name = f"muzzle_{idx:02d}"
        parent(muzzle, barrel_cluster)

    if level == 4:
        for ring_idx, y in enumerate((0.38, 0.54, 0.7), start=1):
            ring = cylinder(f"gatling_ring_{ring_idx}", 0.085, 0.016, (0, y, 0.97), rotation=(math.radians(90), 0, 0), material=mats["weapon_mid"], vertices=24, bevel=0.002)
            parent(ring, barrel_cluster)


def setup_scene_render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 64
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.06, 0.1, 0.14, 1)
    bg.inputs[1].default_value = 0.25


def build_level(level):
    mats = {
        "base_dark": make_material("base_dark", (0.12, 0.14, 0.18, 1), 0.85, 0.34),
        "base_mid": make_material("base_mid", (0.2, 0.24, 0.3, 1), 0.8, 0.42),
        "weapon_dark": make_material("weapon_dark", (0.05, 0.06, 0.07, 1), 0.95, 0.18),
        "weapon_mid": make_material("weapon_mid", (0.24, 0.27, 0.32, 1), 0.9, 0.24),
        "hull": make_material("hull", (0.36, 0.35, 0.3, 1), 0.65, 0.46),
        "edge": make_material("edge", (0.52, 0.5, 0.44, 1), 0.82, 0.32),
        "shadow": make_material("shadow", (0.2, 0.21, 0.19, 1), 0.58, 0.54),
        "light": make_material("light", (0.58, 0.92, 0.38, 1), 0.15, 0.3, emission=(0.45, 1.0, 0.28, 1), emission_strength=3.0),
    }

    root = empty(f"mg7_lvl{level + 1}")
    base_static = empty("base_static")
    parent(base_static, root)
    turret_yaw = empty("turret_yaw")
    parent(turret_yaw, root)
    gun_pitch = empty("gun_pitch")
    gun_pitch.location = (0, 0, 0)
    parent(gun_pitch, turret_yaw)

    build_base(base_static, mats)
    build_hull(turret_yaw, mats)
    build_weapon(gun_pitch, level, mats)

    turret_yaw.location = (0, 0, 0)
    gun_pitch.rotation_euler = (math.radians(-8), 0, 0)

    return root


def add_camera_and_light():
    bpy.ops.object.light_add(type="SUN", location=(4.2, -5.4, 7.4))
    sun = bpy.context.active_object
    sun.data.energy = 3.4
    sun.rotation_euler = (math.radians(38), 0, math.radians(35))

    bpy.ops.object.light_add(type="AREA", location=(-3.8, 2.4, 4.4))
    area = bpy.context.active_object
    area.data.energy = 1800
    area.data.size = 4

    bpy.ops.object.camera_add(location=(4.8, -4.8, 3.2), rotation=(math.radians(64), 0, math.radians(43)))
    cam = bpy.context.active_object
    bpy.context.scene.camera = cam


def export_level(level):
    filepath = os.path.join(OUTPUT_DIR, f"mg7_lvl{level + 1}.glb")
    bpy.ops.object.select_all(action="DESELECT")
    root_name = f"mg7_lvl{level + 1}"
    root = bpy.data.objects[root_name]
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_attributes=False,
    )


def main():
    ensure_output_dir()
    for level in range(5):
        reset_scene()
        setup_scene_render()
        build_level(level)
        add_camera_and_light()
        export_level(level)


if __name__ == "__main__":
    main()
