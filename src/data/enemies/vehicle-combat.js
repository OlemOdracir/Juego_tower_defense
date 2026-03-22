export const ARMOR_CLASSES = {
  light: {
    id: 'light',
    label: 'Ligera',
    speedModifier: 1,
  },
  medium: {
    id: 'medium',
    label: 'Media',
    speedModifier: 0.84,
  },
  heavy: {
    id: 'heavy',
    label: 'Pesada',
    speedModifier: 0.64,
  },
};

export const MUNITION_CLASSES = {
  lightBallistic: 'light-ballistic',
  areaIncendiary: 'area-incendiary',
  heavyBallistic: 'heavy-ballistic',
  piercing: 'piercing',
  shapedCharge: 'shaped-charge',
};

export const DAMAGE_MATRIX = {
  [MUNITION_CLASSES.lightBallistic]: { light: 1, medium: 0.75, heavy: 0.5 },
  [MUNITION_CLASSES.areaIncendiary]: { light: 1, medium: 0.75, heavy: 0 },
  [MUNITION_CLASSES.heavyBallistic]: { light: 1, medium: 1, heavy: 1 },
  [MUNITION_CLASSES.piercing]: { light: 1, medium: 1.25, heavy: 1.5 },
  [MUNITION_CLASSES.shapedCharge]: { light: 1, medium: 1.25, heavy: 1.5 },
};
