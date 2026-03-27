import * as THREE from 'three';
import {
  consumeEffects,
  createGameConfig,
  createInitialState,
  worldToGrid,
  resetAll,
  resetWave,
  placeTower,
  sellTower,
  startWave,
  tickSimulation,
  upgradeTower,
  upgradeTowerDefense,
} from './game/core/index.js';
import { GAMEPLAY_CONFIG } from './config/gameplay.js';
import { FRAMING_CONFIG } from './config/framing.js';
import { HudPresenter } from './game/runtime/presenters/hud-presenter.js';
import { TowerPanelPresenter } from './game/runtime/presenters/tower-panel-presenter.js';
import { SfxPlayer } from './game/runtime/audio/sfx-player.js';
import { createLayoutCoordinator } from './game/runtime/layout/layout-coordinator.js';
import { TowerPreview } from './game/runtime/preview/tower-preview.js';
import { EnemyRenderer } from './game/runtime/renderers/enemy-renderer.js';
import { MapRenderer } from './game/runtime/renderers/map-renderer.js';
import { ProjectileRenderer } from './game/runtime/renderers/projectile-renderer.js';
import { TowerRenderer } from './game/runtime/renderers/tower-renderer.js';
import { createSceneRuntime } from './game/runtime/scene-runtime.js';

const config = createGameConfig();
const state = createInitialState(config);

const layoutCoordinator = createLayoutCoordinator(document);
const viewportEl = document.getElementById('viewport');
const sceneRuntime = createSceneRuntime({
  viewportEl,
  mapDefinition: config.mapDefinition,
  worldScale: config.worldScale,
  framingConfig: FRAMING_CONFIG,
});
const mapRenderer = new MapRenderer(sceneRuntime.scene, config);
mapRenderer.build();

const sfxPlayer = new SfxPlayer();
sfxPlayer.attachUnlockListeners(window);
sfxPlayer.load('mg7-shot', new URL('../assets/audio/mg7/mg7-single-shot.mp3', import.meta.url).href).catch(() => {});
sfxPlayer.load('enemy-shot', new URL('../assets/audio/mg7/gun-shots-gun-firing.mp3', import.meta.url).href).catch(() => {});
sfxPlayer.load('scout-engine', new URL('../assets/audio/vehicles/light-vehicle-engine.wav', import.meta.url).href).catch(() => {});
sfxPlayer.load('vehicle-explosion', new URL('../assets/audio/vehicles/car-explosion-debris.mp3', import.meta.url).href).catch(() => {});

const towerRenderer = new TowerRenderer(sceneRuntime.scene, config.towerDefinitions, config.worldScale);
const enemyRenderer = new EnemyRenderer(sceneRuntime.scene, config.enemyDefinitions, sfxPlayer, config.worldScale);
const projectileRenderer = new ProjectileRenderer(sceneRuntime.scene, sfxPlayer, config.worldScale);
const previewTowerRenderer = new TowerRenderer(null, config.towerDefinitions, 1);
const towerPreview = new TowerPreview(document.getElementById('preview-3d'), (towerTypeId, level) =>
  previewTowerRenderer.buildMesh(towerTypeId, level),
);
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

const devModeToggleEl = document.getElementById('dev-mode-toggle');
const devConfigEl = document.getElementById('dev-config');
const devWaveCountEl = document.getElementById('dev-wave-count');
const devWaveIntervalEl = document.getElementById('dev-wave-interval');
const devEnemyListEl = document.getElementById('dev-enemy-list');
const devSelectAllEl = document.getElementById('dev-select-all');
const devClearAllEl = document.getElementById('dev-clear-all');
const devSelectedEnemyIds = new Set();

function notifyWaveLock() {
  state.uiLockNoticeUntil = Date.now() + 1400;
  renderUi();
}

function setDeveloperMode(enabled) {
  const shouldEnable = Boolean(enabled);
  if (shouldEnable) {
    if (!state.developerMode.enabled && Number.isFinite(state.credits)) {
      state.developerMode.savedCredits = state.credits;
    }
    state.developerMode.enabled = true;
    state.credits = Number.POSITIVE_INFINITY;
  } else {
    state.developerMode.enabled = false;
    if (!Number.isFinite(state.credits)) {
      state.credits = state.developerMode.savedCredits ?? state.config.mapDefinition.initialCredits;
    }
  }
  if (devConfigEl) devConfigEl.hidden = !shouldEnable;
  state.uiDirty = true;
}

function syncDeveloperCredits() {
  if (state.developerMode.enabled) {
    state.credits = Number.POSITIVE_INFINITY;
    state.uiDirty = true;
  }
}

function buildDevWaveOverride() {
  if (!state.developerMode.enabled) return null;
  const selectedEnemyIds = Array.from(devSelectedEnemyIds).filter((enemyTypeId) => config.enemyDefinitions[enemyTypeId]);
  if (selectedEnemyIds.length === 0) return null;

  const requestedCount = Number.parseInt(devWaveCountEl?.value ?? '16', 10);
  const count = Math.max(1, Math.min(200, Number.isFinite(requestedCount) ? requestedCount : 16));
  const requestedInterval = Number.parseFloat(devWaveIntervalEl?.value ?? '0.72');
  const interval = Math.max(0.1, Math.min(5, Number.isFinite(requestedInterval) ? requestedInterval : 0.72));
  const spawns = Array.from(
    { length: count },
    () => selectedEnemyIds[Math.floor(Math.random() * selectedEnemyIds.length)],
  );

  return {
    interval,
    spawns,
  };
}

function populateDevEnemyList() {
  if (!devEnemyListEl) return;
  devEnemyListEl.innerHTML = '';
  const entries = Object.values(config.enemyDefinitions).sort((a, b) => a.displayName.localeCompare(b.displayName));
  for (const enemyDef of entries) {
    const row = document.createElement('label');
    row.className = 'dev-enemy-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = enemyDef.id;
    checkbox.checked = devSelectedEnemyIds.has(enemyDef.id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) devSelectedEnemyIds.add(enemyDef.id);
      else devSelectedEnemyIds.delete(enemyDef.id);
    });
    const label = document.createElement('span');
    label.textContent = `${enemyDef.displayName} (${enemyDef.id})`;
    row.appendChild(checkbox);
    row.appendChild(label);
    devEnemyListEl.appendChild(row);
  }
}

function setupDeveloperControls() {
  if (!devModeToggleEl) return;
  populateDevEnemyList();
  if (devConfigEl) devConfigEl.hidden = true;

  devModeToggleEl.addEventListener('change', () => {
    setDeveloperMode(devModeToggleEl.checked);
    renderUi();
  });

  devSelectAllEl?.addEventListener('click', () => {
    devSelectedEnemyIds.clear();
    Object.keys(config.enemyDefinitions).forEach((id) => devSelectedEnemyIds.add(id));
    populateDevEnemyList();
  });

  devClearAllEl?.addEventListener('click', () => {
    devSelectedEnemyIds.clear();
    populateDevEnemyList();
  });
}

function renderUi() {
  hudPresenter.render(state);
  panelPresenter.render(state);
  document.body.classList.toggle('overlay-active', Boolean(state.overlay?.visible));
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

  const { gx, gy } = worldToGrid(point.x, point.z, config.worldScale, config.halfWidth, config.halfHeight);
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
  syncDeveloperCredits();
  const overrideWaveDefinition = buildDevWaveOverride();
  if (startWave(state, { overrideWaveDefinition })) {
    renderUi();
  }
};

window.resetWave = function resetWaveHandler() {
  resetWave(state);
  syncDeveloperCredits();
  closeConfirmDialog();
  renderUi();
};

window.resetAll = function resetAllHandler() {
  const keepDeveloperMode = Boolean(devModeToggleEl?.checked);
  resetAll(state);
  if (keepDeveloperMode) {
    setDeveloperMode(true);
  } else {
    setDeveloperMode(false);
  }
  closeConfirmDialog();
  hoveredCell = null;
  renderUi();
};

window.doUpgrade = function doUpgradeHandler() {
  if (!state.selectedTowerId) return;
  if (state.waveActive) {
    notifyWaveLock();
    return;
  }
  if (upgradeTower(state, state.selectedTowerId)) {
    renderUi();
  }
};

window.doUpgradeDefense = function doUpgradeDefenseHandler() {
  if (!state.selectedTowerId) return;
  if (state.waveActive) {
    notifyWaveLock();
    return;
  }
  if (upgradeTowerDefense(state, state.selectedTowerId)) {
    renderUi();
  }
};

window.askSell = function askSellHandler() {
  if (state.waveActive) {
    notifyWaveLock();
    return;
  }
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
    if (Math.abs(dx) > GAMEPLAY_CONFIG.ui.dragThreshold) didDrag = true;
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
    if (state.waveActive) {
      notifyWaveLock();
      return;
    }
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
  layoutCoordinator.apply();
  sceneRuntime.resize();
});

window.visualViewport?.addEventListener('resize', () => {
  layoutCoordinator.apply();
  sceneRuntime.resize();
});

window.__layoutAudit = {
  getMetrics() {
    const panelRect = document.getElementById('panel')?.getBoundingClientRect();
    const viewportRect = document.getElementById('viewport')?.getBoundingClientRect();
    const containerRect = document.getElementById('game-container')?.getBoundingClientRect();
    const canvasRect = sceneRuntime.renderer.domElement.getBoundingClientRect();
    const rootStyles = getComputedStyle(document.documentElement);
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      appWidthVar: rootStyles.getPropertyValue('--cfg-app-width').trim(),
      appHeightVar: rootStyles.getPropertyValue('--cfg-app-height').trim(),
      appLeftVar: rootStyles.getPropertyValue('--cfg-app-left').trim(),
      appTopVar: rootStyles.getPropertyValue('--cfg-app-top').trim(),
      bottomBufferVar: rootStyles.getPropertyValue('--cfg-window-bottom-buffer').trim(),
      panelTop: panelRect?.top ?? null,
      panelBottom: panelRect?.bottom ?? null,
      viewportBottom: viewportRect?.bottom ?? null,
      containerLeft: containerRect?.left ?? null,
      containerTop: containerRect?.top ?? null,
      containerRight: containerRect?.right ?? null,
      containerBottom: containerRect?.bottom ?? null,
      canvasLeft: canvasRect?.left ?? null,
      canvasRight: canvasRect?.right ?? null,
      projectedPlayableBounds: sceneRuntime.getProjectedPlayableBounds(),
      framing: sceneRuntime.framing,
    };
  },
};

function gameLoop() {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(clock.getDelta(), GAMEPLAY_CONFIG.simulation.maxDeltaTime);
  elapsedTime += dt;

  tickSimulation(state, dt);
  towerRenderer.sync(state, elapsedTime, sceneRuntime.camera);
  enemyRenderer.sync(state, sceneRuntime.camera, sceneRuntime.cameraAngle, elapsedTime);
  projectileRenderer.syncProjectiles(state);
  projectileRenderer.handleEffects(consumeEffects(state), towerRenderer, enemyRenderer);
  projectileRenderer.updateParticles(dt);

  if (state.uiDirty) {
    renderUi();
  }

  mapRenderer.updateAnimatedMarkers(elapsedTime);
  sceneRuntime.renderer.render(sceneRuntime.scene, sceneRuntime.camera);
  towerPreview.render(elapsedTime);
}

renderUi();
setupDeveloperControls();
gameLoop();

console.log('Iron Bastion v0.2 loaded');
console.log('Click green cells to place MG-7 towers ($50)');
console.log('Click towers to upgrade or sell');
console.log('Right-click drag to rotate, scroll to zoom');
