# MG-7 Modular Asset Credits

## Integrated in this prototype

No external 3D asset or texture pack is embedded directly in this v1 hero prototype.

The five `mg7_lvl*.glb` files are generated locally from a Blender headless hard-surface build script. This keeps the family visually coherent, editable and compatible with the isolated asset lab node hierarchy.

Current generation path:

- Blender local CLI
- script: `scripts/blender_build_mg7.py`
- output: `assets/models/turrets/mg7_modular/mg7_lvl1.glb` through `mg7_lvl5.glb`

## Integrated VFX (MVP v2.1)

- Vehicle destruction **explosion/fire flipbooks** are generated at runtime from internal canvas atlases.
  - Implementation path: `src/game/runtime/renderers/projectile-renderer.js`
  - Config path: `src/config/effects.js`
  - License: in-project generated content (no external sprite sheet embedded)

## Integrated audio

- Mixkit, `Game gun shot`
  - URL: https://mixkit.co/free-sound-effects/gun/
  - Local file: `assets/audio/mg7/mg7-single-shot.mp3`
  - Intended use: single-shot MG-7 fire synced to each projectile fire event
  - License page used at implementation time: https://mixkit.co/license/

- Mixkit, `Car explosion debris`
  - URL: https://mixkit.co/free-sound-effects/explosion/
  - Local file: `assets/audio/vehicles/car-explosion-debris.mp3`
  - Intended use: default vehicle destruction / death explosion
  - License page used at implementation time: https://mixkit.co/license/

- Mixkit, `Truck driving steady`
  - URL: https://mixkit.co/free-sound-effects/engine/
  - Local file: `assets/audio/vehicles/light-vehicle-engine.wav`
  - Intended use: light vehicle engine loop for active scout buggies
  - License page used at implementation time: https://mixkit.co/license/

## Retained but not active

- Mixkit, `Gun Shots Gun Firing`
  - URL: https://mixkit.co/free-sound-effects/gun/
  - Local file: `assets/audio/mg7/gun-shots-gun-firing.mp3`
  - Intended use: archived alternate heavier MG firing variant
  - License page used at implementation time: https://mixkit.co/license/

## Evaluated as references

- Sketchfab, `Humvee` (UID `a331ab1396334beda7ae61711db59817`)
  - URL: https://sketchfab.com/models/a331ab1396334beda7ae61711db59817
  - Local export: `assets/models/vehicles/humvee_a331_turret.glb`
  - Intended use: armed Humvee preset for `vehicle-lab` comparison
  - License at import time: CC-BY

- Sketchfab, `Ukrainian modified Humvee` (UID `e804fc759a744e4f9b96348713d5933a`)
  - URL: https://sketchfab.com/3d-models/ukrainian-modified-humvee-e804fc759a744e4f9b96348713d5933a
  - Local export: `assets/models/vehicles/humvee_e804_armed.glb`
  - Intended use: armed enemy Humvee with turret yaw/pitch nodes
  - License at import time: CC-BY

- Sketchfab, `M163A2 VADS` (UID `b519c7ac1af34d5a970b96d59ca0ab1a`)
  - URL: https://sketchfab.com/3d-models/m163a2-vads-b519c7ac1af34d5a970b96d59ca0ab1a
  - Local export: `assets/models/vehicles/m163a2_vads.glb`
  - Intended use: medium armor armed vehicle (`m163-vads-medium`)
  - License at import time: CC-BY

- Sketchfab, `Army Jeep Hummer Humvee HMMWV` (UID `484845939c50419cb3a581cc3546fadd`)
  - URL: https://sketchfab.com/3d-models/army-jeep-hummer-humvee-hmmwv-484845939c50419cb3a581cc3546fadd
  - Status: API download returned HTTP 403 from Sketchfab MCP flow (not imported)

- Sketchfab, `Animated Game-Ready Turret`
  - URL: https://sketchfab.com/3d-models/animated-game-ready-turret-bbe8b20f9a624cdebd48e47a1cc0c585
  - Intended use: silhouette and low-poly donor/reference
  - License at time of planning: CC-BY

- Sketchfab, `Turret Defense Model | Game-Ready 3D Asset`
  - URL: https://sketchfab.com/3d-models/turret-defense-model-game-ready-3d-asset-f0aa10fe8e014db0bdb8824ed7942062
  - Intended use: material and form reference
  - License at time of planning: CC-BY

- Poly Haven
  - URL: https://polyhaven.com/
  - Intended use: future CC0 metal/paint PBR materials if the asset lab graduates into imported textured assets
