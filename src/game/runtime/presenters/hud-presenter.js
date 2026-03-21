export class HudPresenter {
  constructor(doc = document) {
    this.doc = doc;
    this.creditsEl = doc.getElementById('credits');
    this.waveEl = doc.getElementById('wave');
    this.enemyCountEl = doc.getElementById('enemy-count');
    this.lifeFillEl = doc.getElementById('life-bar-fill');
    this.waveButtonEl = doc.getElementById('wave-btn');
    this.overlayEl = doc.getElementById('overlay');
    this.overlayTitleEl = doc.getElementById('overlay-title');
    this.overlayTextEl = doc.getElementById('overlay-text');
    this.tipEl = doc.getElementById('tip');
  }

  render(state) {
    this.creditsEl.textContent = state.credits;
    this.waveEl.textContent = state.wave;
    this.enemyCountEl.textContent = state.enemies.length;

    const ratio = Math.max(0, state.lives / state.config.mapDefinition.maxLives);
    this.lifeFillEl.style.width = `${ratio * 100}%`;
    this.lifeFillEl.style.background = ratio > 0.5 ? '#22C55E' : ratio > 0.25 ? '#EAB308' : '#EF4444';

    if (state.waveActive) {
      this.waveButtonEl.disabled = true;
      this.waveButtonEl.textContent = `Oleada ${state.wave}...`;
      this.waveButtonEl.classList.add('wave-active');
    } else if (state.wave >= state.config.waveSet.waves.length) {
      this.waveButtonEl.disabled = true;
      this.waveButtonEl.textContent = 'Victoria';
      this.waveButtonEl.classList.remove('wave-active');
    } else {
      this.waveButtonEl.disabled = false;
      this.waveButtonEl.textContent = `▶ Oleada ${state.wave + 1}`;
      this.waveButtonEl.classList.remove('wave-active');
    }

    if (this.tipEl) {
      this.tipEl.textContent = state.waveActive
        ? 'Oleada activa · Destruye los vehículos antes de que lleguen a la base'
        : 'Click = colocar · Click torre = inspeccionar · Scroll = zoom · Derecho = rotar';
    }

    if (state.overlay.visible) {
      this.overlayEl.classList.add('show');
      this.overlayTitleEl.textContent = state.overlay.title;
      this.overlayTitleEl.style.color = state.overlay.color;
      this.overlayTextEl.textContent = state.overlay.text;
    } else {
      this.overlayEl.classList.remove('show');
    }

    state.uiDirty = false;
  }
}
