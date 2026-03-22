import { enemyDefinitions } from '../../data/enemies/index.js';
import { mapDefinitions } from '../../data/maps/index.js';
import { towerDefinitions } from '../../data/towers/index.js';
import { waveSetDefinitions } from '../../data/waves/index.js';
import { gridToWorld } from './coordinates.js';
import { GAMEPLAY_CONFIG } from '../../config/gameplay.js';

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

function buildPathWorld(mapDefinition, worldScale, pathSurfaceY) {
  const halfWidth = mapDefinition.width / 2;
  const halfHeight = mapDefinition.height / 2;

  return mapDefinition.pathPoints.map(([gx, gy]) => {
    const world = gridToWorld(gx, gy, worldScale, halfWidth, halfHeight);
    return {
      x: world.x,
      y: pathSurfaceY,
      z: world.z,
    };
  });
}

export function createGameConfig({
  mapId = 'default-map',
  waveSetId = 'default-waves',
  worldScale = GAMEPLAY_CONFIG.worldScaleDefault,
} = {}) {
  const mapDefinition = mapDefinitions[mapId];
  const waveSet = waveSetDefinitions[waveSetId];

  if (!mapDefinition) {
    throw new Error(`Unknown map definition: ${mapId}`);
  }

  if (!waveSet) {
    throw new Error(`Unknown wave set: ${waveSetId}`);
  }

  const groundTileHeightWorld = (mapDefinition.visualModel?.groundTileHeight ?? 0.04) * worldScale;
  const pathTileHeightWorld = (mapDefinition.visualModel?.pathTileHeight ?? 0.08) * worldScale;
  const pathSurfaceY = pathTileHeightWorld;

  return {
    mapId,
    waveSetId,
    mapDefinition,
    waveSet,
    towerDefinitions,
    enemyDefinitions,
    worldScale,
    groundTileHeightWorld,
    pathTileHeightWorld,
    pathSurfaceY,
    baseGrid: buildBaseGrid(mapDefinition),
    pathWorld: buildPathWorld(mapDefinition, worldScale, pathSurfaceY),
    halfWidth: mapDefinition.width / 2,
    halfHeight: mapDefinition.height / 2,
  };
}
