import * as THREE from 'three';
import {
  consumeEffects,
  createGameConfig,
  createInitialState,
  resetAll,
  resetWave,
  placeTower,
  sellTower,
  startWave,
  tickSimulation,
  upgradeTower,
} from './game/core/index.js';
import { HudPresenter } from './game/runtime/presenters/hud-presenter.js';
import { TowerPanelPresenter } from './game/runtime/presenters/tower-panel-presenter.js';
import { SfxPlayer } from './game/runtime/audio/sfx-player.js';
import { TowerPreview } from './game/runtime/preview/tower-preview.js';
import { EnemyRenderer } from './game/runtime/renderers/enemy-renderer.js';
import { MapRenderer } from './game/runtime/renderers/map-renderer.js';
import { ProjectileRenderer } from './game/runtime/renderers/projectile-renderer.js';
import { TowerRenderer } from './game/runtime/renderers/tower-renderer.js';
import { createSceneRuntime } from './game/runtime/scene-runtime.js';

const config = createGameConfig();
const state = createInitialState(config);

const viewportEl = document.getElementById('viewport');
const sceneRuntime = createSceneRuntime(viewportEl, config.mapDefinition);
const mapRenderer = new MapRenderer(sceneRuntime.scene, config);
mapRenderer.build();

const sfxPlayer = new SfxPlayer();
sfxPlayer.attachUnlockListeners(window);
sfxPlayer.load('mg7-shot', new URL('../assets/audio/mg7/mg7-single-shot.mp3', import.meta.url).href).catch(() => {});
sfxPlayer.load('scout-engine', new URL('../assets/audio/vehicles/light-vehicle-engine.wav', import.meta.url).href).catch(() => {});
sfxPlayer.load('vehicle-explosion', new URL('../assets/audio/vehicles/car-explosion-debris.mp3', import.meta.url).href).catch(() => {});

const towerRenderer = new TowerRenderer(sceneRuntime.scene, config.towerDefinitions);
const enemyRenderer = new EnemyRenderer(sceneRuntime.scene, sfxPlayer);
const projectileRenderer = new ProjectileRenderer(sceneRuntime.scene, sfxPlayer);
const towerPreview = new TowerPreview(document.getElementById('preview-3d'), (towerTypeId, level) => towerRenderer.buildMesh(towerTypeId, level));
const hudPresenter = new HudPresenter(document);
const panelPresenter = new TowerPanelPresenter(document, towerPreview);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredCell = null;
let dragging = false;
let didDrag = false;
let lastMouseX = 0;
let elapsedTime = 0;
let pendingSellTowerId = null;

function renderUi() {
  hudPresenter.render(state);
  panelPresenter.render(state);
  refreshHover();
}

function refreshHover() {
  mapRenderer.updateHover(state, hoveredCell, config.towerDefinitions);
}

function getSelectedTower() {
  return state.towers.find((tower) => tower.id === state.selectedTowerId) ?? null;
}

function getGridCell(event) {
  const rect = sceneRuntime.renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, sceneRuntime.camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, point)) return null;

  const gx = Math.floor(point.x + config.halfWidth);
  const gy = Math.floor(point.z + config.halfHeight);
  if (gx < 0 || gx >= config.mapDefinition.width || gy < 0 || gy >= config.mapDefinition.height) {
    return null;
  }
  return { gx, gy };
}

function closeConfirmDialog() {
  pendingSellTowerId = null;
  document.getElementById('confirm-dialog').classList.remove('show');
}

window.startWave = function startWaveHandler() {
  if (startWave(state)) {
    renderUi();
  }
};

window.resetWave = function resetWaveHandler() {
  resetWave(state);
  closeConfirmDialog();
  renderUi();
};

window.resetAll = function resetAllHandler() {
  resetAll(state);
  closeConfirmDialog();
  hoveredCell = null;
  renderUi();
};

window.doUpgrade = function doUpgradeHandler() {
  if (!state.selectedTowerId) return;
  if (upgradeTower(state, state.selectedTowerId)) {
    renderUi();
  }
};

window.askSell = function askSellHandler() {
  const tower = getSelectedTower();
  if (!tower) return;
  const definition = config.towerDefinitions[tower.towerTypeId];
  const stats = definition.levels[tower.level];
  pendingSellTowerId = tower.id;
  document.getElementById('confirm-title').textContent = `Vender ${definition.displayName}?`;
  document.getElementById('confirm-text').textContent = `Nivel ${tower.level + 1} · ${stats.label} · ${tower.kills} kills`;
  document.getElementById('confirm-amount').textContent = `+ $${Math.floor(tower.invested * definition.economy.sellRatio)}`;
  document.getElementById('confirm-dialog').classList.add('show');
};

window.confirmSell = function confirmSellHandler() {
  if (pendingSellTowerId) {
    sellTower(state, pendingSellTowerId);
  }
  closeConfirmDialog();
  renderUi();
};

window.cancelSell = closeConfirmDialog;

sceneRuntime.renderer.domElement.addEventListener('mousemove', (event) => {
  if (dragging) {
    const dx = event.clientX - lastMouseX;
    if (Math.abs(dx) > 2) didDrag = true;
    lastMouseX = event.clientX;
    sceneRuntime.rotate(dx);
    return;
  }

  hoveredCell = getGridCell(event);
  refreshHover();
});

sceneRuntime.renderer.domElement.addEventListener('mousedown', (event) => {
  if (event.button === 2) {
    dragging = true;
    didDrag = false;
    lastMouseX = event.clientX;
    sceneRuntime.renderer.domElement.style.cursor = 'grabbing';
  }
});

window.addEventListener('mouseup', () => {
  dragging = false;
  sceneRuntime.renderer.domElement.style.cursor = '';
});

sceneRuntime.renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());

sceneRuntime.renderer.domElement.addEventListener('click', () => {
  if (didDrag) {
    didDrag = false;
    return;
  }

  if (state.gameOver) return;
  if (!hoveredCell) {
    state.selectedTowerId = null;
    renderUi();
    return;
  }

  const cellValue = state.grid[hoveredCell.gy][hoveredCell.gx];
  if (cellValue === 0) {
    const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: hoveredCell.gx, gy: hoveredCell.gy });
    if (tower) renderUi();
    return;
  }

  if (cellValue === 2) {
    const tower = state.towers.find((item) => item.gx === hoveredCell.gx && item.gy === hoveredCell.gy);
    state.selectedTowerId = tower?.id ?? null;
    renderUi();
    return;
  }

  state.selectedTowerId = null;
  renderUi();
});

sceneRuntime.renderer.domElement.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    sceneRuntime.zoom(event.deltaY);
  },
  { passive: false },
);

window.addEventListener('resize', () => {
  sceneRuntime.resize();
});

function gameLoop() {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsedTime += dt;

  tickSimulation(state, dt);
  towerRenderer.sync(state, elapsedTime);
  enemyRenderer.sync(state, sceneRuntime.cameraAngle, elapsedTime);
  projectileRenderer.syncProjectiles(state);
  projectileRenderer.handleEffects(consumeEffects(state), towerRenderer);
  projectileRenderer.updateParticles(dt);

  if (state.uiDirty) {
    renderUi();
  }

  mapRenderer.updateAnimatedMarkers(elapsedTime);
  sceneRuntime.renderer.render(sceneRuntime.scene, sceneRuntime.camera);
  towerPreview.render(elapsedTime);
}

renderUi();
gameLoop();

console.log('Iron Bastion v0.2 loaded');
console.log('Click green cells to place MG-7 towers ($50)');
console.log('Click towers to upgrade or sell');
console.log('Right-click drag to rotate, scroll to zoom');
