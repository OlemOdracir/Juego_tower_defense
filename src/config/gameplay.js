export const GAMEPLAY_CONFIG = {
  worldScaleDefault: 10,

  simulation: {
    maxDeltaTime: 0.05,
    enemyRotationLerp: 8,
    defaultAimPitch: 0.08,
    defaultPitchLimits: { min: -0.72, max: 0.5 },
    initialSpawnDelay: 0.4,
    finalEnemySpacing: 0.5,
  },

  effects: {
    hit: { color: 0xffcc22, count: 3 },
    kill: { color: 0xff4400, count: 6 },
  },

  overlays: {
    gameOver: { title: 'Game Over', color: '#EF4444' },
    victory: { title: '¡Victoria!', color: '#22C55E' },
    defaultColor: '#F8FAFC',
  },

  waves: {
    totalWaves: 10,
    seedBase: 1337,
    seedMultiplier: 97,
    count: { base: 5, perWave: 3, bonusAfterWave: 6, bonus: 2 },
    interval: { base: 1.18, decayPerWave: 0.08, min: 0.42 },
    tierUnlocks: { 2: 4, 3: 8 },
    tierProbabilities: {
      earlyMaxWave: 3,
      midMaxWave: 6,
      lateMinWave: 9,
      tier2Early: 0.72,
      tier2Mid: 0.68,
      tier3Late: 0.82,
      tier2Late: 0.44,
    },
    armedChanceByWave: {
      wave2to3: { tier1: 0.28, tier2: 0, tier3: 0 },
      wave4to6: { tier1: 0.42, tier2: 0.36, tier3: 0 },
      wave7to8: { tier1: 0.5, tier2: 0.62, tier3: 0 },
      wave9plus: { tier1: 0.56, tier2: 0.76, tier3: 0.55 },
    },
  },

  combat: {
    towerDamagedThreshold: 0.58,
    towerDestroyedVfxHpFloor: 0,
  },

  ui: {
    dragThreshold: 2,
  },
};
