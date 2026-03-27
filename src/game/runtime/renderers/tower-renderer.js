import * as THREE from 'three';
import { MAT, mk } from './materials.js';
import { getMg7MuzzleAnchors } from '../../shared/mg7-geometry.js';
import { RENDERING_CONFIG } from '../../../config/rendering.js';

const TWR = RENDERING_CONFIG.tower;

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
  barrelPivot.rotation.x = TWR.animation.idlePitch;
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
  const muzzleAnchors = [];
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
    const anchors = getMg7MuzzleAnchors(level, stats.scale);
    const positions = anchors.map((anchor) => [anchor.x, anchor.y]);

    const cradle = mk(
      new THREE.BoxGeometry((0.09 + numBarrels * 0.03) * s, (0.055 + numBarrels * 0.015) * s, 0.06 * s),
      MAT.turretMetalDark,
    );
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
      const muzzleAnchor = new THREE.Object3D();
      const anchor = anchors[barrelData.length - 1];
      muzzleAnchor.position.set(anchor.x, anchor.y, anchor.z);
      barrelGroup.add(muzzleAnchor);
      muzzleAnchors.push(muzzleAnchor);
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

    const anchors = getMg7MuzzleAnchors(level, stats.scale);
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
      const muzzleAnchor = new THREE.Object3D();
      const anchor = anchors[i];
      muzzleAnchor.position.set(anchor.x, anchor.y, anchor.z);
      gatGroup.add(muzzleAnchor);
      muzzleAnchors.push(muzzleAnchor);
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

  const mf = TWR.muzzleFlash;
  const muzzleFlashMaterial = new THREE.MeshBasicMaterial({ color: mf.color, transparent: true, opacity: 0 });
  const muzzleFlashes = [];
  for (const tip of barrelData) {
    const flash = mk(new THREE.SphereGeometry(mf.radius * s, mf.segments, mf.segments), muzzleFlashMaterial.clone());
    flash.position.set(tip.ox, tip.oy, tip.tipZ);
    flash.scale.set(mf.scale.x, mf.scale.y, mf.scale.z);
    flash.visible = false;
    barrelGroup.add(flash);
    muzzleFlashes.push(flash);
  }

  barrelPivot.add(barrelGroup);
  turret.userData.barrelData = barrelData;
  turret.userData.barrelPivot = barrelPivot;
  turret.userData.muzzleAnchors = muzzleAnchors;
  turret.userData.muzzleFlashes = muzzleFlashes;

  const ind = TWR.indicator;
  const topIndicator = mk(
    new THREE.BoxGeometry(ind.top.size * s, ind.top.height * s, ind.top.size * s),
    new THREE.MeshStandardMaterial({
      color: ind.top.color,
      emissive: ind.top.emissive,
      emissiveIntensity: ind.top.emissiveIntensity,
      metalness: ind.top.metalness,
      roughness: ind.top.roughness,
    }),
  );
  topIndicator.position.set(ind.top.position.x * s, ind.top.position.y * s, ind.top.position.z * s);
  turret.add(topIndicator);

  const sideIndicator = mk(
    new THREE.BoxGeometry(ind.side.size * s, ind.side.size * s, ind.side.size * s),
    new THREE.MeshStandardMaterial({
      color: ind.side.color,
      emissive: ind.side.emissive,
      emissiveIntensity: ind.side.emissiveIntensity,
      metalness: ind.side.metalness,
      roughness: ind.side.roughness,
    }),
  );
  sideIndicator.position.set(ind.side.position.x * s, ind.side.position.y * s, ind.side.position.z * s);
  turret.add(sideIndicator);
  turret.userData.led = sideIndicator;

  const ld = ind.levelDot;
  for (let index = 0; index <= level; index++) {
    const dot = mk(
      new THREE.SphereGeometry(ld.radius * s, ld.segments, ld.segments),
      new THREE.MeshStandardMaterial({
        color: TWR.levelColors[index],
        emissive: TWR.levelColors[index],
        emissiveIntensity: ld.emissiveIntensity,
      }),
    );
    dot.position.set(ld.position.x * s, ld.position.y * s + index * ld.spacing * s, ld.position.z * s);
    turret.add(dot);
  }

  group.add(turret);
  group.userData.turret = turret;
  return group;
}

function buildWreckMesh(definition, level) {
  const stats = definition.levels[level];
  const s = 0.66 * stats.scale;
  const wreckCfg = TWR.wreck;
  const group = new THREE.Group();
  const wreckMaterial = new THREE.MeshStandardMaterial({
    color: wreckCfg.metalColor,
    roughness: 0.88,
    metalness: 0.24,
  });

  const base = mk(new THREE.CylinderGeometry(0.31 * s, 0.24 * s, wreckCfg.baseHeight * s, 10), wreckMaterial);
  base.position.y = wreckCfg.baseHeight * 0.5 * s;
  base.castShadow = true;
  group.add(base);

  const brokenBody = mk(new THREE.BoxGeometry(0.27 * s, wreckCfg.blockHeight * s, 0.2 * s), wreckMaterial);
  brokenBody.position.set(0.02 * s, 0.19 * s, -0.01 * s);
  brokenBody.rotation.set(0.16, 0.38, -0.08);
  brokenBody.castShadow = true;
  group.add(brokenBody);

  const fragmentA = mk(new THREE.BoxGeometry(0.11 * s, 0.07 * s, 0.08 * s), wreckMaterial);
  fragmentA.position.set(-0.08 * s, 0.2 * s, 0.09 * s);
  fragmentA.rotation.set(0.38, -0.24, 0.12);
  fragmentA.castShadow = true;
  group.add(fragmentA);

  const fragmentB = mk(new THREE.BoxGeometry(0.08 * s, 0.05 * s, 0.07 * s), wreckMaterial);
  fragmentB.position.set(0.1 * s, 0.16 * s, 0.07 * s);
  fragmentB.rotation.set(-0.22, 0.42, -0.24);
  fragmentB.castShadow = true;
  group.add(fragmentB);

  const barrelSegments = Math.min(2 + level, 4);
  for (let index = 0; index < barrelSegments; index += 1) {
    const barrel = mk(
      new THREE.CylinderGeometry(0.012 * s, 0.012 * s, (0.24 + index * 0.02) * s, 10),
      wreckMaterial,
    );
    barrel.rotation.set(Math.PI / 2 + wreckCfg.barrelTilt * 0.22, -0.08 + index * 0.05, 0.16);
    barrel.position.set(-0.02 * s + index * 0.015 * s, 0.19 * s, 0.15 * s);
    barrel.castShadow = true;
    group.add(barrel);
  }

  group.visible = false;
  return group;
}

function buildDamageFxGroup(definition, level) {
  const stats = definition.levels[level];
  const s = 0.66 * stats.scale;
  const dmg = TWR.damageState;
  const group = new THREE.Group();
  const flames = [];
  const smokes = [];

  for (let i = 0; i < 3; i += 1) {
    const flame = mk(
      new THREE.SphereGeometry(0.03 * s * (1 + i * 0.2), 8, 8),
      new THREE.MeshBasicMaterial({
        color: dmg.fireColor,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    flame.position.set((-0.05 + i * 0.05) * s, dmg.fireBaseHeight * s, (0.01 + i * 0.02) * s);
    group.add(flame);
    flames.push(flame);
  }

  for (let i = 0; i < 4; i += 1) {
    const smoke = mk(
      new THREE.SphereGeometry(0.045 * s * (1 + i * 0.16), 8, 8),
      new THREE.MeshBasicMaterial({
        color: dmg.smokeColor,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    smoke.position.set((-0.06 + i * 0.04) * s, (dmg.smokeBaseHeight + i * 0.07) * s, (-0.02 + i * 0.015) * s);
    smoke.userData.baseY = smoke.position.y;
    smoke.userData.baseX = smoke.position.x;
    group.add(smoke);
    smokes.push(smoke);
  }

  group.visible = false;
  group.userData.flames = flames;
  group.userData.smokes = smokes;
  return group;
}

function buildTowerHpBar(definition, level, worldScale) {
  const stats = definition.levels[level];
  const cfg = TWR.hpBar;
  const hpScale = worldScale * stats.scale;
  const group = new THREE.Group();
  group.position.y = cfg.yOffsetBase * hpScale;
  group.renderOrder = cfg.renderOrder;

  const background = mk(
    new THREE.PlaneGeometry(cfg.widthBase * hpScale, cfg.heightBase * hpScale),
    new THREE.MeshBasicMaterial({
      color: cfg.backgroundColor,
      transparent: true,
      opacity: cfg.backgroundOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    }),
  );
  background.renderOrder = cfg.renderOrder;
  group.add(background);

  const fill = mk(
    new THREE.PlaneGeometry(cfg.fillWidthBase * hpScale, cfg.fillHeightBase * hpScale),
    new THREE.MeshBasicMaterial({
      color: cfg.colors.healthy,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    }),
  );
  fill.position.z = 0.001;
  fill.renderOrder = cfg.renderOrder + 1;
  group.add(fill);

  return {
    group,
    fill,
    halfWidth: (cfg.fillWidthBase * hpScale) * 0.5,
  };
}

export class TowerRenderer {
  constructor(scene, towerDefinitions, worldScale = 1) {
    this.scene = scene;
    this.towerDefinitions = towerDefinitions;
    this.worldScale = worldScale;
    this.meshes = new Map();
  }

  buildMesh(towerTypeId, level) {
    const mesh = buildMg7Mesh(this.towerDefinitions[towerTypeId], level);
    mesh.scale.setScalar(this.worldScale);
    return mesh;
  }

  buildWreck(towerTypeId, level) {
    const wreck = buildWreckMesh(this.towerDefinitions[towerTypeId], level);
    wreck.scale.setScalar(this.worldScale);
    return wreck;
  }

  buildDamageFx(towerTypeId, level) {
    const fx = buildDamageFxGroup(this.towerDefinitions[towerTypeId], level);
    fx.scale.setScalar(this.worldScale);
    return fx;
  }

  sync(state, elapsedTime, camera = null) {
    const targetedTowerIds = new Set(state.enemies.map((enemy) => enemy.targetTowerId).filter(Boolean));
    const hpCfg = TWR.hpBar;
    const nextIds = new Set(state.towers.map((tower) => tower.id));
    for (const [towerId, entry] of this.meshes.entries()) {
      if (!nextIds.has(towerId)) {
        this.scene.remove(entry.root);
        this.meshes.delete(towerId);
      }
    }

    const anim = TWR.animation;
    for (const tower of state.towers) {
      let entry = this.meshes.get(tower.id);
      if (!entry || entry.level !== tower.level) {
        if (entry) this.scene.remove(entry.root);

        const root = new THREE.Group();
        const mesh = this.buildMesh(tower.towerTypeId, tower.level);
        const wreck = this.buildWreck(tower.towerTypeId, tower.level);
        const damageFx = this.buildDamageFx(tower.towerTypeId, tower.level);
        const hpBar = buildTowerHpBar(this.towerDefinitions[tower.towerTypeId], tower.level, this.worldScale);
        root.add(mesh);
        root.add(wreck);
        root.add(damageFx);
        root.add(hpBar.group);
        this.scene.add(root);

        entry = { root, mesh, wreck, damageFx, level: tower.level, hpBar };
        this.meshes.set(tower.id, entry);
      }

      entry.root.position.set(tower.wx, 0, tower.wz);
      const turret = entry.mesh.userData.turret;
      turret.rotation.y = tower.aimAngle;
      if (turret.userData.barrelPivot) {
        turret.userData.barrelPivot.rotation.x = tower.hasTarget ? tower.aimPitch : anim.idlePitch;
      }
      if (tower.level === 4 && turret.userData.gatlingGroup) {
        turret.userData.gatlingGroup.rotation.z += tower.hasTarget ? anim.gatlingSpeedActive : anim.gatlingSpeedIdle;
      }
      if (turret.userData.led) {
        turret.userData.led.material.emissiveIntensity =
          anim.ledPulse.base + Math.sin(elapsedTime * anim.ledPulse.frequency) * anim.ledPulse.amplitude;
      }

      const hpRatio = tower.maxHp > 0 ? tower.hp / tower.maxHp : 0;
      const showDamage = !tower.destroyed && (tower.damageFxActive || hpRatio <= TWR.damageState.threshold);
      const showWreck = tower.destroyed;
      const isTargeted = targetedTowerIds.has(tower.id);
      entry.mesh.visible = !showWreck;
      entry.wreck.visible = showWreck;
      entry.damageFx.visible = showDamage || showWreck;
      entry.hpBar.fill.scale.x = Math.max(0.01, hpRatio);
      entry.hpBar.fill.position.x = -(1 - hpRatio) * entry.hpBar.halfWidth;
      entry.hpBar.fill.material.color.setHex(
        hpRatio < hpCfg.thresholds.critical
          ? hpCfg.colors.critical
          : hpRatio < hpCfg.thresholds.low
            ? hpCfg.colors.low
            : hpCfg.colors.healthy,
      );
      if (hpCfg.visibilityMode === 'damaged-or-targeted') {
        entry.hpBar.group.visible = hpRatio < 0.999 || isTargeted || tower.destroyed;
      } else {
        entry.hpBar.group.visible = true;
      }
      if (entry.hpBar.group.visible && camera) {
        entry.hpBar.group.quaternion.copy(camera.quaternion);
      }

      if (entry.damageFx.visible) {
        const flames = entry.damageFx.userData.flames ?? [];
        const smokes = entry.damageFx.userData.smokes ?? [];
        for (let index = 0; index < flames.length; index += 1) {
          const flame = flames[index];
          const phase = elapsedTime * 9 + index * 0.9;
          const flicker = 0.58 + Math.sin(phase) * 0.24;
          flame.scale.setScalar(0.7 + flicker * (showWreck ? 1.2 : 0.9));
          flame.material.opacity = showWreck ? 0.7 + Math.sin(phase * 0.7) * 0.1 : 0.52 + Math.sin(phase) * 0.08;
        }
        for (let index = 0; index < smokes.length; index += 1) {
          const smoke = smokes[index];
          const drift = Math.sin(elapsedTime * (1.8 + index * 0.22) + index);
          smoke.position.y += showWreck ? 0.0015 : 0.001;
          smoke.position.x += drift * 0.0002;
          const fadeBase = showWreck ? 0.42 : 0.3;
          smoke.material.opacity = fadeBase + Math.sin(elapsedTime * 0.8 + index) * 0.08;
          const maxY = (smoke.userData.baseY ?? 0.4) + 0.55;
          if (smoke.position.y > maxY) {
            smoke.position.y = smoke.userData.baseY ?? 0.4;
            smoke.position.x = smoke.userData.baseX ?? 0;
          }
        }
      }
    }
  }

  getTowerRoot(towerId) {
    return this.meshes.get(towerId)?.root ?? null;
  }

  getTowerCenter(towerId) {
    const root = this.getTowerRoot(towerId);
    if (!root) return null;
    const center = new THREE.Vector3();
    root.getWorldPosition(center);
    return center;
  }

  getTurret(towerId) {
    return this.meshes.get(towerId)?.mesh.userData.turret ?? null;
  }

  getMuzzleWorldPosition(towerId, fireIndex = 0, forwardOffset = 0) {
    const turret = this.getTurret(towerId);
    const muzzleAnchors = turret?.userData.muzzleAnchors ?? [];
    if (muzzleAnchors.length === 0) return null;
    const anchor = muzzleAnchors[fireIndex % muzzleAnchors.length];
    const worldPosition = new THREE.Vector3();
    anchor.getWorldPosition(worldPosition);
    if (forwardOffset !== 0) {
      const worldQuaternion = new THREE.Quaternion();
      const forward = new THREE.Vector3(0, 0, 1);
      anchor.getWorldQuaternion(worldQuaternion);
      forward.applyQuaternion(worldQuaternion).normalize().multiplyScalar(forwardOffset);
      worldPosition.add(forward);
    }
    return worldPosition;
  }
}
