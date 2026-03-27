# Turret & Gun Axis Fix — Guía Técnica

## Problema raíz

Los modelos GLB exportados desde Blender tienen una inconsistencia de ejes que afecta la rotación de torreta y cañón en Three.js.

### Cómo ocurre

Blender usa convención **Z-up** (Z = arriba). El exportador GLTF aplica la corrección `Y-up` **solo al nodo raíz** del GLB. Los nodos internos (`hull`, `turret`, `mount`, etc.) mantienen la orientación Blender internamente.

Resultado: dentro del GLB, el eje local Y de un nodo apunta en dirección **-Z del mundo** (no en +Y del mundo).

```
Nodo hull / turret / mount en mundo:
  local X → mundo X   (1, 0, 0)   ✓
  local Y → mundo -Z  (0, 0,-1)   ✗ debería ser (0,1,0)
  local Z → mundo +Y  (0, 1, 0)   ← eje "arriba" real
```

### Síntomas

| Problema | Causa |
|---|---|
| Torreta rota en 360° **hacia abajo** en vez de lateral | pivot de yaw hereda eje Y del hull (= mundo -Z) |
| Cañón se mueve **lateralmente** en vez de arriba/abajo | eje de pitch incorrecto en el nodo mount |

---

## Fix 1 — Yaw de torreta (rotación horizontal)

### Código: `wrapTurretYawPivot`

**Archivo:** `src/game/runtime/renderers/enemy-renderer.js` y `src/vehicle-lab.js`

**Solución:** Crear el pivot de yaw como hijo del **wrapper root** (Group sin rotación) en vez de como hijo del nodo GLB del hull.

```js
function wrapTurretYawPivot(turretYaw, mode = 'bounds', meshRoot = null) {
  // ...
  // meshRoot = wrapper Group con rotation (0,0,0) → su Y local = mundo Y
  const pivotParent = meshRoot || turretYaw.parent;
  // ...
  pivotParent.add(pivot);
  pivot.attach(turretYaw);
  return pivot;
}
```

**Cómo llamarlo:**

```js
// enemy-renderer.js
turretYaw = wrapTurretYawPivot(turretYaw, yawPivotMode, root);

// vehicle-lab.js
wrapper.userData.turretYaw = wrapTurretYawPivot(turretYaw, yawPivotMode, wrapper);
```

**Verificación** — el pivot debe tener:
```
worldYAxis = (0, 1, 0)   // ← mundo Y = arriba
```
Si worldYAxis apunta en otra dirección, la torreta no girará correctamente.

**Cómo verificar en browser console:**
```js
const p = window.__labVehicle.userData.turretYaw;
p.updateMatrixWorld(true);
const m = p.matrixWorld.elements;
console.log('Y axis:', m[4].toFixed(3), m[5].toFixed(3), m[6].toFixed(3));
// Debe ser: 0.000  1.000  0.000
```

---

## Fix 2 — Pitch del cañón (elevación arriba/abajo)

### Código: `wrapGunPitchWithPivot`

**Archivo:** `src/game/runtime/renderers/enemy-renderer.js` y `src/vehicle-lab.js`

**Solución:** Crear el pitch pivot como hijo del **yaw pivot** (ya corregido), NO como hijo del nodo turret del GLB. Además, el **orden importa**: yaw primero, pitch después.

```js
// ORDEN CORRECTO en buildAssetVehicleMesh / buildAssetVehicle:

// 1. Yaw pivot primero (world-aligned)
if (yawPivotMode && turretYaw) {
  turretYaw = wrapTurretYawPivot(turretYaw, yawPivotMode, root);
}

// 2. Pitch pivot segundo, HIJO del yaw pivot
if (pitchPivotFromMuzzle != null && gunPitch) {
  gunPitch = wrapGunPitchWithPivot(gunPitch, muzzleNodes, pitchPivotFromMuzzle, turretYaw);
}
```

```js
function wrapGunPitchWithPivot(gunPitch, muzzleNodes, t = 0.72, pivotParent = null) {
  // pivotParent = yaw pivot → tiene ejes world-aligned, sigue el yaw
  const parent = pivotParent || gunPitch.parent;
  // ... posicionar pivot entre mount y muzzle (t = fracción 0..1)
}
```

---

## Fix 3 — Determinar el eje de pitch correcto (`pitchAxis`)

El `pitchAxis` depende de **en qué dirección apunta el cañón** desde el pitch pivot.

### Método de diagnóstico

Con el modelo cargado en el Vehicle Lab, ejecutar en browser console:

```js
const v = window.__labVehicle;
const yaw = v.userData.turretYaw;
const pitch = v.userData.gunPitch;
const muzzle = v.userData.muzzleNodes[0];

yaw.rotation.y = 0;
const results = {};
for (const ax of ['x', 'y', 'z']) {
  pitch.rotation.set(0, 0, 0);
  pitch.rotation[ax] = 0.4;
  v.updateMatrixWorld(true);
  let m = muzzle.matrixWorld.elements;
  const yPos = m[13];
  pitch.rotation.set(0, 0, 0);
  v.updateMatrixWorld(true);
  m = muzzle.matrixWorld.elements;
  const yBase = m[13];
  results[ax] = { deltaY: (yPos - yBase).toFixed(4) };
}
console.table(results);
// El eje con mayor |deltaY| es el pitchAxis correcto
```

### Tabla de ejes por convención del modelo

| Tipo de modelo | assetRotation | pitchAxis | pitchSign |
|---|---|---|---|
| GLB Z-up nativo (Blender sin corrección de eje) | `{x:0,y:0,z:0}` | `'z'` | `1` |
| GLB corregido a Y-up (con `x: π/2`) | `{x:π/2,y:π,z:0}` | `'x'` (verificar) | `-1` (verificar) |
| Kit procedural (generado en código) | — | `'x'` | `-1` |

### Regla práctica

- Si `assetRotation.x == 0` → el modelo tiene nodos internos Z-up → usar `pitchAxis: 'z'`
- Si `assetRotation.x != 0` → el modelo ya fue corregido a Y-up → usar `pitchAxis: 'x'`

---

## Configuración del M163A2 VADS (caso de referencia)

```js
const SHARED_M163_VADS_VISUAL = {
  assetRotation: { x: 0, y: 0, z: 0 },   // modelo con nodos internos Z-up
  yawPivotMode: 'chassis',                 // pivot en centro del chasis (XZ = 0,0)
  pitchPivotFromMuzzle: 0.08,              // pivot cerca del mount (base del cañón) — muzzle queda libre para elevarse
  pitchAxis: 'z',                          // eje Z del pitch pivot = correcto para Z-up
  pitchSign: 1,                            // +z rota cañón hacia arriba
  pitchMin: -0.22,                         // máxima depresión (rad)
  pitchMax: 0.18,                          // máxima elevación (rad)
  assetNodeMap: {
    turretYaw: 'turret',
    gunPitch: 'mount',
    muzzleNames: ['m163_muzzle_01'],
  },
};
```

---

## Checklist para implementar un nuevo vehículo con torreta GLB

1. **Cargar el modelo** en Vehicle Lab (`vehicle-lab.html?preset=<id>`)
2. **Verificar yaw** — abrir console y revisar `worldYAxis` del pivot (debe ser `0,1,0`)
3. **Determinar pitchAxis** — ejecutar el script de diagnóstico de arriba
4. **Configurar `vehicleCatalog.js`**:
   - `yawPivotMode: 'chassis'` para todos los vehículos con nodos internos Z-up
   - `pitchAxis: 'z'`, `pitchSign: 1` para modelos Z-up
   - `pitchPivotFromMuzzle: 0.5..0.8` (ajustar visualmente; 0.72 funciona bien)
5. **Verificar visualmente** — la animación en Vehicle Lab debe mostrar:
   - Torreta girando horizontalmente 360° sin atravesar el chasis
   - Cañón elevándose y deprimiéndose verticalmente

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/game/runtime/renderers/enemy-renderer.js` | `wrapTurretYawPivot(meshRoot)`, `wrapGunPitchWithPivot(pivotParent)`, orden yaw→pitch |
| `src/vehicle-lab.js` | mismo que enemy-renderer, más `pitchAxis` en userData |
| `src/data/enemies/vehicleCatalog.js` | `yawPivotMode`, `pitchAxis`, `pitchSign` por vehículo |
