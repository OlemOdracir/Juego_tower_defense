import {
  allocateId,
  cloneStateValue,
  createWaveSnapshot,
  getCellWorldPosition,
  getTowerLevel,
  markUiDirty,
  markWorldDirty,
  queueEffect,
} from './state.js';
import { clampMg7Pitch, getMg7Direction, getMg7MuzzleWorld } from '../shared/mg7-geometry.js';
import { GAMEPLAY_CONFIG } from '../../config/gameplay.js';

const SIM = GAMEPLAY_CONFIG.simulation;
const FX = GAMEPLAY_CONFIG.effects;
const OVR = GAMEPLAY_CONFIG.overlays;

function getTowerDefinition(state, tower) {
  return state.config.towerDefinitions[tower.towerTypeId];
}

function getEnemyDefinition(state, enemyTypeId) {
  return state.config.enemyDefinitions[enemyTypeId];
}

function distance2d(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

function distance3d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function createEnemyInstance(state, enemyTypeId) {
  const definition = getEnemyDefinition(state, enemyTypeId);
  const startPos = state.config.pathWorld[0];

  return {
    id: allocateId('enemy'),
    enemyTypeId,
    hp: definition.stats.hp,
    maxHp: definition.stats.hp,
    armor: definition.stats.armor,
    speed: definition.stats.speed * state.config.worldScale,
    reward: definition.stats.reward,
    pathIndex: 0,
    progress: 0,
    alive: true,
    position: { ...startPos },
    rotation: 0,
  };
}

function getTowerMuzzleOrigin(definition, tower, worldScale, fireIndex = 0) {
  return getMg7MuzzleWorld(tower, definition.levels[tower.level].scale, worldScale, fireIndex);
}

function updateEnemyMovement(state, enemy, dt) {
  const { pathWorld } = state.config;

  if (enemy.pathIndex >= pathWorld.length - 1) {
    return;
  }

  const from = pathWorld[enemy.pathIndex];
  const to = pathWorld[enemy.pathIndex + 1];
  const segmentLength = distance3d(from, to);
  enemy.progress += (enemy.speed * dt) / segmentLength;

  if (enemy.progress >= 1) {
    enemy.progress = 0;
    enemy.pathIndex += 1;

    if (enemy.pathIndex >= pathWorld.length - 1) {
      enemy.alive = false;
      state.lives -= 1;
      markUiDirty(state);

      if (state.lives <= 0) {
        state.gameOver = true;
        state.victory = false;
        state.overlay = {
          visible: true,
          title: OVR.gameOver.title,
          text: `Oleada ${state.wave}`,
          color: OVR.gameOver.color,
        };
        markUiDirty(state);
      }
      return;
    }
  }

  const segmentFrom = pathWorld[enemy.pathIndex];
  const segmentTo = pathWorld[enemy.pathIndex + 1];
  enemy.position.x = lerp(segmentFrom.x, segmentTo.x, enemy.progress);
  enemy.position.y = lerp(segmentFrom.y, segmentTo.y, enemy.progress);
  enemy.position.z = lerp(segmentFrom.z, segmentTo.z, enemy.progress);

  const dirX = segmentTo.x - segmentFrom.x;
  const dirZ = segmentTo.z - segmentFrom.z;
  const targetAngle = Math.atan2(dirX, dirZ);
  let diff = targetAngle - enemy.rotation;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  enemy.rotation += diff * Math.min(1, dt * SIM.enemyRotationLerp);
}

export function placeTower(state, placement) {
  const towerTypeId = placement.towerTypeId ?? 'mg7-vulcan';
  const definition = state.config.towerDefinitions[towerTypeId];
  const { gx, gy } = placement;

  if (!definition) {
    return null;
  }

  if (state.grid[gy]?.[gx] !== 0 || state.credits < definition.economy.baseCost) {
    return null;
  }

  const world = getCellWorldPosition(state.config, gx, gy);
  const tower = {
    id: allocateId('tower'),
    towerTypeId,
    gx,
    gy,
    wx: world.x,
    wz: world.z,
    level: 0,
    cooldown: 0,
    kills: 0,
    invested: definition.economy.baseCost,
    fireIndex: 0,
    aimAngle: 0,
    aimPitch: SIM.defaultAimPitch,
    hasTarget: false,
  };

  state.credits -= definition.economy.baseCost;
  state.grid[gy][gx] = 2;
  state.towers.push(tower);
  state.selectedTowerId = tower.id;
  markUiDirty(state);
  markWorldDirty(state);
  return tower;
}

export function upgradeTower(state, towerId) {
  const tower = state.towers.find((item) => item.id === towerId);
  if (!tower) {
    return false;
  }

  const definition = getTowerDefinition(state, tower);
  const level = getTowerLevel(definition, tower.level);
  if (level.upgradeCost == null || tower.level >= definition.levels.length - 1) {
    return false;
  }

  if (state.credits < level.upgradeCost) {
    return false;
  }

  state.credits -= level.upgradeCost;
  tower.invested += level.upgradeCost;
  tower.level += 1;
  markUiDirty(state);
  markWorldDirty(state);
  return true;
}

export function sellTower(state, towerId) {
  const tower = state.towers.find((item) => item.id === towerId);
  if (!tower) {
    return false;
  }

  const definition = getTowerDefinition(state, tower);
  const refund = Math.floor(tower.invested * definition.economy.sellRatio);
  state.credits += refund;
  state.grid[tower.gy][tower.gx] = 0;
  state.towers = state.towers.filter((item) => item.id !== towerId);
  if (state.selectedTowerId === towerId) {
    state.selectedTowerId = null;
  }
  markUiDirty(state);
  markWorldDirty(state);
  return true;
}

export function startWave(state) {
  if (state.waveActive || state.gameOver || state.wave >= state.config.waveSet.waves.length) {
    return false;
  }

  const waveDefinition = state.config.waveSet.waves[state.wave];
  state.waveSnapshot = createWaveSnapshot(state);
  state.activeWaveDefinition = cloneStateValue(waveDefinition);
  state.wave += 1;
  state.waveActive = true;
  state.spawnQueue = waveDefinition.spawns ? [...waveDefinition.spawns] : Array.from({ length: waveDefinition.count }, () => waveDefinition.enemyTypeId);
  state.spawnTimer = SIM.initialSpawnDelay;
  markUiDirty(state);
  return true;
}

export function selectTargets(state) {
  for (const tower of state.towers) {
    const definition = getTowerDefinition(state, tower);
    const stats = getTowerLevel(definition, tower.level);
    let nearest = null;
    let nearestDistance = Infinity;

    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const range = stats.range * state.config.worldScale;
      const distance = distance2d(enemy.position.x, enemy.position.z, tower.wx, tower.wz);
      if (distance <= range && distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }

    tower.hasTarget = Boolean(nearest);
    if (nearest) {
      const dx = nearest.position.x - tower.wx;
      const dz = nearest.position.z - tower.wz;
      const muzzleOrigin = getTowerMuzzleOrigin(definition, tower, state.config.worldScale, tower.fireIndex);
      const dy = nearest.position.y - muzzleOrigin.y;
      tower.aimAngle = Math.atan2(dx, dz);
      const pitchLimits = definition.combatModel.pitchLimits ?? SIM.defaultPitchLimits;
      tower.aimPitch = clampMg7Pitch(-Math.atan2(dy, Math.hypot(dx, dz)), pitchLimits.min, pitchLimits.max);
      tower.targetEnemyId = nearest.id;
    } else {
      tower.targetEnemyId = null;
      tower.aimPitch = SIM.defaultAimPitch;
    }
  }

  return state.towers.map((tower) => ({
    towerId: tower.id,
    targetEnemyId: tower.targetEnemyId ?? null,
  }));
}

function spawnEnemy(state, enemyTypeId) {
  const enemy = createEnemyInstance(state, enemyTypeId);
  state.enemies.push(enemy);
  markUiDirty(state);
  markWorldDirty(state);
}

function fireProjectile(state, tower, enemy) {
  const definition = getTowerDefinition(state, tower);
  const stats = getTowerLevel(definition, tower.level);
  const fireIndex = tower.fireIndex;
  const muzzleOrigin = getTowerMuzzleOrigin(definition, tower, state.config.worldScale, fireIndex);
  const shotDirection = getMg7Direction(tower.aimAngle, tower.aimPitch);
  const projectile = {
    id: allocateId('projectile'),
    towerId: tower.id,
    targetEnemyId: enemy.id,
    x: muzzleOrigin.x,
    y: muzzleOrigin.y,
    z: muzzleOrigin.z,
    vx: shotDirection.x,
    vy: shotDirection.y,
    vz: shotDirection.z,
    speed: definition.combatModel.projectileSpeed * state.config.worldScale,
    hitThreshold: definition.combatModel.hitThreshold * state.config.worldScale,
    damage: stats.damage,
    alive: true,
  };

  state.projectiles.push(projectile);
  queueEffect(state, {
    type: 'projectile-fired',
    towerId: tower.id,
    enemyId: enemy.id,
    fireIndex,
  });
  tower.fireIndex += 1;
}

export function applyCombatStep(state, dt) {
  for (const tower of state.towers) {
    const definition = getTowerDefinition(state, tower);
    const stats = getTowerLevel(definition, tower.level);
    tower.cooldown -= dt;

    if (!tower.targetEnemyId) {
      continue;
    }

    const enemy = state.enemies.find((item) => item.id === tower.targetEnemyId && item.alive);
    if (!enemy) {
      continue;
    }

    if (tower.cooldown <= 0) {
      tower.cooldown = 1 / stats.rate;
      fireProjectile(state, tower, enemy);
    }
  }

  for (const projectile of state.projectiles) {
    if (!projectile.alive) continue;

    const target = state.enemies.find((item) => item.id === projectile.targetEnemyId);
    if (!target || !target.alive) {
      projectile.alive = false;
      continue;
    }

    const directionToTarget = {
      x: target.position.x - projectile.x,
      y: target.position.y - projectile.y,
      z: target.position.z - projectile.z,
    };
    const length = Math.hypot(directionToTarget.x, directionToTarget.y, directionToTarget.z);

    if (length < projectile.hitThreshold) {
      const damage = Math.max(0, projectile.damage - target.armor);
      target.hp -= damage;
      queueEffect(state, {
        type: 'hit',
        position: { x: projectile.x, y: projectile.y, z: projectile.z },
        color: FX.hit.color,
        count: FX.hit.count,
      });

      if (target.hp <= 0) {
        target.alive = false;
        const tower = state.towers.find((item) => item.id === projectile.towerId);
        if (tower) {
          tower.kills += 1;
        }
        state.credits += target.reward;
        markUiDirty(state);
        queueEffect(state, {
          type: 'enemy-killed',
          position: { ...target.position },
          color: FX.kill.color,
          count: FX.kill.count,
          enemyId: target.id,
        });
      }

      projectile.alive = false;
      continue;
    }

    const step = projectile.speed * dt;
    projectile.x += projectile.vx * step;
    projectile.y += projectile.vy * step;
    projectile.z += projectile.vz * step;
  }

  state.projectiles = state.projectiles.filter((item) => item.alive);
}

export function tickSimulation(state, dt) {
  const clampedDt = Math.min(dt, SIM.maxDeltaTime);

  if (state.gameOver) {
    return {
      uiChanged: state.uiDirty,
      worldChanged: state.worldDirty,
    };
  }

  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= clampedDt;
    if (state.spawnTimer <= 0) {
      const enemyTypeId = state.spawnQueue.shift();
      spawnEnemy(state, enemyTypeId);
      state.spawnTimer = state.spawnQueue.length > 0 ? state.activeWaveDefinition.interval : SIM.finalEnemySpacing;
    }
  }

  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    updateEnemyMovement(state, enemy, clampedDt);
  }

  state.enemies = state.enemies.filter((item) => item.alive);
  selectTargets(state);
  applyCombatStep(state, clampedDt);

  if (state.waveActive && state.spawnQueue.length === 0 && state.enemies.length === 0) {
    state.waveActive = false;
    state.activeWaveDefinition = null;
    markUiDirty(state);

    if (state.wave >= state.config.waveSet.waves.length && state.lives > 0) {
      state.gameOver = true;
      state.victory = true;
      state.overlay = {
        visible: true,
        title: OVR.victory.title,
        text: `Base defendida · ${state.lives} vidas · $${state.credits}`,
        color: OVR.victory.color,
      };
      markUiDirty(state);
    }
  }

  return {
    uiChanged: state.uiDirty,
    worldChanged: state.worldDirty,
  };
}
