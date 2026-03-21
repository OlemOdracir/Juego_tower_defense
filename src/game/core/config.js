import { enemyDefinitions } from '../../data/enemies/index.js';
import { mapDefinitions } from '../../data/maps/index.js';
import { towerDefinitions } from '../../data/towers/index.js';
import { waveSetDefinitions } from '../../data/waves/index.js';

function buildBaseGrid(mapDefinition) {
  const grid = Array.from({ length: mapDefinition.height }, () => Array(mapDefinition.width).fill(0));
  const { pathPoints } = mapDefinition;

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const [x0, y0] = pathPoints[i];
    const [x1, y1] = pathPoints[i + 1];
    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);
    let cx = x0;
    let cy = y0;

    while (cx !== x1 || cy !== y1) {
      grid[cy][cx] = 1;
      cx += dx;
      cy += dy;
    }
    grid[y1][x1] = 1;
  }

  return grid;
}

function buildPathWorld(mapDefinition) {
  const halfWidth = mapDefinition.width / 2;
  const halfHeight = mapDefinition.height / 2;

  return mapDefinition.pathPoints.map(([gx, gy]) => ({
    x: gx - halfWidth + 0.5,
    y: 0.01,
    z: gy - halfHeight + 0.5,
  }));
}

export function createGameConfig({
  mapId = 'default-map',
  waveSetId = 'default-waves',
} = {}) {
  const mapDefinition = mapDefinitions[mapId];
  const waveSet = waveSetDefinitions[waveSetId];

  if (!mapDefinition) {
    throw new Error(`Unknown map definition: ${mapId}`);
  }

  if (!waveSet) {
    throw new Error(`Unknown wave set: ${waveSetId}`);
  }

  return {
    mapId,
    waveSetId,
    mapDefinition,
    waveSet,
    towerDefinitions,
    enemyDefinitions,
    baseGrid: buildBaseGrid(mapDefinition),
    pathWorld: buildPathWorld(mapDefinition),
    halfWidth: mapDefinition.width / 2,
    halfHeight: mapDefinition.height / 2,
  };
}
