import { gridToWorld } from './coordinates.js';
import { GAMEPLAY_CONFIG } from '../../config/gameplay.js';

function cloneValue(value) {
  return globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
}

let nextEntityId = 1;

export function allocateId(prefix) {
  const id = `${prefix}-${nextEntityId}`;
  nextEntityId += 1;
  return id;
}

export function cloneStateValue(value) {
  return cloneValue(value);
}

export function markUiDirty(state) {
  state.uiDirty = true;
}

export function markWorldDirty(state) {
  state.worldDirty = true;
}

export function queueEffect(state, effect) {
  state.effects.push(effect);
  markWorldDirty(state);
}

export function consumeEffects(state) {
  const effects = state.effects.slice();
  state.effects.length = 0;
  return effects;
}

export function getTowerLevel(definition, level) {
  return definition.levels[level];
}

export function getTowerRange(definition, level) {
  return getTowerLevel(definition, level).range;
}

export function getCellWorldPosition(config, gx, gy) {
  return gridToWorld(gx, gy, config.worldScale, config.halfWidth, config.halfHeight);
}

export function createInitialState(config) {
  return {
    config,
    grid: cloneValue(config.baseGrid),
    credits: config.mapDefinition.initialCredits,
    lives: config.mapDefinition.maxLives,
    wave: 0,
    waveActive: false,
    gameOver: false,
    victory: false,
    towers: [],
    enemies: [],
    projectiles: [],
    selectedTowerId: null,
    spawnQueue: [],
    spawnTimer: 0,
    activeWaveDefinition: null,
    waveSnapshot: null,
    effects: [],
    uiDirty: true,
    worldDirty: true,
    overlay: {
      visible: false,
      title: '',
      text: '',
      color: GAMEPLAY_CONFIG.overlays.defaultColor,
    },
  };
}

export function createWaveSnapshot(state) {
  return cloneValue({
    grid: state.grid,
    credits: state.credits,
    lives: state.lives,
    wave: state.wave,
    towers: state.towers,
    selectedTowerId: state.selectedTowerId,
  });
}

export function resetWave(state, snapshot = state.waveSnapshot) {
  if (!snapshot) {
    return state;
  }

  state.grid = cloneValue(snapshot.grid);
  state.credits = snapshot.credits;
  state.lives = snapshot.lives;
  state.wave = snapshot.wave;
  state.towers = cloneValue(snapshot.towers);
  state.selectedTowerId = snapshot.selectedTowerId;
  state.enemies = [];
  state.projectiles = [];
  state.spawnQueue = [];
  state.spawnTimer = 0;
  state.activeWaveDefinition = null;
  state.waveActive = false;
  state.gameOver = false;
  state.victory = false;
  state.overlay.visible = false;
  state.effects.length = 0;
  markUiDirty(state);
  markWorldDirty(state);
  return state;
}

export function resetAll(state) {
  const fresh = createInitialState(state.config);
  Object.assign(state, fresh);
  return state;
}
