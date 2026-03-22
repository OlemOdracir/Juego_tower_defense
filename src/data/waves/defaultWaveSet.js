import { vehiclePoolsByTier } from '../enemies/vehicleCatalog.js';
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

function createWave(index) {
  const waveNumber = index + 1;
  const random = createSeededRandom(W.seedBase + waveNumber * W.seedMultiplier);
  const count = W.count.base + index * W.count.perWave + (index > W.count.bonusAfterWave ? W.count.bonus : 0);
  const interval = Math.max(W.interval.min, W.interval.base - index * W.interval.decayPerWave);

  let pool = [...vehiclePoolsByTier[1]];
  if (waveNumber >= W.tierUnlocks[2]) {
    pool = pool.concat(vehiclePoolsByTier[2]);
  }
  if (waveNumber >= W.tierUnlocks[3]) {
    pool = pool.concat(vehiclePoolsByTier[3]);
  }

  const TP = W.tierProbabilities;
  const spawns = [];
  for (let spawnIndex = 0; spawnIndex < count; spawnIndex += 1) {
    let allowedPool = pool;
    if (waveNumber <= TP.earlyMaxWave) {
      allowedPool = vehiclePoolsByTier[1];
    } else if (waveNumber <= TP.midMaxWave) {
      allowedPool = random() > TP.tier2Early ? vehiclePoolsByTier[2] : vehiclePoolsByTier[1];
    } else if (waveNumber < TP.lateMinWave) {
      allowedPool = random() > TP.tier2Mid ? vehiclePoolsByTier[2] : vehiclePoolsByTier[1].concat(vehiclePoolsByTier[2]);
    } else {
      const roll = random();
      if (roll > TP.tier3Late) allowedPool = vehiclePoolsByTier[3];
      else if (roll > TP.tier2Late) allowedPool = vehiclePoolsByTier[2];
      else allowedPool = vehiclePoolsByTier[1].concat(vehiclePoolsByTier[2]);
    }
    spawns.push(pick(allowedPool, random));
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
