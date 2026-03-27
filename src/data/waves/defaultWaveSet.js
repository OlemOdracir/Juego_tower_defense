import { vehiclePoolsByTier } from '../enemies/vehicleCatalog.js';
import { enemyDefinitions } from '../enemies/index.js';
import { GAMEPLAY_CONFIG } from '../../config/gameplay.js';

const W = GAMEPLAY_CONFIG.waves;

function createSeededRandom(seed) {
  let value = seed >>> 0;
  return function next() {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(pool, random) {
  return pool[Math.floor(random() * pool.length)];
}

function pickTierForWave(waveNumber, random) {
  const TP = W.tierProbabilities;
  if (waveNumber <= W.tierUnlocks[2] - 1) return 1;
  if (waveNumber <= TP.midMaxWave) {
    return random() > TP.tier2Early ? 2 : 1;
  }
  if (waveNumber < W.tierUnlocks[3]) {
    return random() > TP.tier2Mid ? 2 : 1;
  }

  const roll = random();
  if (roll > TP.tier3Late) return 3;
  if (roll > TP.tier2Late) return 2;
  return 1;
}

function getArmedChance(waveNumber, tier) {
  const chanceCfg = W.armedChanceByWave;
  if (waveNumber <= 1) return 0;
  if (waveNumber <= 3) return chanceCfg.wave2to3[`tier${tier}`] ?? 0;
  if (waveNumber <= 6) return chanceCfg.wave4to6[`tier${tier}`] ?? 0;
  if (waveNumber <= 8) return chanceCfg.wave7to8[`tier${tier}`] ?? 0;
  return chanceCfg.wave9plus[`tier${tier}`] ?? 0;
}

function pickEnemyForWave(waveNumber, random) {
  if (waveNumber === 1) {
    return pick(vehiclePoolsByTier[1].unarmed, random);
  }

  const tier = pickTierForWave(waveNumber, random);
  const tierPool = vehiclePoolsByTier[tier];
  const armedChance = getArmedChance(waveNumber, tier);
  const useArmed = random() < armedChance;

  if (useArmed && tierPool.armed.length > 0) {
    return pick(tierPool.armed, random);
  }
  if (tierPool.unarmed.length > 0) {
    return pick(tierPool.unarmed, random);
  }
  return pick(tierPool.armed, random);
}

function getArmedPoolForWave(waveNumber) {
  const pool = [];
  if (waveNumber >= 2) {
    pool.push(...vehiclePoolsByTier[1].armed);
  }
  if (waveNumber >= W.tierUnlocks[2]) {
    pool.push(...vehiclePoolsByTier[2].armed);
  }
  if (waveNumber >= W.tierUnlocks[3]) {
    pool.push(...vehiclePoolsByTier[3].armed);
  }
  return pool;
}

function createWave(index) {
  const waveNumber = index + 1;
  const random = createSeededRandom(W.seedBase + waveNumber * W.seedMultiplier);
  const count = W.count.base + index * W.count.perWave + (index > W.count.bonusAfterWave ? W.count.bonus : 0);
  const interval = Math.max(W.interval.min, W.interval.base - index * W.interval.decayPerWave);
  const spawns = [];
  for (let spawnIndex = 0; spawnIndex < count; spawnIndex += 1) {
    spawns.push(pickEnemyForWave(waveNumber, random));
  }
  if (waveNumber >= 2) {
    const hasArmed = spawns.some((enemyTypeId) => enemyDefinitions[enemyTypeId]?.combatModel?.isArmed);
    if (!hasArmed) {
      const armedPool = getArmedPoolForWave(waveNumber);
      if (armedPool.length > 0) {
        const replaceIndex = Math.floor(random() * spawns.length);
        spawns[replaceIndex] = pick(armedPool, random);
      }
    }
  }

  return {
    id: `wave-${waveNumber}`,
    count,
    interval,
    spawns,
    tags: {
      allowsMedium: waveNumber >= W.tierUnlocks[2],
      allowsHeavy: waveNumber >= W.tierUnlocks[3],
    },
  };
}

export const defaultWaveSetDefinition = {
  id: 'default-waves',
  waves: Array.from({ length: W.totalWaves }, (_, index) => createWave(index)),
};
