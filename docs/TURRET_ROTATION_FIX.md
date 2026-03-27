# Turret Rotation Fix — GLB Z-Up Pivot Issue

## Problem

Vehicle turrets imported from GLB models (exported from Blender) rotate in the wrong axis.
Instead of spinning horizontally (yaw around world Y), the turret sweeps vertically
through the chassis — rotating "down" in a 360-degree arc.

## Root Cause

Blender uses **Z-up** coordinate convention internally. When exporting to GLTF/GLB,
the exporter applies a Y-up correction at the **root level** of the scene, but the
**internal node hierarchy** (hull, turret, mount, etc.) retains Z-up relationships
between parent and child nodes.

This means:
- The model **looks correct** visually (the root correction makes it Y-up overall).
- But internal nodes like `hull` have their **local Y axis pointing in world -Z**, not world +Y.
- A pivot Group created as a child of `hull` inherits this rotated coordinate system.
- Setting `pivot.rotation.y` rotates around -Z (depth) instead of +Y (vertical).

### Diagnostic Evidence (M163A2 VADS)

**Before fix** — pivot parented to `hull` node:
```
pivotYAxisWorld: (0, 0, -0.1531)   // Points in -Z, NOT up!
```

**After fix** — pivot parented to mesh wrapper (no rotation):
```
pivotYAxisWorld: (0, 1, 0)          // Correctly points up
```

## Solution

The `wrapTurretYawPivot()` function now accepts a third parameter `meshRoot` — the
top-level mesh Group (wrapper) that has **no rotation**. The pivot is created as a
child of this wrapper instead of the turret's GLB parent node.

```js
function wrapTurretYawPivot(turretYaw, mode = 'bounds', meshRoot = null) {
  // ...
  // Parent pivot to meshRoot (no rotation) so pivot.rotation.y = world Y (vertical)
  const pivotParent = meshRoot || turretYaw.parent;
  const parentLocalCenter = pivotParent.worldToLocal(worldCenter.clone());

  const pivot = new THREE.Group();
  pivot.position.copy(parentLocalCenter);
  pivotParent.add(pivot);
  pivot.attach(turretYaw);  // Maintains world transform
  return pivot;
}
```

**Call sites always pass the mesh root:**
```js
// vehicle-lab.js
wrapper.userData.turretYaw = wrapTurretYawPivot(turretYaw, mode, wrapper);

// enemy-renderer.js (buildAssetVehicleMesh)
turretYaw = wrapTurretYawPivot(turretYaw, mode, root);
```

## Files Modified

| File | Change |
|------|--------|
| `src/game/runtime/renderers/enemy-renderer.js` | `wrapTurretYawPivot()` accepts `meshRoot`, call site passes `root` |
| `src/vehicle-lab.js` | Same function updated, call site passes `wrapper` |
| `src/data/enemies/vehicleCatalog.js` | M163 changed from `autoYawPivotFromBounds: true` to `yawPivotMode: 'chassis'` |

## Pivot Modes

| Mode | Pivot XZ Position | Use Case |
|------|-------------------|----------|
| `'bounds'` | Bounding box XZ center of turret assembly | Symmetric turrets where BB center ≈ ring center |
| `'chassis'` | Vehicle chassis center (0, 0) | Asymmetric turrets (e.g., M163 gun extends far to one side) |

## Checklist for Adding New Vehicles with GLB Turrets

1. **Identify turret nodes** in the GLB: find the node that should yaw (e.g., `turret`)
   and the node that should pitch (e.g., `mount`). Use the Vehicle Lab to inspect.

2. **Check the model's axis convention**: evaluate the turret parent node's `matrixWorld`
   in the browser console. If the Y-axis column is NOT `(0, 1, 0)`, the model has
   Z-up internals and needs the `meshRoot` pivot fix (already applied globally).

3. **Choose yawPivotMode**:
   - If the turret's bounding box is roughly centered on the turret ring → `autoYawPivotFromBounds: true`
   - If the turret is asymmetric (gun barrel extends far to one side) → `yawPivotMode: 'chassis'`
   - If the turret node's origin IS the turret ring center → no pivot needed

4. **Configure pitch**:
   - `pitchAxis`: which local axis of the gun/mount node controls elevation (`'x'`, `'y'`, or `'z'`)
   - `pitchSign`: `1` or `-1` depending on which direction is "up"
   - `pitchMin` / `pitchMax`: elevation limits in radians
   - `pitchPivotFromMuzzle`: 0-1 interpolation for pitch pivot between gun origin and muzzle

5. **Configure heading**:
   - `autoHeadingFromMuzzle: true` — auto-detect which direction the model faces from muzzle position
   - `headingOffsetAdjust` — additional rotation to align the model's "forward" with the game's forward

6. **Validate in Vehicle Lab**: load the preset at `vehicle-lab.html?preset=<id>` and confirm:
   - Turret rotates 360 degrees horizontally without clipping the chassis
   - Gun elevates/depresses smoothly within the expected range
   - The muzzle flash point is at the barrel tip

## Current Vehicle Turret Configs

| Vehicle | GLB | Turret Nodes | assetRotation | Pivot Mode | Notes |
|---------|-----|-------------|---------------|------------|-------|
| Humvee Basic | humvee_basic_v2.glb | None (procedural kit) | x:π/2, y:π | N/A | Unarmed or procedural turret |
| Humvee Gunner | humvee_armed_v1.glb | turretYaw: `armed_turret_base.001`, gunPitch: `armed_gun_block.001` | x:π/2, y:π | None | Z-up corrected via assetRotation |
| Humvee A331 | humvee_a331_turret.glb | turretYaw: `Turret`, gunPitch: `Gun` | y:π/2 | None | Y-up native, uses autoHeadingFromMuzzle |
| M163A2 VADS | m163a2_vads.glb | turretYaw: `turret`, gunPitch: `mount` | identity | `chassis` | Z-up internals, fixed via meshRoot pivot |

## Debugging Tips

### Quick axis check (browser console)
```js
const v = window.__labVehicle;
const pivot = v.userData.turretYaw;
pivot.updateMatrixWorld(true);
const m = pivot.matrixWorld.elements;
console.log('Pivot Y axis (world):', m[4].toFixed(3), m[5].toFixed(3), m[6].toFixed(3));
// Should be approximately (0, 1, 0) for correct horizontal rotation
```

### Muzzle sweep test
Sample muzzle world position over time. For correct yaw:
- **X and Z** should change significantly (horizontal sweep)
- **Y** should stay nearly constant (no vertical movement)

```js
const muzzle = v.userData.muzzleNodes[0];
setInterval(() => {
  muzzle.updateMatrixWorld(true);
  const m = muzzle.matrixWorld.elements;
  console.log(`muzzle: x=${m[12].toFixed(3)} y=${m[13].toFixed(3)} z=${m[14].toFixed(3)}`);
}, 500);
```
