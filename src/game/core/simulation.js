import {
  allocateId,
  cloneStateValue,
  createTowerWaveBaseline,
  createWaveSnapshot,
  getCellWorldPosition,
  getTowerLevel,
  markUiDirty,
  markWorldDirty,
  queueEffect,
} from './state.js';
import { clampMg7Pitch, getMg7Direction, getMg7MuzzleWorld } from '../shared/mg7-geometry.js';
import { ARMOR_CLASSES, DAMAGE_MATRIX } from '../../data/enemies/vehicle-combat.js';
import { GAMEPLAY_CONFIG } from '../../config/gameplay.js';

const SIM = GAMEPLAY_CONFIG.simulation;
const FX = GAMEPLAY_CONFIG.effects;
const OVR = GAMEPLAY_CONFIG.overlays;
const COMBAT = GAMEPLAY_CONFIG.combat;

function getTowerDefinition(state, tower) {
  return state.config.towerDefinitions[tower.towerTypeId];
}

function getEnemyDefinition(state, enemyTypeId) {
  return state.config.enemyDefinitions[enemyTypeId];
}

function getTowerDefenseLevel(definition, defenseTier) {
  const levels = definition.defenseLevels ?? [];
  if (levels.length === 0) {
    return {
      label: 'Base Armor',
      armorClass: 'light',
      maxHp: 180,
      armor: 3,
      upgradeCost: null,
    };
  }
  const safeIndex = Math.max(0, Math.min(defenseTier, levels.length - 1));
  return levels[safeIndex];
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

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length <= 0.00001) {
    return { x: 0, y: 0, z: 1 };
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function resolveDamage(baseDamage, munitionClass, armorClass, flatArmor) {
  const multiplier = DAMAGE_MATRIX[munitionClass]?.[armorClass] ?? 1;
  return Math.max(0, baseDamage * multiplier - flatArmor);
}

function resetTowerCombatFlags(tower) {
  tower.destroyed = false;
  tower.damageFxActive = false;
  tower.hasTarget = false;
  tower.targetEnemyId = null;
  tower.cooldown = 0;
  tower.aimPitch = SIM.defaultAimPitch;
}

function createEnemyInstance(state, enemyTypeId) {
  const definition = getEnemyDefinition(state, enemyTypeId);
  const startPos = state.config.pathWorld[0];
  const armorClass = definition.armorClass ?? 'light';
  const speedModifier = ARMOR_CLASSES[armorClass]?.speedModifier ?? 1;
  const defaultHitRadiusByArmor = {
    light: 0.14,
    medium: 0.18,
    heavy: 0.22,
  };
  const hitRadiusBase = definition.combatModel.hitRadius ?? defaultHitRadiusByArmor[armorClass] ?? 0.16;

  return {
    id: allocateId('enemy'),
    enemyTypeId,
    hp: definition.stats.hp,
    maxHp: definition.stats.hp,
    armor: definition.stats.armor,
    armorClass,
    speed: definition.stats.speed * speedModifier * state.config.worldScale,
    reward: definition.stats.reward,
    pathIndex: 0,
    progress: 0,
    alive: true,
    position: { ...startPos },
    rotation: 0,
    damageType: definition.combatModel.damageType,
    isArmed: Boolean(definition.combatModel.isArmed),
    weaponProfile: definition.combatModel.weaponProfile ?? null,
    weaponCooldown: 0,
    fireIndex: 0,
    targetTowerId: null,
    aimAngle: 0,
    aimPitch: 0,
    hitRadius: hitRadiusBase * state.config.worldScale,
  };
}

function getTowerMuzzleOrigin(definition, tower, worldScale, fireIndex = 0) {
  return getMg7MuzzleWorld(tower, definition.levels[tower.level].scale, worldScale, fireIndex);
}

function getTowerAimPoint(state, tower) {
  const definition = getTowerDefinition(state, tower);
  const offenseLevel = getTowerLevel(definition, tower.level);
  const aimHeight =
    state.config.pathSurfaceY +
    (definition.combatModel.muzzleHeightBase + offenseLevel.scale * 0.2) * state.config.worldScale;
  return {
    x: tower.wx,
    y: aimHeight,
    z: tower.wz,
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
          title: OVR.gameOver.title,
          text: `Wave ${state.wave}`,
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

function refreshGridWithTowerCells(state) {
  state.grid = cloneStateValue(state.config.baseGrid);
  for (const tower of state.towers) {
    if (state.grid[tower.gy]?.[tower.gx] === 0) {
      state.grid[tower.gy][tower.gx] = 2;
    }
  }
}

function restoreTowersFromWaveBaseline(state) {
  if (!state.towerWaveBaseline?.length) {
    return;
  }

  const restored = state.towerWaveBaseline
    .map((baseline) => {
      const definition = state.config.towerDefinitions[baseline.towerTypeId];
      if (!definition) return null;
      const defenseLevel = getTowerDefenseLevel(definition, baseline.defenseTier ?? 0);
      return {
        ...baseline,
        defenseTier: Math.max(0, Math.min(baseline.defenseTier ?? 0, (definition.defenseLevels?.length ?? 1) - 1)),
        armorClass: defenseLevel.armorClass,
        maxHp: defenseLevel.maxHp,
        hp: defenseLevel.maxHp,
        armor: defenseLevel.armor,
        destroyed: false,
        damageFxActive: false,
        cooldown: 0,
        hasTarget: false,
        targetEnemyId: null,
      };
    })
    .filter(Boolean);

  state.towers = restored;
  if (state.selectedTowerId && !state.towers.some((tower) => tower.id === state.selectedTowerId)) {
    state.selectedTowerId = null;
  }
  refreshGridWithTowerCells(state);
  markUiDirty(state);
  markWorldDirty(state);
}

function spawnEnemy(state, enemyTypeId) {
  const enemy = createEnemyInstance(state, enemyTypeId);
  state.enemies.push(enemy);
  markUiDirty(state);
  markWorldDirty(state);
}

function fireTowerProjectile(state, tower, enemy) {
  const definition = getTowerDefinition(state, tower);
  const stats = getTowerLevel(definition, tower.level);
  const fireIndex = tower.fireIndex;
  const muzzleOrigin = getTowerMuzzleOrigin(definition, tower, state.config.worldScale, fireIndex);
  const shotDirection = getMg7Direction(tower.aimAngle, tower.aimPitch);
  const projectile = {
    id: allocateId('projectile'),
    sourceType: 'tower',
    sourceId: tower.id,
    targetType: 'enemy',
    targetId: enemy.id,
    x: muzzleOrigin.x,
    y: muzzleOrigin.y,
    z: muzzleOrigin.z,
    vx: shotDirection.x,
    vy: shotDirection.y,
    vz: shotDirection.z,
    speed: definition.combatModel.projectileSpeed * state.config.worldScale,
    hitThreshold: definition.combatModel.hitThreshold * state.config.worldScale,
    damage: stats.damage,
    damageType: definition.combatModel.damageType,
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

function fireEnemyProjectile(state, enemy, tower) {
  const weapon = enemy.weaponProfile;
  if (!weapon) return;
  const targetPoint = getTowerAimPoint(state, tower);
  const forwardOffset = (weapon.muzzleForward ?? 0.3) * state.config.worldScale;
  const source = {
    x: enemy.position.x + Math.sin(enemy.aimAngle) * forwardOffset,
    y: enemy.position.y + (weapon.muzzleHeight ?? 0.2) * state.config.worldScale,
    z: enemy.position.z + Math.cos(enemy.aimAngle) * forwardOffset,
  };
  const direction = normalizeVector({
    x: targetPoint.x - source.x,
    y: targetPoint.y - source.y,
    z: targetPoint.z - source.z,
  });

  const projectile = {
    id: allocateId('projectile'),
    sourceType: 'enemy',
    sourceId: enemy.id,
    targetType: 'tower',
    targetId: tower.id,
    x: source.x,
    y: source.y,
    z: source.z,
    vx: direction.x,
    vy: direction.y,
    vz: direction.z,
    speed: (weapon.projectileSpeed ?? 10) * state.config.worldScale,
    hitThreshold: (weapon.hitThreshold ?? 0.2) * state.config.worldScale,
    damage: weapon.damage ?? 0,
    damageType: weapon.damageType ?? enemy.damageType,
    alive: true,
  };
  // aimAngle is managed incrementally in updateEnemyWeapons — only update pitch here
  enemy.aimPitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
  const fireIndex = enemy.fireIndex ?? 0;
  enemy.fireIndex = fireIndex + 1;

  state.projectiles.push(projectile);
  queueEffect(state, {
    type: 'enemy-projectile-fired',
    enemyId: enemy.id,
    fireIndex,
    position: source,
  });
}

function rotateTurretToward(current, target, speed, dt) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const maxStep = speed * dt;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

function isTargetInFiringArc(enemy, targetX, targetZ, firingArc) {
  if (firingArc >= Math.PI * 2) return true;
  const dx = targetX - enemy.position.x;
  const dz = targetZ - enemy.position.z;
  const angleToTarget = Math.atan2(dx, dz);
  let diff = angleToTarget - enemy.rotation;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= firingArc / 2;
}

function findNearestTowerInRange(state, enemy, rangeWorld) {
  const firingArc = enemy.weaponProfile?.firingArc ?? Math.PI * 2;
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const tower of state.towers) {
    if (tower.destroyed) continue;
    if (tower.hp <= 0) continue;
    const distance = distance2d(enemy.position.x, enemy.position.z, tower.wx, tower.wz);
    if (distance <= rangeWorld && distance < nearestDistance) {
      if (!isTargetInFiringArc(enemy, tower.wx, tower.wz, firingArc)) continue;
      nearestDistance = distance;
      nearest = tower;
    }
  }
  return nearest;
}

function updateEnemyWeapons(state, dt) {
  for (const enemy of state.enemies) {
    if (!enemy.alive || !enemy.isArmed || !enemy.weaponProfile) {
      enemy.targetTowerId = null;
      continue;
    }

    const weapon = enemy.weaponProfile;
    enemy.weaponCooldown -= dt;
    const rangeWorld = weapon.range * state.config.worldScale;
    const targetTower = findNearestTowerInRange(state, enemy, rangeWorld);

    if (!targetTower) {
      enemy.targetTowerId = null;
      continue;
    }

    enemy.targetTowerId = targetTower.id;

    // Rotate turret toward target at yawSpeed (rad/s); default fast enough to feel instant
    const dx = targetTower.wx - enemy.position.x;
    const dz = targetTower.wz - enemy.position.z;
    const desiredAngle = Math.atan2(dx, dz);
    const yawSpeed = weapon.yawSpeed ?? Math.PI * 2;
    enemy.aimAngle = rotateTurretToward(enemy.aimAngle, desiredAngle, yawSpeed, dt);

    // Only fire once turret is aligned within readyAngle
    let angleDiff = desiredAngle - enemy.aimAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    if (Math.abs(angleDiff) > (weapon.readyAngle ?? 0.1)) continue;

    if (enemy.weaponCooldown <= 0) {
      const rate = Math.max(0.05, weapon.rate ?? 0.5);
      enemy.weaponCooldown = 1 / rate;
      fireEnemyProjectile(state, enemy, targetTower);
    }
  }
}

export function placeTower(state, placement) {
  if (state.waveActive) {
    return null;
  }

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
  const defenseLevel = getTowerDefenseLevel(definition, 0);
  const tower = {
    id: allocateId('tower'),
    towerTypeId,
    gx,
    gy,
    wx: world.x,
    wz: world.z,
    level: 0,
    defenseTier: 0,
    hp: defenseLevel.maxHp,
    maxHp: defenseLevel.maxHp,
    armor: defenseLevel.armor,
    armorClass: defenseLevel.armorClass,
    destroyed: false,
    damageFxActive: false,
    cooldown: 0,
    kills: 0,
    invested: definition.economy.baseCost,
    fireIndex: 0,
    aimAngle: 0,
    aimPitch: SIM.defaultAimPitch,
    hasTarget: false,
    targetEnemyId: null,
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
  if (state.waveActive) {
    return false;
  }

  const tower = state.towers.find((item) => item.id === towerId);
  if (!tower || tower.destroyed) {
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

export function upgradeTowerDefense(state, towerId) {
  if (state.waveActive) {
    return false;
  }

  const tower = state.towers.find((item) => item.id === towerId);
  if (!tower || tower.destroyed) {
    return false;
  }
  const definition = getTowerDefinition(state, tower);
  const levels = definition.defenseLevels ?? [];
  if (levels.length <= 1 || tower.defenseTier >= levels.length - 1) {
    return false;
  }
  const currentLevel = levels[tower.defenseTier];
  if (currentLevel.upgradeCost == null || state.credits < currentLevel.upgradeCost) {
    return false;
  }

  state.credits -= currentLevel.upgradeCost;
  tower.invested += currentLevel.upgradeCost;
  tower.defenseTier += 1;
  const nextDefense = levels[tower.defenseTier];
  tower.armorClass = nextDefense.armorClass;
  tower.maxHp = nextDefense.maxHp;
  tower.hp = nextDefense.maxHp;
  tower.armor = nextDefense.armor;
  resetTowerCombatFlags(tower);
  markUiDirty(state);
  markWorldDirty(state);
  return true;
}

export function sellTower(state, towerId) {
  if (state.waveActive) {
    return false;
  }

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

export function startWave(state, options = {}) {
  if (state.waveActive || state.gameOver || state.wave >= state.config.waveSet.waves.length) {
    return false;
  }

  for (const tower of state.towers) {
    tower.hp = tower.maxHp;
    resetTowerCombatFlags(tower);
  }

  const baseWaveDefinition = state.config.waveSet.waves[state.wave];
  const waveDefinition = cloneStateValue(baseWaveDefinition);
  const overrideWaveDefinition = options.overrideWaveDefinition ?? null;
  if (overrideWaveDefinition) {
    if (typeof overrideWaveDefinition.interval === 'number' && overrideWaveDefinition.interval > 0) {
      waveDefinition.interval = overrideWaveDefinition.interval;
    }
    if (Array.isArray(overrideWaveDefinition.spawns)) {
      const validSpawns = overrideWaveDefinition.spawns.filter((enemyTypeId) => state.config.enemyDefinitions[enemyTypeId]);
      if (validSpawns.length > 0) {
        waveDefinition.spawns = validSpawns;
        waveDefinition.count = validSpawns.length;
      }
    }
    waveDefinition.tags = {
      ...(waveDefinition.tags ?? {}),
      debugOverride: true,
    };
  }

  state.waveSnapshot = createWaveSnapshot(state);
  state.towerWaveBaseline = createTowerWaveBaseline(state);
  state.activeWaveDefinition = waveDefinition;
  state.wave += 1;
  state.waveActive = true;
  state.spawnQueue = waveDefinition.spawns
    ? [...waveDefinition.spawns]
    : Array.from({ length: waveDefinition.count }, () => waveDefinition.enemyTypeId);
  state.spawnTimer = SIM.initialSpawnDelay;
  markUiDirty(state);
  markWorldDirty(state);
  return true;
}

export function selectTargets(state) {
  for (const tower of state.towers) {
    if (tower.destroyed) {
      tower.hasTarget = false;
      tower.targetEnemyId = null;
      tower.aimPitch = SIM.defaultAimPitch;
      continue;
    }

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

function applyTowerHit(state, projectile, tower) {
  const damage = resolveDamage(
    projectile.damage,
    projectile.damageType,
    tower.armorClass,
    tower.armor,
  );
  if (damage <= 0) return;

  tower.hp = Math.max(0, tower.hp - damage);
  queueEffect(state, {
    type: 'tower-hit',
    towerId: tower.id,
    position: { x: tower.wx, y: state.config.pathSurfaceY + state.config.worldScale * 0.24, z: tower.wz },
    color: 0xffa655,
    count: 3,
  });

  const hpRatio = tower.maxHp > 0 ? tower.hp / tower.maxHp : 0;
  if (!tower.destroyed && hpRatio <= COMBAT.towerDamagedThreshold && hpRatio > 0) {
    if (!tower.damageFxActive) {
      tower.damageFxActive = true;
      queueEffect(state, {
        type: 'tower-damaged-state',
        towerId: tower.id,
        active: true,
      });
    }
  }

  if (tower.hp <= COMBAT.towerDestroyedVfxHpFloor && !tower.destroyed) {
    tower.destroyed = true;
    tower.damageFxActive = false;
    tower.hasTarget = false;
    tower.targetEnemyId = null;
    tower.cooldown = 0;
    queueEffect(state, {
      type: 'tower-destroyed',
      towerId: tower.id,
      position: { x: tower.wx, y: state.config.pathSurfaceY + state.config.worldScale * 0.16, z: tower.wz },
      color: 0xff7733,
      count: 8,
    });
  }

  markUiDirty(state);
  markWorldDirty(state);
}

function applyEnemyHit(state, projectile, target) {
  const damage = resolveDamage(
    projectile.damage,
    projectile.damageType,
    target.armorClass ?? 'light',
    target.armor,
  );
  target.hp -= damage;

  queueEffect(state, {
    type: 'hit',
    position: { x: projectile.x, y: projectile.y, z: projectile.z },
    color: FX.hit.color,
    count: FX.hit.count,
  });

  if (target.hp <= 0) {
    target.alive = false;
    const tower = state.towers.find((item) => item.id === projectile.sourceId);
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
      enemyTypeId: target.enemyTypeId,
      reward: target.reward,
    });
  }
}

export function applyCombatStep(state, dt) {
  for (const tower of state.towers) {
    if (tower.destroyed) continue;

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
      fireTowerProjectile(state, tower, enemy);
    }
  }

  updateEnemyWeapons(state, dt);

  for (const projectile of state.projectiles) {
    if (!projectile.alive) continue;

    if (projectile.targetType === 'enemy') {
      const target = state.enemies.find((item) => item.id === projectile.targetId);
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
      const hitDistance = Math.max(projectile.hitThreshold, target.hitRadius ?? 0);
      if (length < hitDistance) {
        applyEnemyHit(state, projectile, target);
        projectile.alive = false;
        continue;
      }
    } else if (projectile.targetType === 'tower') {
      const tower = state.towers.find((item) => item.id === projectile.targetId && !item.destroyed);
      if (!tower) {
        projectile.alive = false;
        continue;
      }

      const targetPoint = getTowerAimPoint(state, tower);
      const length = Math.hypot(
        targetPoint.x - projectile.x,
        targetPoint.y - projectile.y,
        targetPoint.z - projectile.z,
      );
      if (length < projectile.hitThreshold) {
        applyTowerHit(state, projectile, tower);
        projectile.alive = false;
        continue;
      }
    } else {
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
      if (state.spawnQueue.length > 0) {
        const spawnedDefinition = state.config.enemyDefinitions[enemyTypeId];
        state.spawnTimer = spawnedDefinition?.spawnIntervalSeconds ?? state.activeWaveDefinition.interval;
      } else {
        state.spawnTimer = SIM.finalEnemySpacing;
      }
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
    restoreTowersFromWaveBaseline(state);
    markUiDirty(state);

    if (state.wave >= state.config.waveSet.waves.length && state.lives > 0) {
      state.gameOver = true;
      state.victory = true;
      state.overlay = {
        visible: true,
        title: OVR.victory.title,
        text: `Base defended - ${state.lives} lives - $${state.credits}`,
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
