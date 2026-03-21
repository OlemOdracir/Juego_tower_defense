import { ICONS } from '../../../data/ui/icons.js';

function makeStatCard(icon, title, titleClass, bgClass, borderClass, value, max, barColor, next) {
  const parsedValue = typeof value === 'number' ? value : parseFloat(value);
  const numericValue = Number.isFinite(parsedValue) ? parsedValue : 0;
  const pct = Math.max(0, Math.min(100, Math.round((numericValue / max) * 100)));
  const nextHtml = next
    ? `<div class="stat-next"><span class="stat-next-icon">${ICONS.arrowUpSmall}</span><span class="stat-next-label">Proximo:</span><b>${next}</b></div>`
    : '';

  return `<div class="stat-card ${borderClass}">
    <div class="stat-icon ${bgClass}">${icon}</div>
    <div class="stat-body">
      <div class="stat-title ${titleClass}">${title}</div>
      <div class="stat-current"><span>Actual:</span><b>${value}</b></div>
      <div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
      ${nextHtml}
    </div>
  </div>`;
}

export class TowerPanelPresenter {
  constructor(doc, preview) {
    this.panelEl = doc.getElementById('panel');
    this.previewEl = doc.getElementById('preview-3d');
    this.statsEl = doc.getElementById('stats-section');
    this.actionsEl = doc.getElementById('actions-section');
    this.preview = preview;
    this.renderEmptyState();
  }

  render(state) {
    const tower = state.towers.find((item) => item.id === state.selectedTowerId);
    if (!tower) {
      this.renderEmptyState();
      return;
    }

    const definition = state.config.towerDefinitions[tower.towerTypeId];
    const stats = definition.levels[tower.level];
    const next = tower.level < definition.levels.length - 1 ? definition.levels[tower.level + 1] : null;

    this.panelEl.classList.remove('panel-empty');
    this.previewEl.style.display = '';
    this.statsEl.style.display = '';
    this.actionsEl.style.display = '';
    this.preview.setTower(definition, tower.level);

    this.statsEl.innerHTML = `<div class="tower-header">
      <div class="tower-heading">
        <div class="tower-name">${definition.displayName}</div>
        <div class="tower-subtitle">Nivel Actual: ${tower.level + 1} - ${stats.label}</div>
      </div>
      <div class="tower-kills">${ICONS.kill}<span>${tower.kills}</span></div>
    </div>
    <div class="stat-grid">
      ${makeStatCard(ICONS.damage, 'DANO', 'text-red', 'bg-red', 'border-red', stats.damage, definition.panelModel.maxStats.damage, '#D96C7E', next ? next.damage : null)}
      ${makeStatCard(ICONS.rate, 'CADENCIA', 'text-yellow', 'bg-yellow', 'border-yellow', `${stats.rate}/s`, definition.panelModel.maxStats.rate, '#D8BD52', next ? `${next.rate}/s` : null)}
      ${makeStatCard(ICONS.range, 'RANGO', 'text-blue', 'bg-blue', 'border-blue', `${stats.range}u`, definition.panelModel.maxStats.range, '#6A97E2', next ? `${next.range}u` : null)}
      ${makeStatCard(ICONS.scale, 'ESCALA', 'text-green', 'bg-green', 'border-green', `${Math.round(stats.scale * 100)}%`, definition.panelModel.maxStats.scale * 100, '#67D46A', next ? `${Math.round(next.scale * 100)}%` : null)}
    </div>`;

    let actionsHtml = '';
    if (stats.upgradeCost != null) {
      const canUpgrade = state.credits >= stats.upgradeCost;
      actionsHtml += `<button class="btn-upgrade" onclick="window.doUpgrade()" ${canUpgrade ? '' : 'disabled'}>
        ${ICONS.arrowUp}
        <span class="btn-label">MEJORAR</span>
        <span class="btn-price">$${stats.upgradeCost}</span>
      </button>`;
    } else {
      actionsHtml += `<button class="btn-maxlevel">
        ${ICONS.star}
        <span class="btn-label">GATLING</span>
        <span class="btn-price">MAX</span>
      </button>`;
    }

    actionsHtml += `<button class="btn-sell" onclick="window.askSell()">
      ${ICONS.coins}
      <span class="btn-label">VENDER</span>
      <span class="btn-price">$${Math.floor(tower.invested * definition.economy.sellRatio)}</span>
    </button>`;
    this.actionsEl.innerHTML = actionsHtml;
  }

  renderEmptyState() {
    this.panelEl.classList.add('panel-empty');
    this.previewEl.style.display = '';
    this.statsEl.style.display = '';
    this.actionsEl.style.display = '';
    this.preview.clear();

    this.statsEl.innerHTML = `<div class="tower-header tower-header-empty">
      <div class="tower-heading">
        <div class="tower-name">DETALLE DE UNIDAD</div>
        <div class="tower-subtitle">Selecciona una torre para inspeccionarla y ver sus mejoras.</div>
      </div>
      <div class="tower-kills tower-kills-empty">${ICONS.kill}<span>0</span></div>
    </div>
    <div class="stat-grid">
      ${makeStatCard(ICONS.damage, 'DANO', 'text-red', 'bg-red', 'border-red', '---', 100, '#D96C7E', null)}
      ${makeStatCard(ICONS.rate, 'CADENCIA', 'text-yellow', 'bg-yellow', 'border-yellow', '---', 100, '#D8BD52', null)}
      ${makeStatCard(ICONS.range, 'RANGO', 'text-blue', 'bg-blue', 'border-blue', '---', 100, '#6A97E2', null)}
      ${makeStatCard(ICONS.scale, 'ESCALA', 'text-green', 'bg-green', 'border-green', '---', 100, '#67D46A', null)}
    </div>`;

    this.actionsEl.innerHTML = `<button class="btn-upgrade" disabled>
      ${ICONS.arrowUp}
      <span class="btn-label">MEJORAR</span>
      <span class="btn-price">---</span>
    </button>
    <button class="btn-sell btn-sell-disabled" disabled>
      ${ICONS.coins}
      <span class="btn-label">VENDER</span>
      <span class="btn-price">---</span>
    </button>`;
  }
}
