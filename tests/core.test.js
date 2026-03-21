import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyCombatStep,
  createGameConfig,
  createInitialState,
  createWaveSnapshot,
  placeTower,
  resetWave,
  selectTargets,
  sellTower,
  startWave,
  tickSimulation,
  upgradeTower,
} from '../src/game/core/index.js';

function setupState() {
  const config = createGameConfig();
  return createInitialState(config);
}

test('comprar una torre descuenta creditos correctos', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  assert.ok(tower);
  assert.equal(state.credits, 200);
  assert.equal(state.grid[1][1], 2);
});

test('mejorar una torre actualiza nivel e inversion total', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  const upgraded = upgradeTower(state, tower.id);
  assert.equal(upgraded, true);
  assert.equal(tower.level, 1);
  assert.equal(tower.invested, 100);
  assert.equal(state.credits, 150);
});

test('vender devuelve 60 por ciento del invertido', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  upgradeTower(state, tower.id);
  const sold = sellTower(state, tower.id);
  assert.equal(sold, true);
  assert.equal(state.credits, 210);
  assert.equal(state.grid[1][1], 0);
});

test('reset de oleada restaura snapshot exacto', () => {
  const state = setupState();
  const firstTower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  state.waveSnapshot = createWaveSnapshot(state);
  startWave(state);
  placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 2, gy: 1 });
  upgradeTower(state, firstTower.id);
  state.lives -= 3;
  resetWave(state);

  assert.equal(state.wave, 0);
  assert.equal(state.credits, 200);
  assert.equal(state.lives, 20);
  assert.equal(state.towers.length, 1);
  assert.equal(state.towers[0].level, 0);
  assert.equal(state.grid[1][2], 0);
});

test('una torre selecciona el enemigo mas cercano en rango', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  state.enemies.push(
    {
      id: 'enemy-a',
      enemyTypeId: 'scout-buggy',
      hp: 40,
      maxHp: 40,
      armor: 2,
      reward: 12,
      alive: true,
      pathIndex: 0,
      position: { x: tower.wx + 1.5, y: 0.01, z: tower.wz },
      rotation: 0,
    },
    {
      id: 'enemy-b',
      enemyTypeId: 'scout-buggy',
      hp: 40,
      maxHp: 40,
      armor: 2,
      reward: 12,
      alive: true,
      pathIndex: 0,
      position: { x: tower.wx + 0.5, y: 0.01, z: tower.wz },
      rotation: 0,
    },
  );

  const targets = selectTargets(state);
  assert.equal(targets[0].targetEnemyId, 'enemy-b');
});

test('la armadura reduce el dano final', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  state.enemies.push({
    id: 'enemy-a',
    enemyTypeId: 'scout-buggy',
    hp: 40,
    maxHp: 40,
    armor: 2,
    reward: 12,
    alive: true,
    pathIndex: 0,
    position: { x: tower.wx, y: 0.35, z: tower.wz + 0.01 },
    rotation: 0,
  });

  selectTargets(state);
  applyCombatStep(state, 0.016);
  assert.equal(state.enemies[0].hp, 37);
});

test('fin de oleada se detecta sin renderer', () => {
  const state = setupState();
  state.wave = state.config.waveSet.waves.length;
  state.waveActive = true;
  tickSimulation(state, 0.016);
  assert.equal(state.gameOver, true);
  assert.equal(state.victory, true);
});

test('la economia suma recompensa por kill', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  state.enemies.push({
    id: 'enemy-a',
    enemyTypeId: 'scout-buggy',
    hp: 3,
    maxHp: 3,
    armor: 0,
    reward: 12,
    alive: true,
    pathIndex: 0,
    position: { x: tower.wx, y: 0.35, z: tower.wz + 0.01 },
    rotation: 0,
  });

  selectTargets(state);
  applyCombatStep(state, 0.016);
  assert.equal(state.credits, 212);
  assert.equal(tower.kills, 1);
});

test('no permite mejorar por sobre el nivel maximo', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  state.credits = 10000;
  assert.equal(upgradeTower(state, tower.id), true);
  assert.equal(upgradeTower(state, tower.id), true);
  assert.equal(upgradeTower(state, tower.id), true);
  assert.equal(upgradeTower(state, tower.id), true);
  assert.equal(upgradeTower(state, tower.id), false);
  assert.equal(tower.level, 4);
});
