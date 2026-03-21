export class SfxPlayer {
  constructor() {
    this.context = null;
    this.buffers = new Map();
    this.pendingLoads = new Map();
    this.lastPlayTimes = new Map();
    this.activeLoops = new Map();
    this.unlockBound = false;
  }

  attachUnlockListeners(target = window) {
    if (this.unlockBound) return;
    this.unlockBound = true;
    const unlock = () => {
      this.ensureContext();
      this.context?.resume?.();
      target.removeEventListener('pointerdown', unlock);
      target.removeEventListener('keydown', unlock);
      target.removeEventListener('touchstart', unlock);
    };

    target.addEventListener('pointerdown', unlock, { passive: true });
    target.addEventListener('keydown', unlock, { passive: true });
    target.addEventListener('touchstart', unlock, { passive: true });
  }

  ensureContext() {
    if (!this.context) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      this.context = AudioContextCtor ? new AudioContextCtor() : null;
    }
    return this.context;
  }

  async load(id, url) {
    if (this.buffers.has(id)) return this.buffers.get(id);
    if (this.pendingLoads.has(id)) return this.pendingLoads.get(id);

    const loadPromise = (async () => {
      const context = this.ensureContext();
      if (!context) return null;

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
      this.buffers.set(id, audioBuffer);
      this.pendingLoads.delete(id);
      return audioBuffer;
    })();

    this.pendingLoads.set(id, loadPromise);
    return loadPromise;
  }

  play(id, options = {}) {
    const context = this.ensureContext();
    const buffer = this.buffers.get(id);
    if (!context || !buffer) return false;
    if (context.state === 'suspended') {
      context.resume?.();
    }

    const nowMs = performance.now();
    const cooldownMs = options.cooldownMs ?? 0;
    const lastPlay = this.lastPlayTimes.get(id) ?? 0;
    if (nowMs - lastPlay < cooldownMs) return false;
    this.lastPlayTimes.set(id, nowMs);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options.playbackRate ?? 1;

    const gainNode = context.createGain();
    gainNode.gain.value = options.volume ?? 0.45;

    source.connect(gainNode);
    gainNode.connect(context.destination);
    source.start();
    return true;
  }

  playLoop(id, options = {}) {
    const context = this.ensureContext();
    const buffer = this.buffers.get(id);
    if (!context || !buffer) return false;
    if (context.state === 'suspended') {
      context.resume?.();
    }
    if (this.activeLoops.has(id)) return true;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = options.playbackRate ?? 1;

    const gainNode = context.createGain();
    gainNode.gain.value = options.volume ?? 0.2;

    source.connect(gainNode);
    gainNode.connect(context.destination);
    source.start();
    this.activeLoops.set(id, { source, gainNode });
    return true;
  }

  setLoopVolume(id, volume, rampMs = 120) {
    const context = this.ensureContext();
    const activeLoop = this.activeLoops.get(id);
    if (!context || !activeLoop) return false;

    const now = context.currentTime;
    activeLoop.gainNode.gain.cancelScheduledValues(now);
    activeLoop.gainNode.gain.setValueAtTime(activeLoop.gainNode.gain.value, now);
    activeLoop.gainNode.gain.linearRampToValueAtTime(volume, now + rampMs / 1000);
    return true;
  }

  stopLoop(id, fadeOutMs = 120) {
    const context = this.ensureContext();
    const activeLoop = this.activeLoops.get(id);
    if (!context || !activeLoop) return false;

    const now = context.currentTime;
    activeLoop.gainNode.gain.cancelScheduledValues(now);
    activeLoop.gainNode.gain.setValueAtTime(activeLoop.gainNode.gain.value, now);
    activeLoop.gainNode.gain.linearRampToValueAtTime(0.0001, now + fadeOutMs / 1000);
    activeLoop.source.stop(now + fadeOutMs / 1000 + 0.02);
    activeLoop.source.onended = () => {
      activeLoop.source.disconnect();
      activeLoop.gainNode.disconnect();
      this.activeLoops.delete(id);
    };
    return true;
  }
}
