import { MUNITION_CLASSES } from '../enemies/vehicle-combat.js';

export const mg7TowerDefinition = {
  id: 'mg7-vulcan',
  displayName: 'MG-7 VULCAN',
  targeting: {
    default: 'nearest',
  },
  economy: {
    baseCost: 50,
    sellRatio: 0.6,
  },
  combatModel: {
    damageType: MUNITION_CLASSES.lightBallistic,
    projectileSpeed: 14,
    projectileSizeBase: 0.02,
    projectileSizePerLevel: 0.004,
    hitThreshold: 0.12,
    muzzleHeightBase: 0.3,
    muzzleHeightPerLevel: 0.025,
    muzzleForwardBase: 0.38,
    muzzleForwardPerLevel: 0.06,
    pitchLimits: {
      min: -0.72,
      max: 0.5,
    },
  },
  visualModel: {
    renderer: 'mg7-ciws',
    accentColor: '#378ADD',
    assetPreview: {
      levelGlbs: [
        'assets/models/turrets/mg7_modular/mg7_lvl1.glb',
        'assets/models/turrets/mg7_modular/mg7_lvl2.glb',
        'assets/models/turrets/mg7_modular/mg7_lvl3.glb',
        'assets/models/turrets/mg7_modular/mg7_lvl4.glb',
        'assets/models/turrets/mg7_modular/mg7_lvl5.glb',
      ],
      nodeMap: {
        turretYaw: 'turret_yaw',
        gunPitch: 'gun_pitch',
        muzzlePrefix: 'muzzle_',
      },
    },
  },
  panelModel: {
    maxStats: {
      damage: 28,
      rate: 13,
      range: 4.3,
      scale: 1.6,
      armor: 12,
      hp: 360,
    },
  },
  defenseLevels: [
    {
      label: 'Blindaje Ligero',
      armorClass: 'light',
      maxHp: 180,
      armor: 3,
      upgradeCost: 140,
    },
    {
      label: 'Blindaje Medio',
      armorClass: 'medium',
      maxHp: 260,
      armor: 7,
      upgradeCost: 220,
    },
    {
      label: 'Blindaje Pesado',
      armorClass: 'heavy',
      maxHp: 360,
      armor: 12,
      upgradeCost: null,
    },
  ],
  levels: [
    { label: 'Canon Simple', damage: 5, rate: 2.5, range: 3.2, scale: 1, upgradeCost: 50 },
    { label: 'Canon Doble', damage: 8, rate: 3.5, range: 3.4, scale: 1.15, upgradeCost: 100 },
    { label: 'Triple Canon', damage: 12, rate: 5, range: 3.6, scale: 1.3, upgradeCost: 200 },
    { label: 'Quad Canon', damage: 18, rate: 7.5, range: 3.9, scale: 1.45, upgradeCost: 400 },
    { label: 'Gatling', damage: 28, rate: 13, range: 4.3, scale: 1.6, upgradeCost: null },
  ],
};
