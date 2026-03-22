import { MUNITION_CLASSES } from './vehicle-combat.js';

const SHARED_HUMVEE_VISUAL = {
  renderer: 'asset-vehicle',
  assetPath: 'assets/models/vehicles/humvee_basic_v2.glb',
  assetRotation: {
    x: Math.PI / 2,
    y: Math.PI,
    z: 0,
  },
  headingOffset: Math.PI,
  assetNodeMap: null,
};

function createVehicleDefinition({
  id,
  displayName,
  armorClass,
  hp,
  armor,
  speed,
  reward,
  threatTier,
  damageType,
  role,
  assetScale = 1,
}) {
  return {
    id,
    displayName,
    armorClass,
    stats: {
      hp,
      armor,
      speed,
      reward,
    },
    tags: {
      threatTier,
      role,
    },
    combatModel: {
      damageType,
    },
    visualModel: {
      ...SHARED_HUMVEE_VISUAL,
      assetScale,
    },
  };
}

export const vehicleEnemyDefinitions = {
  'scout-buggy': createVehicleDefinition({
    id: 'scout-buggy',
    displayName: 'Scout Buggy',
    armorClass: 'light',
    hp: 42,
    armor: 2,
    speed: 2,
    reward: 12,
    threatTier: 1,
    damageType: MUNITION_CLASSES.lightBallistic,
    role: 'recon',
    assetScale: 0.94,
  }),
  'humvee-gunner': createVehicleDefinition({
    id: 'humvee-gunner',
    displayName: 'Humvee Gunner',
    armorClass: 'light',
    hp: 56,
    armor: 3,
    speed: 1.78,
    reward: 16,
    threatTier: 1,
    damageType: MUNITION_CLASSES.lightBallistic,
    role: 'gunner',
    assetScale: 1,
  }),
  'missile-truck': createVehicleDefinition({
    id: 'missile-truck',
    displayName: 'Missile Truck',
    armorClass: 'light',
    hp: 56,
    armor: 3,
    speed: 1.62,
    reward: 26,
    threatTier: 2,
    damageType: MUNITION_CLASSES.shapedCharge,
    role: 'missile',
    assetScale: 1.02,
  }),
  'apc-autocannon': createVehicleDefinition({
    id: 'apc-autocannon',
    displayName: 'APC Autocannon',
    armorClass: 'medium',
    hp: 116,
    armor: 7,
    speed: 0.85,
    reward: 28,
    threatTier: 2,
    damageType: MUNITION_CLASSES.heavyBallistic,
    role: 'apc',
    assetScale: 1.08,
  }),
  'ifv-missile': createVehicleDefinition({
    id: 'ifv-missile',
    displayName: 'IFV Missile',
    armorClass: 'medium',
    hp: 116,
    armor: 7,
    speed: 0.78,
    reward: 34,
    threatTier: 2,
    damageType: MUNITION_CLASSES.shapedCharge,
    role: 'ifv',
    assetScale: 1.1,
  }),
  'siege-tank': createVehicleDefinition({
    id: 'siege-tank',
    displayName: 'Siege Tank',
    armorClass: 'heavy',
    hp: 213,
    armor: 14,
    speed: 0.31,
    reward: 48,
    threatTier: 3,
    damageType: MUNITION_CLASSES.piercing,
    role: 'heavy',
    assetScale: 1.18,
  }),
};

export const vehiclePoolsByTier = {
  1: ['scout-buggy', 'humvee-gunner'],
  2: ['missile-truck', 'apc-autocannon', 'ifv-missile'],
  3: ['siege-tank'],
};
