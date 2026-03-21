import {
  allocateId,
  cloneStateValue,
  createWaveSnapshot,
  getCellWorldPosition,
  getTowerLevel,
  getTowerRange,
  markUiDirty,
  markWorldDirty,
  queueEffect,
} from './state.js';

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
    speed: definition.stats.speed,
    reward: definition.stats.reward,
    pathIndex: 0,
    progress: 0,
    alive: true,
    position: { ...startPos },
    rotation: 0,
  };
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
          title: 'Game Over',
          text: `Oleada ${state.wave}`,
          color: '#EF4444',
        };
        markUiDirty(state);
      }
      return;
    }
  }

  const segmentFrom = pathWorld[enemy.pathIndex];
  const segmentTo = pathWorld[enemy.pathIndex + 1];
  enemy.position.x = lerp(segmentFrom.x, segmentTo.x, enemy.progress);
  enemy.position.y = 0.01;
  enemy.position.z = lerp(segmentFrom.z, segmentTo.z, enemy.progress);

  const dirX = segmentTo.x - segmentFrom.x;
  const dirZ = segmentTo.z - segmentFrom.z;
  const targetAngle = Math.atan2(dirX, dirZ);
  let diff = targetAngle - enemy.rotation;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  enemy.rotation += diff * Math.min(1, dt * 8);
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
  state.spawnQueue = Array.from({ length: waveDefinition.count }, () => waveDefinition.enemyTypeId);
  state.spawnTimer = 0.4;
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
      const distance = distance2d(enemy.position.x, enemy.position.z, tower.wx, tower.wz);
      if (distance <= stats.range && distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }

    tower.hasTarget = Boolean(nearest);
    if (nearest) {
      tower.aimAngle = Math.atan2(nearest.position.x - tower.wx, nearest.position.z - tower.wz);
      tower.targetEnemyId = nearest.id;
    } else {
      tower.targetEnemyId = null;
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
  const projectile = {
    id: allocateId('projectile'),
    towerId: tower.id,
    targetEnemyId: enemy.id,
    x: tower.wx,
    y: 0.35,
    z: tower.wz,
    speed: definition.combatModel.projectileSpeed,
    damage: stats.damage,
    alive: true,
  };

  state.projectiles.push(projectile);
  queueEffect(state, {
    type: 'projectile-fired',
    towerId: tower.id,
    enemyId: enemy.id,
    fireIndex: tower.fireIndex,
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

    const direction = {
      x: target.position.x - projectile.x,
      y: target.position.y - projectile.y,
      z: target.position.z - projectile.z,
    };
    const length = Math.hypot(direction.x, direction.y, direction.z);

    if (length < 0.12) {
      const damage = Math.max(0, projectile.damage - target.armor);
      target.hp -= damage;
      queueEffect(state, {
        type: 'hit',
        position: { x: projectile.x, y: projectile.y, z: projectile.z },
        color: 0xffcc22,
        count: 3,
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
          color: 0xff4400,
          count: 6,
          enemyId: target.id,
        });
      }

      projectile.alive = false;
      continue;
    }

    const step = projectile.speed * dt;
    projectile.x += (direction.x / length) * step;
    projectile.y += (direction.y / length) * step;
    projectile.z += (direction.z / length) * step;
  }

  state.projectiles = state.projectiles.filter((item) => item.alive);
}

export function tickSimulation(state, dt) {
  const clampedDt = Math.min(dt, 0.05);

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
      state.spawnTimer = state.spawnQueue.length > 0 ? state.activeWaveDefinition.interval : 0.5;
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
        title: '¡Victoria!',
        text: `Base defendida · ${state.lives} vidas · $${state.credits}`,
        color: '#22C55E',
      };
      markUiDirty(state);
    }
  }

  return {
    uiChanged: state.uiDirty,
    worldChanged: state.worldDirty,
  };
}
