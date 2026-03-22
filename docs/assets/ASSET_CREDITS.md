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
