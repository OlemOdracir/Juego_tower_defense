import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createGameConfig } from './game/core/index.js';
import { AUDIO_LEVELS } from './game/runtime/audio/audio-config.js';
import { SfxPlayer } from './game/runtime/audio/sfx-player.js';

const config = createGameConfig();
const definition = config.towerDefinitions['mg7-vulcan'];
const previewConfig = definition.visualModel.assetPreview;
const levelSelect = document.getElementById('level-select');
const reloadBtn = document.getElementById('reload-btn');
const statusEl = document.getElementById('status');
const viewerEl = document.getElementById('viewer');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x12202b);
scene.fog = new THREE.FogExp2(0x12202b, 0.055);

const camera = new THREE.PerspectiveCamera(26, viewerEl.clientWidth / viewerEl.clientHeight, 0.1, 100);
camera.position.set(4.8, 2.8, 4.6);
camera.lookAt(0, 1.0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewerEl.clientWidth, viewerEl.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewerEl.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x95a6bb, 0.7));

const keyLight = new THREE.DirectionalLight(0xffe3bf, 1.9);
keyLight.position.set(4.5, 5.8, 4.2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -4;
keyLight.shadow.camera.right = 4;
keyLight.shadow.camera.top = 4;
keyLight.shadow.camera.bottom = -4;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x8bc3ff, 0.38);
fillLight.position.set(-4, 3.2, -2.6);
scene.add(fillLight);

const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(1.65, 1.82, 0.24, 48),
  new THREE.MeshStandardMaterial({ color: 0x456f31, roughness: 0.88 }),
);
pedestal.receiveShadow = true;
pedestal.position.y = -0.1;
scene.add(pedestal);

const pedestalTop = new THREE.Mesh(
  new THREE.CylinderGeometry(1.34, 1.42, 0.18, 48),
  new THREE.MeshStandardMaterial({ color: 0x70aa51, roughness: 0.76 }),
);
pedestalTop.receiveShadow = true;
pedestalTop.position.y = 0.02;
scene.add(pedestalTop);

const loader = new GLTFLoader();
const sfxPlayer = new SfxPlayer();
sfxPlayer.attachUnlockListeners(window);
sfxPlayer.load('mg7-shot', new URL('../assets/audio/mg7/mg7-single-shot.mp3', import.meta.url).href).catch(() => {});
let currentRoot = null;
let activeNodes = { turretYaw: null, gunPitch: null, muzzleNodes: [], flashes: [] };
let wasFiring = false;

function resolveLevelUrl(levelIndex) {
  const relativePath = previewConfig.levelGlbs[levelIndex];
  return new URL(`../${relativePath}`, import.meta.url).href;
}

function clearCurrentAsset() {
  if (!currentRoot) return;
  scene.remove(currentRoot);
  currentRoot.traverse((node) => {
    if (node.geometry) node.geometry.dispose?.();
    if (node.material) {
      if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose?.());
      else node.material.dispose?.();
    }
  });
  currentRoot = null;
  activeNodes = { turretYaw: null, gunPitch: null, muzzleNodes: [], flashes: [] };
  wasFiring = false;
}

function createFlash(node) {
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffcf7a, transparent: true, opacity: 0 }),
  );
  flash.visible = false;
  flash.scale.set(0.28, 0.28, 0.52);
  node.add(flash);
  return flash;
}

async function loadLevel(levelIndex) {
  statusEl.textContent = 'Cargando asset...';
  const url = resolveLevelUrl(levelIndex);
  clearCurrentAsset();

  const gltf = await loader.loadAsync(url);
  currentRoot = gltf.scene;
  currentRoot.position.y = 0.1;
  currentRoot.scale.setScalar(1.02);
  currentRoot.traverse((node) => {
    node.castShadow = true;
    node.receiveShadow = true;
  });
  scene.add(currentRoot);

  const turretYaw = currentRoot.getObjectByName(previewConfig.nodeMap.turretYaw);
  const gunPitch = currentRoot.getObjectByName(previewConfig.nodeMap.gunPitch);
  const muzzleNodes = [];
  currentRoot.traverse((node) => {
    if (node.name.startsWith(previewConfig.nodeMap.muzzlePrefix)) {
      muzzleNodes.push(node);
    }
  });

  activeNodes = {
    turretYaw,
    gunPitch,
    muzzleNodes,
    flashes: muzzleNodes.map((node) => createFlash(node)),
  };

  statusEl.textContent = `Nivel ${levelIndex + 1} cargado - ${muzzleNodes.length} bocachas detectadas`;
}

function resize() {
  const width = viewerEl.clientWidth;
  const height = viewerEl.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

window.addEventListener('resize', resize);
levelSelect.addEventListener('change', () => {
  loadLevel(Number(levelSelect.value)).catch((error) => {
    statusEl.textContent = `Error: ${error.message}`;
  });
});
reloadBtn.addEventListener('click', () => {
  loadLevel(Number(levelSelect.value)).catch((error) => {
    statusEl.textContent = `Error: ${error.message}`;
  });
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  if (currentRoot) {
    currentRoot.rotation.y = 0;
    if (activeNodes.turretYaw) {
      activeNodes.turretYaw.rotation.y = -0.45 + elapsed * 0.36;
    }
    if (activeNodes.gunPitch) {
      activeNodes.gunPitch.rotation.x = -0.2 + Math.sin(elapsed * 0.9) * 0.08;
    }

    const firingGate = (Math.sin(elapsed * 7.5) + 1) * 0.5;
    const flashIndex = Math.floor((elapsed * 20) % Math.max(1, activeNodes.flashes.length));
    const shouldFlash = firingGate > 0.78;
    if (shouldFlash && !wasFiring) {
      sfxPlayer.play('mg7-shot', {
        volume: AUDIO_LEVELS.mg7Shot,
        playbackRate: 0.99 + Math.random() * 0.04,
        cooldownMs: 0,
      });
    }
    wasFiring = shouldFlash;
    activeNodes.flashes.forEach((flash, index) => {
      if (shouldFlash && index === flashIndex) {
        const pulse = 0.9 + Math.sin(elapsed * 48) * 0.24;
        flash.visible = true;
        flash.material.opacity = 0.82;
        flash.scale.set(0.38 + pulse * 0.08, 0.38 + pulse * 0.08, 0.68 + pulse * 0.14);
      } else {
        flash.visible = false;
        flash.material.opacity = 0;
      }
    });
  }

  renderer.render(scene, camera);
}

resize();
loadLevel(Number(levelSelect.value)).catch((error) => {
  statusEl.textContent = `Error: ${error.message}`;
});
animate();
