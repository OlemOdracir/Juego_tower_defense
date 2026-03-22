export const AUDIO_CONFIG = {
  levels: {
    mg7Shot: 0.5,
    scoutEngine: 0.5,
    vehicleExplosion: 0.5,
  },

  defaults: {
    playVolume: 0.45,
    loopVolume: 0.2,
    rampMs: 120,
    fadeOutMs: 120,
    stopDelay: 0.02,
  },

  scoutEngine: {
    playbackRate: 0.98,
    fadeOutMs: 180,
  },

  mg7Shot: {
    playbackRateMin: 0.99,
    playbackRateRange: 0.04,
    cooldownMs: 0,
  },

  vehicleExplosion: {
    playbackRateMin: 0.95,
    playbackRateRange: 0.08,
    cooldownMs: 40,
  },
};
