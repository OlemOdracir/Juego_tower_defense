import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { vehicleEnemyDefinitions } from './data/enemies/vehicleCatalog.js';

const LAB_PLATFORM_SURFACE_Y = 0.36;
const assetLoader = new GLTFLoader();
const assetTemplates = new Map();
const assetPromises = new Map();

const viewerEl = document.getElementById('viewer');
const presetSelect = document.getElementById('preset-select');
const randomBtn = document.getElementById('random-btn');
const statusEl = document.getElementById('status');
const statsEl = document.getElementById('stats');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101b27);
scene.fog = new THREE.FogExp2(0x101b27, 0.018);

const camera = new THREE.PerspectiveCamera(30, viewerEl.clientWidth / viewerEl.clientHeight, 0.1, 500);
let cameraRadius = 21;
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

function resize() {
  const width = viewerEl.clientWidth;
  const height = viewerEl.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
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
  statsEl.innerHTML = `
    <div class="stat-row"><span class="stat-label">Nombre</span><span class="stat-value">${definition.displayName}</span></div>
    <div class="stat-row"><span class="stat-label">Armadura</span><span class="stat-value">${definition.armorClass}</span></div>
    <div class="stat-row"><span class="stat-label">HP</span><span class="stat-value">${definition.stats.hp}</span></div>
    <div class="stat-row"><span class="stat-label">Blindaje</span><span class="stat-value">${definition.stats.armor}</span></div>
    <div class="stat-row"><span class="stat-label">Velocidad</span><span class="stat-value">${definition.stats.speed}</span></div>
    <div class="stat-row"><span class="stat-label">Recompensa</span><span class="stat-value">${definition.stats.reward}</span></div>
    <div class="stat-row"><span class="stat-label">Rol</span><span class="stat-value">${definition.tags.role}</span></div>
  `;
}

async function buildAssetVehicle(visualModel) {
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

  currentVehicle = await buildAssetVehicle(definition.visualModel);
  currentVehicle.position.y = LAB_PLATFORM_SURFACE_Y;
  scene.add(currentVehicle);
  statusEl.textContent = `Modelo activo: ${definition.displayName}`;
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
      cameraRadius = Math.max(10, Math.min(36, cameraRadius + event.deltaY * 0.015));
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
    currentVehicle.rotation.y = Math.sin(elapsed * 0.2) * 0.1;
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', resize);
setupControls();
setupPointerControls();
updateCamera();
resize();

presetSelect.value = 'humvee-gunner';
loadPresetVehicle('humvee-gunner').catch((error) => {
  statusEl.textContent = `Error cargando asset: ${error.message}`;
});
animate();
