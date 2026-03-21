import * as THREE from 'three';
import { MAT, mk } from './materials.js';

export class MapRenderer {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    this.cells = [];
    this.hoveredCell = null;
    this.rangeIndicator = mk(
      new THREE.RingGeometry(0, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0x66ff66, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
    );
    this.rangeIndicator.rotation.x = -Math.PI / 2;
    this.rangeIndicator.position.y = 0.05;
    this.rangeIndicator.visible = false;
  }

  build() {
    const { width, height, pathPoints, visualModel } = this.config.mapDefinition;
    const baseGrid = this.config.baseGrid;

    const ground = mk(new THREE.BoxGeometry(width + 6, 0.12, height + 6), MAT.grass);
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const subGround = mk(new THREE.BoxGeometry(width + 8, 0.3, height + 8), new THREE.MeshStandardMaterial({ color: 0x3d6630 }));
    subGround.position.y = -0.25;
    this.scene.add(subGround);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isPath = baseGrid[y][x] === 1;
        const material = isPath ? MAT.road.clone() : MAT.grass.clone();
        if (!isPath) {
          const variance = 0.9 + Math.random() * 0.2;
          material.color.setRGB(0.29 * variance, 0.48 * variance, 0.23 * variance);
        }
        const tileHeight = isPath ? 0.08 : 0.04;
        const tile = mk(new THREE.BoxGeometry(0.96, tileHeight, 0.96), material);
        tile.position.set(x - this.config.halfWidth + 0.5, tileHeight / 2, y - this.config.halfHeight + 0.5);
        tile.receiveShadow = true;
        tile.userData = { gx: x, gy: y, baseMaterial: material };
        this.scene.add(tile);
        this.cells.push(tile);

        if (isPath) {
          const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
          for (const [dx, dy] of neighbors) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height || baseGrid[ny][nx] !== 1) {
              const curb = mk(new THREE.BoxGeometry(dx ? 0.06 : 0.96, 0.1, dy ? 0.06 : 0.96), MAT.roadEdge);
              curb.position.set(x - this.config.halfWidth + 0.5 + dx * 0.48, 0.06, y - this.config.halfHeight + 0.5 + dy * 0.48);
              curb.receiveShadow = true;
              this.scene.add(curb);
            }
          }
        }
      }
    }

    for (let index = 0; index < pathPoints.length - 1; index++) {
      const dx = Math.sign(pathPoints[index + 1][0] - pathPoints[index][0]);
      const dy = Math.sign(pathPoints[index + 1][1] - pathPoints[index][1]);
      let xx = pathPoints[index][0];
      let yy = pathPoints[index][1];
      let count = 0;
      while (xx !== pathPoints[index + 1][0] || yy !== pathPoints[index + 1][1]) {
        if (count % 2 === 0) {
          const dash = mk(new THREE.BoxGeometry(dx ? 0.3 : 0.06, 0.01, dy ? 0.3 : 0.06), MAT.roadLine);
          dash.position.set(xx - this.config.halfWidth + 0.5, 0.085, yy - this.config.halfHeight + 0.5);
          this.scene.add(dash);
        }
        xx += dx;
        yy += dy;
        count += 1;
      }
    }

    for (let index = 0; index < visualModel.rockCount; index++) {
      const rx = Math.random() * width - this.config.halfWidth;
      const rz = Math.random() * height - this.config.halfHeight;
      const gx = Math.floor(rx + this.config.halfWidth);
      const gy = Math.floor(rz + this.config.halfHeight);
      if (gx >= 0 && gx < width && gy >= 0 && gy < height && baseGrid[gy][gx] === 0) {
        const size = 0.07 + Math.random() * 0.1;
        const rock = mk(new THREE.DodecahedronGeometry(size, 0), MAT.rock);
        rock.position.set(rx + 0.5, size / 2, rz + 0.5);
        rock.rotation.set(Math.random() * 2, Math.random() * 3, 0);
        rock.castShadow = true;
        this.scene.add(rock);
      }
    }

    const spawnPoint = pathPoints[0];
    this.spawnMarker = mk(new THREE.CylinderGeometry(0.3, 0.35, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0xaa3333 }));
    this.spawnMarker.position.set(spawnPoint[0] - this.config.halfWidth + 0.5, 0.06, spawnPoint[1] - this.config.halfHeight + 0.5);
    this.scene.add(this.spawnMarker);

    const basePoint = pathPoints[pathPoints.length - 1];
    this.baseMarker = mk(new THREE.CylinderGeometry(0.3, 0.35, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x2a7a2a }));
    this.baseMarker.position.set(basePoint[0] - this.config.halfWidth + 0.5, 0.06, basePoint[1] - this.config.halfHeight + 0.5);
    this.scene.add(this.baseMarker);

    const baseBuilding = mk(new THREE.BoxGeometry(0.3, 0.25, 0.3), new THREE.MeshStandardMaterial({ color: 0x556655 }));
    baseBuilding.position.set(basePoint[0] - this.config.halfWidth + 0.5, 0.25, basePoint[1] - this.config.halfHeight + 0.5);
    baseBuilding.castShadow = true;
    this.scene.add(baseBuilding);
    this.scene.add(this.rangeIndicator);
  }

  updateAnimatedMarkers(elapsedTime) {
    this.spawnMarker.rotation.y = elapsedTime * 1.5;
    this.baseMarker.rotation.y = -elapsedTime * 1.5;
  }

  restoreCell(gx, gy) {
    const cell = this.cells[gy * this.config.mapDefinition.width + gx];
    if (cell) cell.material = cell.userData.baseMaterial;
  }

  updateHover(state, hoveredCell, towerDefinitions) {
    if (this.hoveredCell) {
      this.restoreCell(this.hoveredCell.gx, this.hoveredCell.gy);
    }

    this.hoveredCell = hoveredCell;
    this.rangeIndicator.visible = false;
    if (!hoveredCell) return;

    const cell = this.cells[hoveredCell.gy * this.config.mapDefinition.width + hoveredCell.gx];
    const cellValue = state.grid[hoveredCell.gy][hoveredCell.gx];
    cell.material = cellValue === 0 ? MAT.hover : cellValue === 2 ? MAT.selected : MAT.invalid;

    if (cellValue === 0) {
      this.rangeIndicator.visible = true;
      this.rangeIndicator.scale.setScalar(towerDefinitions['mg7-vulcan'].levels[0].range);
      this.rangeIndicator.position.set(hoveredCell.gx - this.config.halfWidth + 0.5, 0.05, hoveredCell.gy - this.config.halfHeight + 0.5);
    } else if (cellValue === 2) {
      const tower = state.towers.find((item) => item.gx === hoveredCell.gx && item.gy === hoveredCell.gy);
      if (!tower) return;
      this.rangeIndicator.visible = true;
      this.rangeIndicator.scale.setScalar(towerDefinitions[tower.towerTypeId].levels[tower.level].range);
      this.rangeIndicator.position.set(tower.wx, 0.05, tower.wz);
    }
  }
}
