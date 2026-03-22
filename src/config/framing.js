export const FRAMING_CONFIG = {
  initialSize: 8.6,
  initialAngle: Math.PI / 4,
  elevation: Math.atan(1 / Math.sqrt(2)),
  distance: 40,
  farPlane: 200,
  lookAtXOffset: 0,
  lookAtZOffset: 0,
  maxPixelRatio: 2,
  fitPadding: 1.02,
  fitPlayablePadding: 1.45,
  initialZoomRatio: 0,

  rotation: {
    sensitivity: 0.006,
  },

  zoom: {
    minRatio: 0.78,
    maxRatio: 1,
    defaultRatio: 0.95,
    sensitivity: 0.00028,
  },

  centering: {
    screenXRatio: 0.5,
    screenYRatio: 0.5,
    tolerancePx: 0.5,
  },

  lighting: {
    ambient: { color: 0x99aabb, intensity: 0.45 },
    sun: {
      color: 0xfff0d0,
      intensity: 0.9,
      position: [10, 18, 8],
      shadowBounds: 14,
      shadowMapSize: 1024,
    },
    fill: {
      color: 0xaaccff,
      intensity: 0.25,
      position: [-8, 10, -6],
    },
  },
};
