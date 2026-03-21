import * as THREE from 'three';
import { MAT, mk } from './materials.js';

function buildMg7Mesh(definition, level) {
  const stats = definition.levels[level];
  const s = 0.66 * stats.scale;
  const group = new THREE.Group();

  const baseSkirt = mk(new THREE.CylinderGeometry(0.29 * s, 0.24 * s, 0.17 * s, 8), MAT.turretMetalDark);
  baseSkirt.position.y = 0.085 * s;
  baseSkirt.castShadow = true;
  group.add(baseSkirt);

  const baseRing = mk(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 0.025 * s, 20), MAT.gunMetalMid);
  baseRing.position.y = 0.008 * s;
  baseRing.castShadow = true;
  group.add(baseRing);

  const baseMid = mk(new THREE.CylinderGeometry(0.23 * s, 0.245 * s, 0.065 * s, 12), MAT.turretMetal);
  baseMid.position.y = 0.18 * s;
  baseMid.castShadow = true;
  group.add(baseMid);

  const deck = mk(new THREE.BoxGeometry(0.36 * s, 0.035 * s, 0.34 * s), MAT.gunMetalMid);
  deck.position.y = 0.215 * s;
  deck.castShadow = true;
  group.add(deck);

  const turret = new THREE.Group();
  turret.position.y = 0.23 * s;

  const lowerBlock = mk(new THREE.BoxGeometry(0.31 * s, 0.09 * s, 0.29 * s), MAT.turretMetalDark);
  lowerBlock.position.y = 0.02 * s;
  lowerBlock.castShadow = true;
  turret.add(lowerBlock);

  const upperBlock = mk(new THREE.BoxGeometry(0.255 * s, 0.19 * s, 0.25 * s), MAT.turretMetal);
  upperBlock.position.y = 0.14 * s;
  upperBlock.castShadow = true;
  turret.add(upperBlock);

  const roofCap = mk(new THREE.BoxGeometry(0.23 * s, 0.02 * s, 0.22 * s), MAT.turretMetalEdge);
  roofCap.position.y = 0.245 * s;
  roofCap.castShadow = true;
  turret.add(roofCap);

  const frontCheekLeft = mk(new THREE.BoxGeometry(0.05 * s, 0.11 * s, 0.055 * s), MAT.turretMetalEdge);
  frontCheekLeft.position.set(-0.09 * s, 0.15 * s, 0.135 * s);
  frontCheekLeft.rotation.x = -0.36;
  frontCheekLeft.rotation.z = 0.18;
  frontCheekLeft.castShadow = true;
  turret.add(frontCheekLeft);

  const frontCheekRight = frontCheekLeft.clone();
  frontCheekRight.position.x = 0.09 * s;
  frontCheekRight.rotation.z = -0.18;
  turret.add(frontCheekRight);

  const roofSlopeFront = mk(new THREE.BoxGeometry(0.16 * s, 0.045 * s, 0.07 * s), MAT.turretMetalDark);
  roofSlopeFront.position.set(0, 0.205 * s, 0.11 * s);
  roofSlopeFront.rotation.x = -0.45;
  roofSlopeFront.castShadow = true;
  turret.add(roofSlopeFront);

  const backPanel = mk(new THREE.BoxGeometry(0.2 * s, 0.09 * s, 0.03 * s), MAT.turretMetalDark);
  backPanel.position.set(0, 0.12 * s, -0.13 * s);
  backPanel.castShadow = true;
  turret.add(backPanel);

  const hatchLeft = mk(new THREE.BoxGeometry(0.02 * s, 0.085 * s, 0.11 * s), MAT.turretMetalDark);
  hatchLeft.position.set(-0.13 * s, 0.1 * s, -0.01 * s);
  hatchLeft.castShadow = true;
  turret.add(hatchLeft);

  const hatchRight = hatchLeft.clone();
  hatchRight.position.x = 0.13 * s;
  turret.add(hatchRight);

  const sidePlateLeft = mk(new THREE.BoxGeometry(0.012 * s, 0.07 * s, 0.1 * s), MAT.turretMetalEdge);
  sidePlateLeft.position.set(-0.138 * s, 0.09 * s, -0.01 * s);
  sidePlateLeft.castShadow = true;
  turret.add(sidePlateLeft);

  const sidePlateRight = sidePlateLeft.clone();
  sidePlateRight.position.x = 0.138 * s;
  turret.add(sidePlateRight);

  const barrelPivot = new THREE.Group();
  barrelPivot.position.set(0, 0.125 * s, 0.11 * s);
  barrelPivot.rotation.x = -0.28;
  turret.add(barrelPivot);

  const trunnionLeft = mk(new THREE.CylinderGeometry(0.015 * s, 0.015 * s, 0.05 * s, 10), MAT.gunMetalMid);
  trunnionLeft.rotation.z = Math.PI / 2;
  trunnionLeft.position.set(-0.09 * s, 0.125 * s, 0.11 * s);
  trunnionLeft.castShadow = true;
  turret.add(trunnionLeft);

  const trunnionRight = trunnionLeft.clone();
  trunnionRight.position.x = 0.09 * s;
  turret.add(trunnionRight);

  const barrelGroup = new THREE.Group();
  const barrelData = [];
  const bRadius = 0.012 * s;

  const mantletOuter = mk(new THREE.CylinderGeometry(0.055 * s, 0.068 * s, 0.08 * s, 18), MAT.gunMetalMid);
  mantletOuter.rotation.x = Math.PI / 2;
  mantletOuter.castShadow = true;
  barrelGroup.add(mantletOuter);

  const mantletInner = mk(new THREE.CylinderGeometry(0.036 * s, 0.046 * s, 0.06 * s, 16), MAT.gunMetal);
  mantletInner.rotation.x = Math.PI / 2;
  mantletInner.position.z = 0.01 * s;
  mantletInner.castShadow = true;
  barrelGroup.add(mantletInner);

  if (level < definition.levels.length - 1) {
    const numBarrels = level + 1;
    const spacing = 0.042 * s;
    let positions = [];
    if (numBarrels === 1) positions = [[0, 0]];
    else if (numBarrels === 2) positions = [[-spacing * 0.55, 0], [spacing * 0.55, 0]];
    else if (numBarrels === 3) positions = [[0, spacing * 0.5], [-spacing * 0.62, -spacing * 0.34], [spacing * 0.62, -spacing * 0.34]];
    else positions = [[-spacing * 0.55, spacing * 0.45], [spacing * 0.55, spacing * 0.45], [-spacing * 0.55, -spacing * 0.45], [spacing * 0.55, -spacing * 0.45]];

    const cradle = mk(new THREE.BoxGeometry((0.09 + numBarrels * 0.03) * s, (0.055 + numBarrels * 0.015) * s, 0.06 * s), MAT.turretMetalDark);
    cradle.position.z = -0.005 * s;
    cradle.castShadow = true;
    barrelGroup.add(cradle);

    const braceLeft = mk(new THREE.BoxGeometry(0.02 * s, 0.05 * s, 0.085 * s), MAT.gunMetalMid);
    braceLeft.position.set(-0.055 * s, -0.012 * s, 0.01 * s);
    braceLeft.rotation.x = 0.25;
    braceLeft.castShadow = true;
    barrelGroup.add(braceLeft);

    const braceRight = braceLeft.clone();
    braceRight.position.x = 0.055 * s;
    barrelGroup.add(braceRight);

    const barrelLen = (0.38 + level * 0.055) * s;
    for (const [bx, by] of positions) {
      const barrel = mk(new THREE.CylinderGeometry(bRadius * 0.82, bRadius, barrelLen, 10), MAT.gunMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(bx, by, barrelLen / 2 + 0.04 * s);
      barrel.castShadow = true;
      barrelGroup.add(barrel);

      const sleeve = mk(new THREE.CylinderGeometry(bRadius * 1.6, bRadius * 1.7, 0.045 * s, 10), MAT.gunMetalMid);
      sleeve.rotation.x = Math.PI / 2;
      sleeve.position.set(bx, by, 0.055 * s);
      barrelGroup.add(sleeve);

      const muzzle = mk(new THREE.CylinderGeometry(bRadius * 1.18, bRadius * 0.78, 0.028 * s, 10), MAT.gunMetalMid);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(bx, by, barrelLen + 0.052 * s);
      barrelGroup.add(muzzle);

      barrelData.push({ ox: bx, oy: by, tipZ: barrelLen + 0.06 * s });
    }
  } else {
    const gatCircle = 0.043 * s;
    const gatLen = 0.56 * s;
    const gatRad = 0.0115 * s;

    const rearDrum = mk(new THREE.CylinderGeometry(0.055 * s, 0.058 * s, 0.08 * s, 14), MAT.gunMetalMid);
    rearDrum.rotation.x = Math.PI / 2;
    rearDrum.position.z = 0.02 * s;
    rearDrum.castShadow = true;
    barrelGroup.add(rearDrum);

    const gatGroup = new THREE.Group();
    gatGroup.position.z = 0.05 * s;
    const spindle = mk(new THREE.CylinderGeometry(0.011 * s, 0.011 * s, gatLen + 0.06 * s, 10), MAT.gunMetalMid);
    spindle.rotation.x = Math.PI / 2;
    spindle.position.z = gatLen / 2;
    gatGroup.add(spindle);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const bx = Math.cos(angle) * gatCircle;
      const by = Math.sin(angle) * gatCircle;
      const barrel = mk(new THREE.CylinderGeometry(gatRad * 0.82, gatRad, gatLen, 10), MAT.gunMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(bx, by, gatLen / 2);
      barrel.castShadow = true;
      gatGroup.add(barrel);

      const muzzle = mk(new THREE.CylinderGeometry(gatRad * 1.18, gatRad * 0.72, 0.022 * s, 10), MAT.gunMetalMid);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(bx, by, gatLen + 0.01 * s);
      gatGroup.add(muzzle);
      barrelData.push({ ox: bx, oy: by, tipZ: gatLen + 0.02 * s });
    }

    for (let index = 0; index < 3; index++) {
      const ring = mk(new THREE.TorusGeometry(gatCircle + 0.01 * s, 0.004 * s, 6, 14), MAT.gunMetalMid);
      ring.rotation.x = Math.PI / 2;
      ring.position.z = gatLen * (0.23 + index * 0.25);
      gatGroup.add(ring);
    }

    turret.userData.gatlingGroup = gatGroup;
    barrelGroup.add(gatGroup);
  }

  const muzzleFlashMaterial = new THREE.MeshBasicMaterial({ color: 0xffd37a, transparent: true, opacity: 0 });
  const muzzleFlashes = [];
  for (const tip of barrelData) {
    const flash = mk(new THREE.SphereGeometry(0.028 * s, 10, 10), muzzleFlashMaterial.clone());
    flash.position.set(tip.ox, tip.oy, tip.tipZ);
    flash.scale.set(0.55, 0.55, 1.15);
    flash.visible = false;
    barrelGroup.add(flash);
    muzzleFlashes.push(flash);
  }

  barrelPivot.add(barrelGroup);
  turret.userData.barrelData = barrelData;
  turret.userData.barrelPivot = barrelPivot;
  turret.userData.muzzleFlashes = muzzleFlashes;

  const topIndicator = mk(
    new THREE.BoxGeometry(0.022 * s, 0.015 * s, 0.022 * s),
    new THREE.MeshStandardMaterial({ color: 0x9be56f, emissive: 0x63d144, emissiveIntensity: 0.7, metalness: 0.4, roughness: 0.35 }),
  );
  topIndicator.position.set(0.02 * s, 0.27 * s, 0.02 * s);
  turret.add(topIndicator);

  const sideIndicator = mk(
    new THREE.BoxGeometry(0.018 * s, 0.018 * s, 0.018 * s),
    new THREE.MeshStandardMaterial({ color: 0x8ce96a, emissive: 0x59ce43, emissiveIntensity: 0.6, metalness: 0.35, roughness: 0.32 }),
  );
  sideIndicator.position.set(0.095 * s, 0.03 * s, 0.12 * s);
  turret.add(sideIndicator);
  turret.userData.led = sideIndicator;

  const levelColors = [0x44ff44, 0x66ff44, 0xffff44, 0xffaa22, 0xff4444];
  for (let index = 0; index <= level; index++) {
    const dot = mk(
      new THREE.SphereGeometry(0.005 * s, 4, 4),
      new THREE.MeshStandardMaterial({ color: levelColors[index], emissive: levelColors[index], emissiveIntensity: 0.5 }),
    );
    dot.position.set(-0.14 * s, 0.03 * s + index * 0.026 * s, 0.095 * s);
    turret.add(dot);
  }

  group.add(turret);
  group.userData.turret = turret;
  return group;
}

export class TowerRenderer {
  constructor(scene, towerDefinitions) {
    this.scene = scene;
    this.towerDefinitions = towerDefinitions;
    this.meshes = new Map();
  }

  buildMesh(towerTypeId, level) {
    return buildMg7Mesh(this.towerDefinitions[towerTypeId], level);
  }

  sync(state, elapsedTime) {
    const nextIds = new Set(state.towers.map((tower) => tower.id));
    for (const [towerId, entry] of this.meshes.entries()) {
      if (!nextIds.has(towerId)) {
        this.scene.remove(entry.mesh);
        this.meshes.delete(towerId);
      }
    }

    for (const tower of state.towers) {
      let entry = this.meshes.get(tower.id);
      if (!entry || entry.level !== tower.level) {
        if (entry) this.scene.remove(entry.mesh);
        const mesh = this.buildMesh(tower.towerTypeId, tower.level);
        mesh.position.set(tower.wx, 0, tower.wz);
        this.scene.add(mesh);
        entry = { mesh, level: tower.level };
        this.meshes.set(tower.id, entry);
      }

      entry.mesh.position.set(tower.wx, 0, tower.wz);
      const turret = entry.mesh.userData.turret;
      turret.rotation.y = tower.aimAngle;
      if (turret.userData.barrelPivot) {
        turret.userData.barrelPivot.rotation.x = tower.hasTarget ? -0.22 : -0.28;
      }
      if (tower.level === 4 && turret.userData.gatlingGroup) {
        turret.userData.gatlingGroup.rotation.z += tower.hasTarget ? 0.75 : 0.03;
      }
      if (turret.userData.led) {
        turret.userData.led.material.emissiveIntensity = 0.3 + Math.sin(elapsedTime * 3) * 0.3;
      }
    }
  }

  getTurret(towerId) {
    return this.meshes.get(towerId)?.mesh.userData.turret ?? null;
  }
}
