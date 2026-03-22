import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyCombatStep,
  createGameConfig,
  createInitialState,
  createWaveSnapshot,
  gridToWorld,
  placeTower,
  resetWave,
  selectTargets,
  sellTower,
  startWave,
  tickSimulation,
  upgradeTower,
  worldToGrid,
} from '../src/game/core/index.js';
import { enemyDefinitions } from '../src/data/enemies/index.js';
import { defaultWaveSetDefinition } from '../src/data/waves/defaultWaveSet.js';
import { getMg7MuzzleAnchor, getMg7MuzzleAnchors } from '../src/game/shared/mg7-geometry.js';

function setupState() {
  const config = createGameConfig();
  return createInitialState(config);
}

function setupStateWithScale(worldScale) {
  const config = createGameConfig({ worldScale });
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
  assert.ok(typeof tower.aimPitch === 'number');
});

test('el proyectil nace adelantado desde la boca del canon', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  const groundY = 0.01 * state.config.worldScale;
  state.enemies.push({
    id: 'enemy-a',
    enemyTypeId: 'scout-buggy',
    hp: 40,
    maxHp: 40,
    armor: 2,
    reward: 12,
    alive: true,
    pathIndex: 0,
    position: { x: tower.wx, y: groundY, z: tower.wz + 18 },
    rotation: 0,
  });

  selectTargets(state);
  applyCombatStep(state, 0);
  assert.equal(state.projectiles.length, 1);
  assert.ok(state.projectiles[0].z > tower.wz + 2);
  assert.ok(state.projectiles[0].y > groundY);
});

test('la direccion del proyectil se mantiene inmutable entre frames', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  const groundY = 0.01 * state.config.worldScale;
  state.enemies.push({
    id: 'enemy-a',
    enemyTypeId: 'scout-buggy',
    hp: 40,
    maxHp: 40,
    armor: 0,
    reward: 12,
    alive: true,
    pathIndex: 0,
    position: { x: tower.wx + 5, y: groundY, z: tower.wz + 22 },
    rotation: 0,
  });

  selectTargets(state);
  applyCombatStep(state, 0.016);
  const projectile = state.projectiles[0];
  const initialDirection = { vx: projectile.vx, vy: projectile.vy, vz: projectile.vz };
  for (let index = 0; index < 5; index++) {
    applyCombatStep(state, 0.016);
  }
  assert.equal(projectile.vx, initialDirection.vx);
  assert.equal(projectile.vy, initialDirection.vy);
  assert.equal(projectile.vz, initialDirection.vz);
});

test('los anchors de bocacha por nivel tienen cantidad esperada y fireIndex estable', () => {
  const counts = [1, 2, 3, 4, 6];
  const scales = [1, 1.15, 1.3, 1.45, 1.6];
  for (let level = 0; level < counts.length; level++) {
    const anchors = getMg7MuzzleAnchors(level, scales[level]);
    assert.equal(anchors.length, counts[level]);
    const first = getMg7MuzzleAnchor(level, scales[level], 0);
    const wrapped = getMg7MuzzleAnchor(level, scales[level], counts[level]);
    assert.deepEqual(wrapped, first);
  }
});

test('la armadura reduce el dano final', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  const groundY = 0.01 * state.config.worldScale;
  state.enemies.push({
    id: 'enemy-a',
    enemyTypeId: 'scout-buggy',
    hp: 40,
    maxHp: 40,
    armor: 2,
    reward: 12,
    alive: true,
    pathIndex: 0,
    position: { x: tower.wx, y: groundY, z: tower.wz + 20 },
    rotation: 0,
  });

  selectTargets(state);
  for (let index = 0; index < 20; index++) {
    applyCombatStep(state, 0.016);
  }
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
  const groundY = 0.01 * state.config.worldScale;
  state.enemies.push({
    id: 'enemy-a',
    enemyTypeId: 'scout-buggy',
    hp: 3,
    maxHp: 3,
    armor: 0,
    reward: 12,
    alive: true,
    pathIndex: 0,
    position: { x: tower.wx, y: groundY, z: tower.wz + 20 },
    rotation: 0,
  });

  selectTargets(state);
  for (let index = 0; index < 20; index++) {
    applyCombatStep(state, 0.016);
  }
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

test('las primeras oleadas solo generan vehiculos ligeros', () => {
  for (const wave of defaultWaveSetDefinition.waves.slice(0, 3)) {
    for (const enemyTypeId of wave.spawns) {
      assert.equal(enemyDefinitions[enemyTypeId].armorClass, 'light');
    }
  }
});

test('las ultimas oleadas pueden generar vehiculos pesados', () => {
  const finalWaves = defaultWaveSetDefinition.waves.slice(-2);
  const hasHeavy = finalWaves.some((wave) =>
    wave.spawns.some((enemyTypeId) => enemyDefinitions[enemyTypeId].armorClass === 'heavy'),
  );
  assert.equal(hasHeavy, true);
});

test('pathWorld escala correctamente con worldScale', () => {
  const configBase = createGameConfig({ worldScale: 1 });
  const configScaled = createGameConfig({ worldScale: 10 });
  for (let index = 0; index < configBase.pathWorld.length; index += 1) {
    assert.equal(configScaled.pathWorld[index].x, configBase.pathWorld[index].x * 10);
    assert.equal(configScaled.pathWorld[index].y, configBase.pathWorld[index].y * 10);
    assert.equal(configScaled.pathWorld[index].z, configBase.pathWorld[index].z * 10);
  }
});

test('conversion grid/world mantiene celdas consistentes con scale 10', () => {
  const config = createGameConfig({ worldScale: 10 });
  const world = gridToWorld(7, 3, config.worldScale, config.halfWidth, config.halfHeight);
  const grid = worldToGrid(world.x + 0.1, world.z - 0.1, config.worldScale, config.halfWidth, config.halfHeight);
  assert.equal(grid.gx, 7);
  assert.equal(grid.gy, 3);
});

test('tiempo de avance de enemigo se conserva relativo entre escala base y x10', () => {
  const baseState = setupStateWithScale(1);
  const scaledState = setupStateWithScale(10);

  startWave(baseState);
  startWave(scaledState);

  for (let index = 0; index < 30; index += 1) {
    tickSimulation(baseState, 0.1);
    tickSimulation(scaledState, 0.1);
  }

  const baseEnemy = baseState.enemies[0];
  const scaledEnemy = scaledState.enemies[0];
  assert.ok(baseEnemy);
  assert.ok(scaledEnemy);
  assert.ok(Math.abs(scaledEnemy.position.x / 10 - baseEnemy.position.x) < 0.12);
  assert.ok(Math.abs(scaledEnemy.position.z / 10 - baseEnemy.position.z) < 0.12);
});
