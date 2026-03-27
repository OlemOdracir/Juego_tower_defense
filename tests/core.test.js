import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyCombatStep,
  createGameConfig,
  createInitialState,
  gridToWorld,
  placeTower,
  resetWave,
  selectTargets,
  sellTower,
  startWave,
  tickSimulation,
  upgradeTower,
  upgradeTowerDefense,
  worldToGrid,
} from '../src/game/core/index.js';
import { enemyDefinitions } from '../src/data/enemies/index.js';
import { defaultWaveSetDefinition } from '../src/data/waves/defaultWaveSet.js';
import { MUNITION_CLASSES } from '../src/data/enemies/vehicle-combat.js';

function setupState(worldScale = 10) {
  const config = createGameConfig({ worldScale });
  return createInitialState(config);
}

function createStaticEnemy(overrides = {}) {
  return {
    id: 'enemy-test',
    enemyTypeId: 'scout-buggy-unarmed',
    hp: 80,
    maxHp: 80,
    armor: 0,
    armorClass: 'light',
    speed: 0,
    reward: 12,
    pathIndex: 0,
    progress: 0,
    alive: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    damageType: MUNITION_CLASSES.lightBallistic,
    isArmed: false,
    weaponProfile: null,
    weaponCooldown: 0,
    targetTowerId: null,
    aimAngle: 0,
    aimPitch: 0,
    ...overrides,
  };
}

test('comprar, mejorar y vender torre respeta economia base', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  assert.ok(tower);
  assert.equal(state.credits, 200);
  assert.equal(upgradeTower(state, tower.id), true);
  assert.equal(tower.level, 1);
  assert.equal(tower.invested, 100);
  assert.equal(state.credits, 150);
  assert.equal(sellTower(state, tower.id), true);
  assert.equal(state.credits, 210);
});

test('oleada 1 solo genera enemigos desarmados', () => {
  const wave1 = defaultWaveSetDefinition.waves[0];
  for (const enemyTypeId of wave1.spawns) {
    assert.equal(enemyDefinitions[enemyTypeId].combatModel.isArmed, false);
  }
});

test('desde oleada 2 aparecen variantes armadas', () => {
  const earlyWaves = defaultWaveSetDefinition.waves.slice(1, 4);
  const hasArmed = earlyWaves.some((wave) =>
    wave.spawns.some((enemyTypeId) => enemyDefinitions[enemyTypeId].combatModel.isArmed),
  );
  assert.equal(hasArmed, true);
});

test('M163A2 usa intervalo de spawn propio (3s) entre unidades', () => {
  const state = setupState();
  startWave(state, {
    overrideWaveDefinition: {
      interval: 0.4,
      spawns: ['m163-vads-medium', 'm163-vads-medium'],
    },
  });

  for (let i = 0; i < 40 && state.enemies.length === 0; i += 1) {
    tickSimulation(state, 0.1);
  }
  assert.equal(state.enemies.length, 1);
  assert.equal(state.spawnQueue.length, 1);
  assert.equal(state.spawnTimer, 3);
});

test('enemigo armado dispara y dania torre en rango mientras avanza', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 4, gy: 4 });
  const initialHp = tower.hp;
  const enemy = createStaticEnemy({
    id: 'enemy-armed',
    enemyTypeId: 'humvee-gunner-mg',
    armorClass: 'light',
    position: { x: tower.wx + 8, y: state.config.pathSurfaceY, z: tower.wz + 1 },
    isArmed: true,
    weaponProfile: {
      damage: 12,
      rate: 3.8,
      range: 2.4,
      projectileSpeed: 12,
      hitThreshold: 0.25,
      damageType: MUNITION_CLASSES.heavyBallistic,
      muzzleHeight: 0.22,
      muzzleForward: 0.3,
    },
  });
  state.enemies.push(enemy);

  for (let step = 0; step < 80; step += 1) {
    applyCombatStep(state, 0.016);
  }

  assert.ok(tower.hp < initialHp);
  assert.ok(state.effects.some((effect) => effect.type === 'tower-hit'));
});

test('matriz de dano y armadura plana se aplica en ambos sentidos', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  state.credits = 10000;
  assert.equal(upgradeTowerDefense(state, tower.id), true);
  assert.equal(upgradeTowerDefense(state, tower.id), true);
  const fullHp = tower.hp;

  state.projectiles.push({
    id: 'proj-light-vs-heavy',
    sourceType: 'enemy',
    sourceId: 'enemy-x',
    targetType: 'tower',
    targetId: tower.id,
    x: tower.wx,
    y: state.config.pathSurfaceY + state.config.worldScale * 0.26,
    z: tower.wz,
    vx: 0,
    vy: 0,
    vz: 1,
    speed: 0,
    hitThreshold: state.config.worldScale,
    damage: 20,
    damageType: MUNITION_CLASSES.lightBallistic,
    alive: true,
  });

  applyCombatStep(state, 0.016);
  assert.equal(tower.hp, fullHp);

  state.projectiles.push({
    id: 'proj-piercing-vs-heavy',
    sourceType: 'enemy',
    sourceId: 'enemy-y',
    targetType: 'tower',
    targetId: tower.id,
    x: tower.wx,
    y: state.config.pathSurfaceY + state.config.worldScale * 0.26,
    z: tower.wz,
    vx: 0,
    vy: 0,
    vz: 1,
    speed: 0,
    hitThreshold: state.config.worldScale,
    damage: 20,
    damageType: MUNITION_CLASSES.piercing,
    alive: true,
  });
  applyCombatStep(state, 0.016);
  assert.ok(tower.hp < fullHp);

  const enemy = createStaticEnemy({
    id: 'enemy-heavy',
    armorClass: 'heavy',
    armor: 0,
    hp: 40,
    maxHp: 40,
    position: { x: tower.wx, y: state.config.pathSurfaceY, z: tower.wz + 2 },
  });
  state.enemies.push(enemy);
  state.projectiles.push({
    id: 'proj-light-vs-heavy-enemy',
    sourceType: 'tower',
    sourceId: tower.id,
    targetType: 'enemy',
    targetId: enemy.id,
    x: enemy.position.x,
    y: enemy.position.y,
    z: enemy.position.z,
    vx: 0,
    vy: 0,
    vz: 1,
    speed: 0,
    hitThreshold: state.config.worldScale,
    damage: 5,
    damageType: MUNITION_CLASSES.lightBallistic,
    alive: true,
  });
  applyCombatStep(state, 0.016);
  assert.ok(enemy.hp <= 37.5 && enemy.hp >= 37.4);
});

test('oleada activa bloquea place, upgrades y venta', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 2, gy: 2 });
  startWave(state);

  const blockedPlacement = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 3, gy: 2 });
  assert.equal(blockedPlacement, null);
  assert.equal(upgradeTower(state, tower.id), false);
  assert.equal(upgradeTowerDefense(state, tower.id), false);
  assert.equal(sellTower(state, tower.id), false);
});

test('torre pasa a destruida y al fin de oleada revive desde baseline', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 2, gy: 2 });
  state.credits = 5000;
  upgradeTower(state, tower.id);
  upgradeTowerDefense(state, tower.id);
  const baselineLevel = tower.level;
  const baselineDefense = tower.defenseTier;

  startWave(state);
  tower.hp = 0;
  tower.destroyed = true;
  state.spawnQueue = [];
  state.enemies = [];
  state.waveActive = true;
  tickSimulation(state, 0.016);

  const restored = state.towers.find((item) => item.id === tower.id);
  assert.ok(restored);
  assert.equal(restored.destroyed, false);
  assert.equal(restored.hp, restored.maxHp);
  assert.equal(restored.level, baselineLevel);
  assert.equal(restored.defenseTier, baselineDefense);
});

test('resetWave restaura snapshot completo sin romper campos defensivos', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  startWave(state);
  tower.hp = Math.max(1, tower.hp - 30);
  tower.destroyed = true;
  resetWave(state);

  assert.equal(state.wave, 0);
  assert.equal(state.towers.length, 1);
  assert.equal(state.towers[0].destroyed, false);
});

test('enemy-killed incluye reward y enemyTypeId', () => {
  const state = setupState();
  const tower = placeTower(state, { towerTypeId: 'mg7-vulcan', gx: 1, gy: 1 });
  const enemy = createStaticEnemy({
    id: 'enemy-kill',
    hp: 3,
    maxHp: 3,
    armor: 0,
    armorClass: 'light',
    enemyTypeId: 'scout-buggy-unarmed',
    reward: 12,
    position: { x: tower.wx, y: state.config.pathSurfaceY, z: tower.wz + 20 },
  });
  state.enemies.push(enemy);
  selectTargets(state);
  for (let step = 0; step < 60; step += 1) applyCombatStep(state, 0.016);

  const killEffect = state.effects.find((effect) => effect.type === 'enemy-killed');
  assert.ok(killEffect);
  assert.equal(killEffect.reward, 12);
  assert.equal(killEffect.enemyTypeId, 'scout-buggy-unarmed');
});

test('pathWorld escala correctamente con worldScale', () => {
  const baseConfig = createGameConfig({ worldScale: 1 });
  const scaledConfig = createGameConfig({ worldScale: 10 });
  for (let index = 0; index < baseConfig.pathWorld.length; index += 1) {
    assert.equal(scaledConfig.pathWorld[index].x, baseConfig.pathWorld[index].x * 10);
    assert.equal(scaledConfig.pathWorld[index].y, baseConfig.pathWorld[index].y * 10);
    assert.equal(scaledConfig.pathWorld[index].z, baseConfig.pathWorld[index].z * 10);
  }
});

test('conversion grid/world mantiene celda correcta en escala 10', () => {
  const config = createGameConfig({ worldScale: 10 });
  const world = gridToWorld(7, 3, config.worldScale, config.halfWidth, config.halfHeight);
  const grid = worldToGrid(world.x + 0.1, world.z - 0.1, config.worldScale, config.halfWidth, config.halfHeight);
  assert.equal(grid.gx, 7);
  assert.equal(grid.gy, 3);
});
