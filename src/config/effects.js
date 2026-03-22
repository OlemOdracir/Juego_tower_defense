export const EFFECTS_CONFIG = {
  projectile: {
    sphere: { radius: 0.024, segments: 6, color: 0xffee44 },
    trail: {
      topRadius: 0.008,
      bottomRadius: 0.003,
      height: 0.08,
      color: 0xffaa22,
      opacity: 0.5,
      zOffset: -0.04,
    },
  },

  muzzleFlash: {
    forwardOffset: 0.018,
    radius: 0.02,
    segments: 4,
    color: 0xffffaa,
    lifetime: 0.035,
  },

  hitSpark: {
    radius: 0.028,
    segments: 6,
    color: 0xffdd77,
    opacity: 0.82,
    lifetime: 0.08,
    growthRate: 18,
  },

  explosion: {
    blast: {
      radius: 0.12,
      segments: 10,
      color: 0xffaa33,
      opacity: 0.9,
      yOffset: 0.08,
      lifetime: 0.16,
      growthRate: 10,
    },
    smoke: {
      radius: 0.09,
      segments: 8,
      color: 0x4b5563,
      opacity: 0.65,
      lifetime: 0.45,
      growthRate: 2.6,
      opacityMultiplier: 0.55,
      upwardSpeed: 0.16,
    },
  },

  debris: {
    sizeMin: 0.015,
    sizeRange: 0.02,
    lifetimeMin: 0.25,
    lifetimeRange: 0.15,
    velocity: { horizontal: 3, verticalMin: 1.5, verticalRange: 3 },
    gravity: 12,
    opacityLifetime: 0.35,
  },
};
