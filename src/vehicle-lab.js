import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { vehicleEnemyDefinitions } from './data/enemies/vehicleCatalog.js';
import { attachProceduralWeaponKit } from './game/runtime/renderers/enemy-weapon-kit.js';

const LAB_PLATFORM_SURFACE_Y = 0.36;
const assetLoader = new GLTFLoader();
const assetTemplates = new Map();
const assetPromises = new Map();

const viewerEl = document.getElementById('viewer');
const presetSelect = document.getElementById('preset-select');
const randomBtn = document.getElementById('random-btn');
const statusEl = document.getElementById('status');
const statsEl = document.getElementById('stats');
const DEFAULT_PRESET_ID = 'humvee-gunner-mg';

function wrapTurretYawPivot(turretYaw, mode = 'bounds', meshRoot = null) {
  if (!turretYaw || !turretYaw.parent) return turretYaw;

  turretYaw.updateMatrixWorld(true);
  const turretWorldPos = new THREE.Vector3();
  turretYaw.getWorldPosition(turretWorldPos);

  let worldCenter;
  if (mode === 'chassis') {
    worldCenter = new THREE.Vector3(0, turretWorldPos.y, 0);
  } else {
    const bounds = new THREE.Box3().setFromObject(turretYaw);
    worldCenter = new THREE.Vector3();
    bounds.getCenter(worldCenter);
    worldCenter.y = turretWorldPos.y;
  }

  // Parent pivot to meshRoot (no rotation) so pivot.rotation.y = world Y (vertical)
  // GLB internal nodes may have Z-up convention from Blender, making their local Y ≠ world Y
  const pivotParent = meshRoot || turretYaw.parent;
  const parentLocalCenter = pivotParent.worldToLocal(worldCenter.clone());

  const pivot = new THREE.Group();
  pivot.name = `${turretYaw.name || 'turret'}_runtime_yaw_pivot`;
  pivot.position.copy(parentLocalCenter);
  pivotParent.add(pivot);
  pivot.attach(turretYaw);
  return pivot;
}

function wrapGunPitchWithPivot(gunPitch, muzzleNodes, t = 0.72, pivotParent = null) {
  if (!gunPitch || !gunPitch.parent || !muzzleNodes?.length) return gunPitch;

  const parent = pivotParent || gunPitch.parent;
  const gunWorld = new THREE.Vector3();
  const pivotWorld = new THREE.Vector3();
  const parentLocalPivot = new THREE.Vector3();
  gunPitch.getWorldPosition(gunWorld);
  const muzzleAvg = new THREE.Vector3();
  const tmpPos = new THREE.Vector3();
  for (const m of muzzleNodes) { m.getWorldPosition(tmpPos); muzzleAvg.add(tmpPos); }
  muzzleAvg.multiplyScalar(1 / muzzleNodes.length);
  pivotWorld.copy(gunWorld).lerp(muzzleAvg, THREE.MathUtils.clamp(t, 0, 0.95));
  parent.worldToLocal(parentLocalPivot.copy(pivotWorld));

  const pivot = new THREE.Group();
  pivot.name = `${gunPitch.name || 'gun'}_runtime_pitch_pivot`;
  pivot.position.copy(parentLocalPivot);
  parent.add(pivot);
  pivot.attach(gunPitch);
  return pivot;
}

function collectMuzzleNodes(root, nodeMap) {
  if (!nodeMap) return [];
  if (nodeMap.muzzleNames?.length) {
    return nodeMap.muzzleNames
      .map((name) => root.getObjectByName(name))
      .filter(Boolean);
  }
  if (!nodeMap.muzzlePrefix) return [];
  const nodes = [];
  root.traverse((node) => {
    if (node.name?.startsWith(nodeMap.muzzlePrefix)) nodes.push(node);
  });
  return nodes;
}

function hasValidWeaponNodeLayout(assetRoot, size, turretYaw, muzzleNodes) {
  if (!turretYaw || muzzleNodes.length === 0) return false;
  const bounds = new THREE.Box3().setFromObject(assetRoot);
  const worldHeight = Math.max(0.001, bounds.max.y - bounds.min.y);
  const minTurretY = bounds.min.y + worldHeight * 0.35;
  const maxTurretY = bounds.max.y + worldHeight * 0.55;
  const turretWorld = new THREE.Vector3();
  turretYaw.getWorldPosition(turretWorld);
  if (turretWorld.y < minTurretY || turretWorld.y > maxTurretY) {
    return false;
  }

  const world = new THREE.Vector3();
  let valid = 0;
  for (const muzzle of muzzleNodes) {
    muzzle.getWorldPosition(world);
    if (world.y > bounds.min.y + worldHeight * 0.3 && world.y < bounds.max.y + worldHeight * 0.8) valid += 1;
  }
  return valid > 0;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101b27);
scene.fog = new THREE.FogExp2(0x101b27, 0.018);

const camera = new THREE.PerspectiveCamera(30, viewerEl.clientWidth / viewerEl.clientHeight, 0.1, 500);
let cameraRadius = 21;
let cameraMinRadius = 6;
let cameraMaxRadius = 42;
let cameraAzimuth = 0.8;
let cameraElevation = 0.38;
const lookAt = new THREE.Vector3(0, 2.8, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewerEl.clientWidth, viewerEl.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewerEl.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x98a8bb, 0.52));

const keyLight = new THREE.DirectionalLight(0xffe0b9, 1.8);
keyLight.position.set(14, 18, 12);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -24;
keyLight.shadow.camera.right = 24;
keyLight.shadow.camera.top = 24;
keyLight.shadow.camera.bottom = -24;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x9bc5ff, 0.42);
fillLight.position.set(-15, 10, -10);
scene.add(fillLight);

const deck = new THREE.Mesh(
  new THREE.CylinderGeometry(13.5, 14.2, 1, 56),
  new THREE.MeshStandardMaterial({ color: 0x4f6f3c, roughness: 0.86 }),
);
deck.receiveShadow = true;
deck.position.y = -0.5;
scene.add(deck);

const deckTop = new THREE.Mesh(
  new THREE.CylinderGeometry(11, 11.8, 0.68, 56),
  new THREE.MeshStandardMaterial({ color: 0x749c57, roughness: 0.78 }),
);
deckTop.receiveShadow = true;
deckTop.position.y = 0.02;
scene.add(deckTop);

for (let index = 0; index < 10; index += 1) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.28 + Math.random() * 0.2, 0),
    new THREE.MeshStandardMaterial({ color: 0x8d9887, roughness: 0.9 }),
  );
  const angle = (index / 10) * Math.PI * 2;
  const radius = 5.4 + Math.random() * 1.4;
  rock.position.set(Math.cos(angle) * radius, 0.22, Math.sin(angle) * radius);
  rock.rotation.set(Math.random() * 1.4, Math.random() * 1.4, Math.random() * 1.4);
  rock.castShadow = true;
  scene.add(rock);
}

let currentVehicle = null;
let isDragging = false;
let dragLastX = 0;
let dragLastY = 0;

function resolveAssetUrl(assetPath) {
  return new URL(`../${assetPath}`, import.meta.url).href;
}

async function loadAssetTemplate(assetPath) {
  if (assetTemplates.has(assetPath)) return assetTemplates.get(assetPath);
  if (assetPromises.has(assetPath)) return assetPromises.get(assetPath);

  const promise = assetLoader.loadAsync(resolveAssetUrl(assetPath)).then((gltf) => {
    assetTemplates.set(assetPath, gltf.scene);
    assetPromises.delete(assetPath);
    return gltf.scene;
  }).catch((error) => {
    assetPromises.delete(assetPath);
    throw error;
  });

  assetPromises.set(assetPath, promise);
  return promise;
}

function disposeObject3D(root) {
  if (root.userData.sharedAsset) return;
  root.traverse((node) => {
    node.geometry?.dispose?.();
    if (node.material) {
      if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose?.());
      else node.material.dispose?.();
    }
  });
}

function updateCamera() {
  const planar = Math.cos(cameraElevation) * cameraRadius;
  camera.position.set(
    Math.cos(cameraAzimuth) * planar,
    Math.sin(cameraElevation) * cameraRadius,
    Math.sin(cameraAzimuth) * planar,
  );
  camera.lookAt(lookAt);
}

function fitCameraToVehicle(vehicleRoot) {
  if (!vehicleRoot) return;
  const bounds = new THREE.Box3().setFromObject(vehicleRoot);
  if (bounds.isEmpty()) return;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  const fovY = THREE.MathUtils.degToRad(camera.fov);
  const fovX = 2 * Math.atan(Math.tan(fovY / 2) * camera.aspect);
  const halfHeight = Math.max(0.001, size.y * 0.5);
  const halfWidth = Math.max(0.001, size.x * 0.5);
  const halfDepth = Math.max(0.001, size.z * 0.5);

  const fitHeightDistance = halfHeight / Math.tan(fovY / 2);
  const fitWidthDistance = halfWidth / Math.tan(fovX / 2);
  const fitDepthDistance = halfDepth / Math.sin(fovY / 2);
  const idealRadius = Math.max(fitHeightDistance, fitWidthDistance, fitDepthDistance) * 1.5;

  cameraMinRadius = Math.max(2.5, idealRadius * 0.45);
  cameraMaxRadius = Math.max(cameraMinRadius + 2, idealRadius * 2.8);
  cameraRadius = THREE.MathUtils.clamp(idealRadius, cameraMinRadius, cameraMaxRadius);
  cameraElevation = THREE.MathUtils.clamp(0.42, 0.1, 1.1);

  lookAt.set(center.x, center.y + size.y * 0.18, center.z);
  updateCamera();
}

function resize() {
  const width = viewerEl.clientWidth;
  const height = viewerEl.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  if (currentVehicle) fitCameraToVehicle(currentVehicle);
}

function fillSelect(selectEl, entries) {
  selectEl.innerHTML = '';
  for (const entry of entries) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.label;
    selectEl.appendChild(option);
  }
}

function renderStats(definition) {
  const armedLabel = definition.combatModel.isArmed ? 'Si' : 'No';
  statsEl.innerHTML = `
    <div class="stat-row"><span class="stat-label">Nombre</span><span class="stat-value">${definition.displayName}</span></div>
    <div class="stat-row"><span class="stat-label">Armado</span><span class="stat-value">${armedLabel}</span></div>
    <div class="stat-row"><span class="stat-label">Armadura</span><span class="stat-value">${definition.armorClass}</span></div>
    <div class="stat-row"><span class="stat-label">HP</span><span class="stat-value">${definition.stats.hp}</span></div>
    <div class="stat-row"><span class="stat-label">Blindaje</span><span class="stat-value">${definition.stats.armor}</span></div>
    <div class="stat-row"><span class="stat-label">Velocidad</span><span class="stat-value">${definition.stats.speed}</span></div>
    <div class="stat-row"><span class="stat-label">Recompensa</span><span class="stat-value">${definition.stats.reward}</span></div>
    <div class="stat-row"><span class="stat-label">Rol</span><span class="stat-value">${definition.tags.role}</span></div>
  `;
}

async function buildAssetVehicle(definition) {
  const visualModel = definition.visualModel;
  const template = await loadAssetTemplate(visualModel.assetPath);
  const wrapper = new THREE.Group();
  const assetRoot = cloneSkeleton(template);

  assetRoot.scale.setScalar(visualModel.assetScale ?? 1);
  if (visualModel.assetRotation) {
    assetRoot.rotation.set(
      visualModel.assetRotation.x ?? 0,
      visualModel.assetRotation.y ?? 0,
      visualModel.assetRotation.z ?? 0,
    );
  }
  assetRoot.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(assetRoot);
  const size = new THREE.Vector3();
  bounds.getSize(size);
  const center = new THREE.Vector3();
  bounds.getCenter(center);
  assetRoot.position.set(-center.x, -bounds.min.y, -center.z);
  assetRoot.updateMatrixWorld(true);

  wrapper.add(assetRoot);
  wrapper.userData.sharedAsset = true;
  wrapper.userData.assetRoot = assetRoot;
  wrapper.traverse((node) => {
    node.castShadow = true;
    node.receiveShadow = true;
  });
  wrapper.userData.turretYaw = null;
  wrapper.userData.gunPitch = null;
  wrapper.userData.muzzleNodes = [];

  const nodeMap = visualModel.assetNodeMap;
  const skipWeaponNodeValidation = Boolean(visualModel.skipWeaponNodeValidation);
  if (nodeMap) {
    wrapper.userData.turretYaw = nodeMap.turretYaw ? assetRoot.getObjectByName(nodeMap.turretYaw) : null;
    wrapper.userData.gunPitch = nodeMap.gunPitch ? assetRoot.getObjectByName(nodeMap.gunPitch) : null;
    wrapper.userData.muzzleNodes = collectMuzzleNodes(assetRoot, nodeMap);
    if (
      !skipWeaponNodeValidation
      && !hasValidWeaponNodeLayout(assetRoot, size, wrapper.userData.turretYaw, wrapper.userData.muzzleNodes)
    ) {
      wrapper.userData.turretYaw = null;
      wrapper.userData.gunPitch = null;
      wrapper.userData.muzzleNodes = [];
    }
  }

  if (
    definition.combatModel.isArmed
    && (!wrapper.userData.turretYaw || wrapper.userData.muzzleNodes.length === 0)
  ) {
    const proceduralKit = attachProceduralWeaponKit(assetRoot, size, visualModel.weaponKit ?? {});
    wrapper.userData.turretYaw = proceduralKit.turretYaw;
    wrapper.userData.gunPitch = proceduralKit.gunPitch;
    wrapper.userData.muzzleNodes = proceduralKit.muzzleNodes;
    wrapper.userData.usesProceduralWeaponKit = true;
  } else {
    wrapper.userData.usesProceduralWeaponKit = false;
  }

  const yawPivotMode = visualModel.yawPivotMode;
  if ((visualModel.autoYawPivotFromBounds || yawPivotMode === 'chassis') && wrapper.userData.turretYaw) {
    wrapper.userData.turretYaw = wrapTurretYawPivot(wrapper.userData.turretYaw, yawPivotMode ?? 'bounds', wrapper);
  }

  if (
    visualModel.pitchPivotFromMuzzle != null
    && wrapper.userData.gunPitch
    && wrapper.userData.muzzleNodes.length > 0
  ) {
    wrapper.userData.gunPitch = wrapGunPitchWithPivot(
      wrapper.userData.gunPitch,
      wrapper.userData.muzzleNodes,
      visualModel.pitchPivotFromMuzzle,
      wrapper.userData.turretYaw,
    );
  }

  wrapper.userData.pitchAxis = visualModel.pitchAxis ?? 'z';

  return wrapper;
}

async function loadPresetVehicle(presetId) {
  const definition = vehicleEnemyDefinitions[presetId];
  if (!definition) return;

  renderStats(definition);

  if (currentVehicle) {
    scene.remove(currentVehicle);
    disposeObject3D(currentVehicle);
    currentVehicle = null;
  }

  currentVehicle = await buildAssetVehicle(definition);
  currentVehicle.position.y = LAB_PLATFORM_SURFACE_Y;
  window.__labVehicle = currentVehicle;
  scene.add(currentVehicle);
  fitCameraToVehicle(currentVehicle);
  const weaponRigMode = definition.combatModel.isArmed
    ? (currentVehicle.userData.usesProceduralWeaponKit ? 'procedural-kit' : 'asset-nodes')
    : 'unarmed';
  statusEl.textContent = `Modelo activo: ${definition.displayName} (${definition.combatModel.isArmed ? 'ARMED' : 'UNARMED'}) [${weaponRigMode}]`;
}

function randomChoice(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function setupControls() {
  fillSelect(
    presetSelect,
    Object.values(vehicleEnemyDefinitions).map((definition) => ({
      id: definition.id,
      label: definition.displayName,
    })),
  );

  presetSelect.addEventListener('change', () => {
    loadPresetVehicle(presetSelect.value).catch((error) => {
      statusEl.textContent = `Error cargando asset: ${error.message}`;
    });
  });

  randomBtn.addEventListener('click', () => {
    const presetIds = Object.keys(vehicleEnemyDefinitions);
    presetSelect.value = randomChoice(presetIds);
    loadPresetVehicle(presetSelect.value).catch((error) => {
      statusEl.textContent = `Error cargando asset: ${error.message}`;
    });
  });
}

function setupPointerControls() {
  viewerEl.addEventListener('mousedown', (event) => {
    isDragging = true;
    dragLastX = event.clientX;
    dragLastY = event.clientY;
    viewerEl.classList.add('dragging');
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    viewerEl.classList.remove('dragging');
  });

  window.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    const dx = event.clientX - dragLastX;
    const dy = event.clientY - dragLastY;
    dragLastX = event.clientX;
    dragLastY = event.clientY;
    cameraAzimuth -= dx * 0.006;
    cameraElevation = Math.max(0.1, Math.min(1.1, cameraElevation - dy * 0.004));
    updateCamera();
  });

  viewerEl.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      cameraRadius = THREE.MathUtils.clamp(cameraRadius + event.deltaY * 0.015, cameraMinRadius, cameraMaxRadius);
      updateCamera();
    },
    { passive: false },
  );
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  if (currentVehicle) {
    currentVehicle.rotation.y = 0;
    const turretYaw = currentVehicle.userData.turretYaw;
    if (turretYaw) {
      turretYaw.rotation.y = elapsed * 0.55; // rotación continua 360° — ~11s por vuelta
      const gunPitch = currentVehicle.userData.gunPitch;
      if (gunPitch) {
        // pitchAxis is stored in the definition — default to 'z' which works for Z-up GLB nodes
        const pitchAxis = currentVehicle.userData.pitchAxis ?? 'z';
        gunPitch.rotation[pitchAxis] = 0.08 + Math.sin(elapsed * 1.4) * 0.14;
      }
    }
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', resize);
setupControls();
setupPointerControls();
updateCamera();
resize();

const requestedPreset = new URLSearchParams(window.location.search).get('preset');
const initialPreset =
  requestedPreset && vehicleEnemyDefinitions[requestedPreset]
    ? requestedPreset
    : DEFAULT_PRESET_ID;

presetSelect.value = initialPreset;
loadPresetVehicle(initialPreset).catch((error) => {
  statusEl.textContent = `Error cargando asset: ${error.message}`;
});
animate();
