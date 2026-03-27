import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AUDIO_CONFIG } from '../../../config/audio.js';
import { RENDERING_CONFIG } from '../../../config/rendering.js';
import { mk } from './materials.js';
import { attachProceduralWeaponKit } from './enemy-weapon-kit.js';

const ENM = RENDERING_CONFIG.enemy;
const vehicleAssetLoader = new GLTFLoader();
const vehicleAssetTemplates = new Map();
const vehicleAssetPromises = new Map();

function resolveAssetUrl(assetPath) {
  return new URL(`../../../../${assetPath}`, import.meta.url).href;
}

async function loadVehicleAssetTemplate(assetPath) {
  if (vehicleAssetTemplates.has(assetPath)) return vehicleAssetTemplates.get(assetPath);
  if (vehicleAssetPromises.has(assetPath)) return vehicleAssetPromises.get(assetPath);

  const promise = vehicleAssetLoader.loadAsync(resolveAssetUrl(assetPath)).then((gltf) => {
    const template = gltf.scene;
    template.traverse((node) => {
      node.castShadow = true;
      node.receiveShadow = true;
    });
    vehicleAssetTemplates.set(assetPath, template);
    vehicleAssetPromises.delete(assetPath);
    return template;
  }).catch((error) => {
    vehicleAssetPromises.delete(assetPath);
    throw error;
  });

  vehicleAssetPromises.set(assetPath, promise);
  return promise;
}

function collectMuzzleNodes(root, nodeMap) {
  if (!nodeMap) return [];
  if (nodeMap.muzzleNames?.length) {
    return nodeMap.muzzleNames
      .map((name) => root.getObjectByName(name))
      .filter(Boolean);
  }

  if (!nodeMap.muzzlePrefix) return [];
  const muzzleNodes = [];
  root.traverse((node) => {
    if (node.name?.startsWith(nodeMap.muzzlePrefix)) muzzleNodes.push(node);
  });
  return muzzleNodes;
}

function hasValidWeaponNodeLayout(assetRoot, size, turretYaw, muzzleNodes) {
  if (!turretYaw || muzzleNodes.length === 0) return false;
  const bounds = new THREE.Box3().setFromObject(assetRoot);
  const worldHeight = Math.max(0.001, bounds.max.y - bounds.min.y);
  const minTurretY = bounds.min.y + worldHeight * 0.35;
  const maxTurretY = bounds.max.y + worldHeight * 0.55;

  const turretWorld = new THREE.Vector3();
  turretYaw.getWorldPosition(turretWorld);
  if (turretWorld.y < minTurretY || turretWorld.y > maxTurretY) {
    return false;
  }

  const world = new THREE.Vector3();
  let validMuzzleCount = 0;
  for (const muzzle of muzzleNodes) {
    muzzle.getWorldPosition(world);
    if (world.y > bounds.min.y + worldHeight * 0.3 && world.y < bounds.max.y + worldHeight * 0.8) {
      validMuzzleCount += 1;
    }
  }
  return validMuzzleCount > 0;
}

function attachHudDecorators(mesh, vehicleScale, vehicleHeight, vehicleWidth) {
  const hp = ENM.hpBar;
  const hpScale = Math.max(hp.minScale ?? 1, vehicleWidth * (hp.scaleByWidthFactor ?? 0.26));
  const hpYOffset = Math.max(hp.minYOffset, vehicleHeight * hp.yOffsetHeightFactor);
  const hpGroup = new THREE.Group();
  hpGroup.position.y = hpYOffset;
  const hpBackgroundMaterial = new THREE.MeshBasicMaterial({
    color: hp.background.color,
    transparent: true,
    opacity: hp.background.opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });
  hpGroup.add(mk(new THREE.PlaneGeometry(hp.background.width * hpScale, hp.background.height * hpScale), hpBackgroundMaterial));
  const hpFill = mk(
    new THREE.PlaneGeometry(hp.fill.width * hpScale, hp.fill.height * hpScale),
    new THREE.MeshBasicMaterial({
      color: hp.colors.healthy,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    }),
  );
  hpFill.position.z = 0.001;
  hpFill.renderOrder = hp.renderOrder + 1;
  hpGroup.add(hpFill);
  hpGroup.renderOrder = hp.renderOrder;
  hpGroup.children[0].renderOrder = hp.renderOrder;
  mesh.add(hpGroup);
  mesh.userData.hpGroup = hpGroup;
  mesh.userData.hpFill = hpFill;
  mesh.userData.hpFillHalfWidth = hp.fill.halfWidth * hpScale;

  const tm = ENM.targetMarker;
  const markerScale = Math.max(tm.minScale ?? 1, vehicleWidth * (tm.scaleByWidthFactor ?? 0.22));
  const targetMarker = new THREE.Group();
  targetMarker.position.y = Math.max(tm.yOffset, vehicleHeight * (tm.yOffsetHeightFactor ?? 0.6));
  targetMarker.userData.baseY = targetMarker.position.y;
  targetMarker.visible = false;
  const ring = mk(
    new THREE.TorusGeometry(
      tm.ring.radius * markerScale,
      tm.ring.tube * markerScale,
      tm.ring.radialSegments,
      tm.ring.tubularSegments,
    ),
    new THREE.MeshBasicMaterial({ color: tm.ring.color, transparent: true, opacity: tm.ring.opacity }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.renderOrder = hp.renderOrder + 2;
  targetMarker.add(ring);
  const chevron = mk(
    new THREE.ConeGeometry(tm.chevron.radius * markerScale, tm.chevron.height * markerScale, tm.chevron.segments),
    new THREE.MeshBasicMaterial({ color: tm.chevron.color, transparent: true, opacity: tm.chevron.opacity }),
  );
  chevron.position.y = tm.chevron.height * markerScale;
  chevron.rotation.z = Math.PI;
  chevron.renderOrder = hp.renderOrder + 3;
  targetMarker.add(chevron);
  mesh.add(targetMarker);
  mesh.userData.targetMarker = targetMarker;
}

function resolveHeadingOffsetFromMuzzle(assetRoot, muzzleNodes, fallbackOffset = 0, extraOffset = 0) {
  if (!muzzleNodes || muzzleNodes.length === 0) {
    return fallbackOffset + extraOffset;
  }

  const avgLocal = new THREE.Vector3();
  const worldPos = new THREE.Vector3();
  for (const muzzle of muzzleNodes) {
    muzzle.getWorldPosition(worldPos);
    avgLocal.add(assetRoot.worldToLocal(worldPos.clone()));
  }
  avgLocal.multiplyScalar(1 / muzzleNodes.length);
  avgLocal.y = 0;

  if (avgLocal.lengthSq() < 0.000001) {
    return fallbackOffset + extraOffset;
  }

  const modelForwardYaw = Math.atan2(avgLocal.x, avgLocal.z);
  return -modelForwardYaw + extraOffset;
}

function averageMuzzleWorldPosition(muzzleNodes) {
  const avg = new THREE.Vector3();
  const pos = new THREE.Vector3();
  for (const muzzle of muzzleNodes) {
    muzzle.getWorldPosition(pos);
    avg.add(pos);
  }
  return avg.multiplyScalar(1 / muzzleNodes.length);
}

function wrapTurretYawPivot(turretYaw, mode = 'bounds', meshRoot = null) {
  if (!turretYaw || !turretYaw.parent) return turretYaw;

  turretYaw.updateMatrixWorld(true);
  const turretWorldPos = new THREE.Vector3();
  turretYaw.getWorldPosition(turretWorldPos);

  let worldCenter;
  if (mode === 'chassis') {
    worldCenter = new THREE.Vector3(0, turretWorldPos.y, 0);
  } else {
    const bounds = new THREE.Box3().setFromObject(turretYaw);
    worldCenter = new THREE.Vector3();
    bounds.getCenter(worldCenter);
    worldCenter.y = turretWorldPos.y;
  }

  // Parent pivot to meshRoot (no rotation) so pivot.rotation.y = world Y (vertical)
  // GLB internal nodes may have Z-up convention from Blender, making their local Y ≠ world Y
  const pivotParent = meshRoot || turretYaw.parent;
  const parentLocalCenter = pivotParent.worldToLocal(worldCenter.clone());

  const pivot = new THREE.Group();
  pivot.name = `${turretYaw.name || 'turret'}_runtime_yaw_pivot`;
  pivot.position.copy(parentLocalCenter);
  pivotParent.add(pivot);
  pivot.attach(turretYaw);
  return pivot;
}

function wrapGunPitchWithPivot(gunPitch, muzzleNodes, t = 0.72, pivotParent = null) {
  if (!gunPitch || !gunPitch.parent || !muzzleNodes?.length) return gunPitch;

  // Use pivotParent (e.g. yaw pivot with world-aligned Y-up) when provided,
  // so pitch rotation.x operates around a proper horizontal axis.
  const parent = pivotParent || gunPitch.parent;
  const gunWorld = new THREE.Vector3();
  const pivotWorld = new THREE.Vector3();
  const parentLocalPivot = new THREE.Vector3();
  gunPitch.getWorldPosition(gunWorld);
  pivotWorld.copy(gunWorld).lerp(averageMuzzleWorldPosition(muzzleNodes), THREE.MathUtils.clamp(t, 0, 0.95));
  parent.worldToLocal(parentLocalPivot.copy(pivotWorld));

  const pivot = new THREE.Group();
  pivot.name = `${gunPitch.name || 'gun'}_runtime_pitch_pivot`;
  pivot.position.copy(parentLocalPivot);
  parent.add(pivot);
  pivot.attach(gunPitch);
  return pivot;
}

function setRotationAxis(object, axis, value) {
  const rotation = object?.rotation ?? object;
  if (!rotation) return;
  if (axis === 'y') rotation.y = value;
  else if (axis === 'z') rotation.z = value;
  else rotation.x = value;
}

function getRotationAxis(object, axis) {
  const rotation = object?.rotation ?? object;
  if (!rotation) return 0;
  if (axis === 'y') return rotation.y;
  if (axis === 'z') return rotation.z;
  return rotation.x;
}

function buildPlaceholderVehicleMesh() {
  const root = new THREE.Group();
  const hull = mk(
    new THREE.BoxGeometry(1.4, 0.7, 3.4),
    new THREE.MeshStandardMaterial({ color: 0x5b6470, roughness: 0.72, metalness: 0.25 }),
  );
  hull.castShadow = true;
  hull.receiveShadow = true;
  hull.position.y = 0.35;
  root.add(hull);
  root.userData.vehicleScale = 1;
  root.userData.vehicleLength = 3.4;
  root.userData.vehicleWidth = 1.4;
  root.userData.vehicleHeight = 0.7;
  root.userData.turretYaw = null;
  root.userData.muzzleNodes = [];
  attachHudDecorators(root, 1, 0.7, 1.4);
  return root;
}

function buildAssetVehicleMesh(definition) {
  const template = vehicleAssetTemplates.get(definition.visualModel.assetPath);
  if (!template) return null;

  const root = new THREE.Group();
  const assetRoot = cloneSkeleton(template);
  const visualModel = definition.visualModel;
  assetRoot.scale.setScalar(visualModel.assetScale ?? 1);
  if (visualModel.assetRotation) {
    assetRoot.rotation.set(
      visualModel.assetRotation.x ?? 0,
      visualModel.assetRotation.y ?? 0,
      visualModel.assetRotation.z ?? 0,
    );
  }
  if (Array.isArray(visualModel.hideNodePatterns) && visualModel.hideNodePatterns.length > 0) {
    assetRoot.traverse((node) => {
      const nodeName = node.name ?? '';
      if (visualModel.hideNodePatterns.some((pattern) => nodeName.includes(pattern))) {
        node.visible = false;
      }
    });
  }
  assetRoot.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(assetRoot);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  assetRoot.position.set(-center.x, -bounds.min.y, -center.z);
  assetRoot.updateMatrixWorld(true);
  root.add(assetRoot);

  const vehicleScale = Math.max(size.y, 1);
  root.userData.assetRoot = assetRoot;
  root.userData.vehicleScale = vehicleScale;
  root.userData.vehicleLength = size.z;
  root.userData.vehicleWidth = size.x;
  root.userData.vehicleHeight = size.y;

  const nodeMap = visualModel.assetNodeMap;
  const forceProceduralWeaponKit = Boolean(visualModel.forceProceduralWeaponKit);
  let turretYaw = nodeMap?.turretYaw ? assetRoot.getObjectByName(nodeMap.turretYaw) : null;
  let gunPitch = nodeMap?.gunPitch ? assetRoot.getObjectByName(nodeMap.gunPitch) : null;
  let muzzleNodes = collectMuzzleNodes(assetRoot, nodeMap);
  const skipWeaponNodeValidation = Boolean(visualModel.skipWeaponNodeValidation);

  if (!forceProceduralWeaponKit && !skipWeaponNodeValidation && !hasValidWeaponNodeLayout(assetRoot, size, turretYaw, muzzleNodes)) {
    turretYaw = null;
    gunPitch = null;
    muzzleNodes = [];
  }

  if (
    definition.combatModel?.isArmed
    && (forceProceduralWeaponKit || !turretYaw || muzzleNodes.length === 0)
  ) {
    const proceduralKit = attachProceduralWeaponKit(assetRoot, size, visualModel.weaponKit ?? {});
    turretYaw = proceduralKit.turretYaw;
    gunPitch = proceduralKit.gunPitch;
    muzzleNodes = proceduralKit.muzzleNodes;
    root.userData.usesProceduralWeaponKit = true;
  } else {
    root.userData.usesProceduralWeaponKit = false;
  }

  // Yaw pivot FIRST — parented to root (world-aligned Y-up)
  const yawPivotMode = visualModel.yawPivotMode;
  if ((visualModel.autoYawPivotFromBounds || yawPivotMode === 'chassis') && turretYaw) {
    turretYaw = wrapTurretYawPivot(turretYaw, yawPivotMode ?? 'bounds', root);
  }

  // Pitch pivot SECOND — parented to yaw pivot so rotation.x = proper horizontal axis
  if (visualModel.pitchPivotFromMuzzle != null && gunPitch && muzzleNodes.length > 0) {
    gunPitch = wrapGunPitchWithPivot(gunPitch, muzzleNodes, visualModel.pitchPivotFromMuzzle, turretYaw);
  }

  root.userData.turretYaw = turretYaw;
  root.userData.muzzleNodes = muzzleNodes;
  root.userData.weaponRig = {
    pitchAxis: visualModel.pitchAxis ?? 'x',
    pitchSign: visualModel.pitchSign ?? -1,
    pitchMin: visualModel.pitchMin ?? -0.6,
    pitchMax: visualModel.pitchMax ?? 0.45,
    turretYawOffset: visualModel.turretYawOffset ?? 0,
  };
  if (turretYaw) {
    turretYaw.userData.restRotation = turretYaw.rotation.clone();
    turretYaw.userData.gunPitch = gunPitch;
  }
  if (gunPitch) gunPitch.userData.restRotation = gunPitch.rotation.clone();

  root.userData.headingOffset = visualModel.autoHeadingFromMuzzle
    ? resolveHeadingOffsetFromMuzzle(
      assetRoot,
      muzzleNodes,
      visualModel.headingOffset ?? 0,
      visualModel.headingOffsetAdjust ?? 0,
    )
    : (visualModel.headingOffset ?? 0);

  // Collect track wheel hub nodes for spinning animation
  const wheelPrefix = visualModel.wheelNodePrefix;
  if (wheelPrefix) {
    const trackWheels = [];
    assetRoot.traverse((node) => {
      if (!node.name || node.isMesh) return;
      const suffix = node.name.slice(wheelPrefix.length);
      if (node.name.startsWith(wheelPrefix) && /^\d*$/.test(suffix)) {
        trackWheels.push(node);
      }
    });
    root.userData.trackWheels = trackWheels.length > 0 ? trackWheels : null;
    root.userData.wheelSpinAxis = visualModel.wheelSpinAxis ?? 'x';
    root.userData.wheelSpinRate = visualModel.wheelSpinRate ?? 2;
  }

  attachHudDecorators(root, vehicleScale, size.y, size.x);
  return root;
}

export class EnemyRenderer {
  constructor(scene, enemyDefinitions, sfxPlayer = null, worldScale = 1) {
    this.scene = scene;
    this.enemyDefinitions = enemyDefinitions;
    this.sfxPlayer = sfxPlayer;
    this.worldScale = worldScale;
    this.meshes = new Map();
    this.pendingMeshes = new Map();
    this.activeEnemyIds = new Set();
    this.engineLoopActive = false;
  }

  requestMesh(enemy) {
    if (this.meshes.has(enemy.id) || this.pendingMeshes.has(enemy.id)) return;

    const definition = this.enemyDefinitions[enemy.enemyTypeId];
    const assetPath = definition.visualModel.assetPath;
    if (!assetPath) return;

    const promise = loadVehicleAssetTemplate(assetPath)
      .then(() => buildAssetVehicleMesh(definition))
      .catch((error) => {
        console.warn(`Failed to load vehicle asset ${assetPath}:`, error);
        return buildPlaceholderVehicleMesh();
      })
      .then((mesh) => {
        this.pendingMeshes.delete(enemy.id);
        if (!this.activeEnemyIds.has(enemy.id)) return;
        mesh.scale.multiplyScalar(this.worldScale);
        this.scene.add(mesh);
        this.meshes.set(enemy.id, mesh);
      })
      .catch((error) => {
        this.pendingMeshes.delete(enemy.id);
        console.warn(`Failed to build mesh for enemy ${enemy.id}:`, error);
      });

    this.pendingMeshes.set(enemy.id, promise);
  }

  sync(state, camera, cameraAngle, elapsedTime) {
    const targetedEnemyIds = new Set(state.towers.map((tower) => tower.targetEnemyId).filter(Boolean));
    const nextIds = new Set(state.enemies.map((enemy) => enemy.id));
    this.activeEnemyIds = nextIds;
    for (const [enemyId, mesh] of this.meshes.entries()) {
      if (!nextIds.has(enemyId)) {
        this.scene.remove(mesh);
        this.meshes.delete(enemyId);
      }
    }

    const bob = ENM.bobbing;
    const hp = ENM.hpBar;
    const tm = ENM.targetMarker;
    const ta = ENM.turretAnimation;
    const hpMode = ENM.hpBar.visibilityMode ?? 'always';
    const cameraQuaternion = camera.quaternion;
    const parentWorldQuaternion = new THREE.Quaternion();
    const inverseParentQuaternion = new THREE.Quaternion();

    for (const enemy of state.enemies) {
      let mesh = this.meshes.get(enemy.id);
      if (!mesh) {
        this.requestMesh(enemy);
        continue;
      }

      mesh.position.set(
        enemy.position.x,
        enemy.position.y + Math.sin(elapsedTime * bob.frequency + enemy.pathIndex * bob.pathIndexMultiplier) * bob.amplitude * this.worldScale,
        enemy.position.z,
      );
      mesh.rotation.y = enemy.rotation + (mesh.userData.headingOffset ?? 0);
      const hpRatio = enemy.hp / enemy.maxHp;
      mesh.userData.hpFill.scale.x = Math.max(0.01, hpRatio);
      mesh.userData.hpFill.position.x = -(1 - hpRatio) * (mesh.userData.hpFillHalfWidth ?? hp.fill.halfWidth);
      mesh.userData.hpFill.material.color.setHex(hpRatio < hp.thresholds.critical ? hp.colors.critical : hpRatio < hp.thresholds.low ? hp.colors.low : hp.colors.healthy);
      const hpGroup = mesh.userData.hpGroup;
      const isTargeted = targetedEnemyIds.has(enemy.id);
      if (hpMode === 'damaged-or-targeted') {
        hpGroup.visible = hpRatio < 0.999 || isTargeted;
      } else {
        hpGroup.visible = true;
      }
      if (hpGroup.visible) {
        mesh.getWorldQuaternion(parentWorldQuaternion);
        inverseParentQuaternion.copy(parentWorldQuaternion).invert();
        hpGroup.quaternion.copy(inverseParentQuaternion.multiply(cameraQuaternion));
      }

      const targetMarker = mesh.userData.targetMarker;
      if (targetMarker) {
        targetMarker.visible = isTargeted;
        if (isTargeted) {
          targetMarker.rotation.y = cameraAngle;
          const baseY = targetMarker.userData.baseY ?? tm.bob.base;
          targetMarker.position.y = baseY + Math.sin(elapsedTime * tm.bob.frequency + enemy.pathIndex) * tm.bob.amplitude;
          targetMarker.children[0].material.opacity = tm.opacityPulse.base + Math.sin(elapsedTime * tm.opacityPulse.frequency) * tm.opacityPulse.amplitude;
        }
      }

      const turretYaw = mesh.userData.turretYaw;
      if (turretYaw) {
        const yawBase = turretYaw.userData.restRotation?.y ?? 0;
        const weaponRig = mesh.userData.weaponRig ?? {};
        if (enemy.targetTowerId) {
          const bodyYaw = enemy.rotation + (mesh.userData.headingOffset ?? 0);
          let relativeYaw = enemy.aimAngle - bodyYaw;
          while (relativeYaw > Math.PI) relativeYaw -= Math.PI * 2;
          while (relativeYaw < -Math.PI) relativeYaw += Math.PI * 2;
          turretYaw.rotation.y = yawBase + relativeYaw + (weaponRig.turretYawOffset ?? 0);
        } else {
          turretYaw.rotation.y = yawBase + Math.sin(elapsedTime * ta.yawFrequency + enemy.pathIndex) * ta.yawAmplitude;
        }
        const gunPitch = turretYaw.userData.gunPitch;
        if (gunPitch) {
          const pitchAxis = weaponRig.pitchAxis ?? 'x';
          const pitchSign = weaponRig.pitchSign ?? -1;
          const pitchBase = getRotationAxis(gunPitch.userData.restRotation ?? gunPitch.rotation, pitchAxis);
          if (enemy.targetTowerId) {
            const clampedPitch = Math.max(weaponRig.pitchMin ?? -0.6, Math.min(weaponRig.pitchMax ?? 0.45, enemy.aimPitch));
            setRotationAxis(gunPitch, pitchAxis, pitchBase + clampedPitch * pitchSign);
          } else {
            const idlePitch = ta.pitchBase + Math.sin(elapsedTime * ta.pitchFrequency + enemy.pathIndex) * ta.pitchAmplitude;
            setRotationAxis(gunPitch, pitchAxis, pitchBase + idlePitch);
          }
        }
      }

      const trackWheels = mesh.userData.trackWheels;
      if (trackWheels) {
        const prevX = mesh.userData._prevX ?? enemy.position.x;
        const prevZ = mesh.userData._prevZ ?? enemy.position.z;
        const dx = enemy.position.x - prevX;
        const dz = enemy.position.z - prevZ;
        mesh.userData._prevX = enemy.position.x;
        mesh.userData._prevZ = enemy.position.z;
        const spinRate = mesh.userData.wheelSpinRate ?? 2;
        const wheelAngle = ((mesh.userData._wheelAngle ?? 0) + Math.sqrt(dx * dx + dz * dz) * spinRate) % (Math.PI * 200);
        mesh.userData._wheelAngle = wheelAngle;
        const spinAxis = mesh.userData.wheelSpinAxis ?? 'x';
        for (const w of trackWheels) {
          w.rotation[spinAxis] = wheelAngle;
        }
      }
    }

    const se = AUDIO_CONFIG.scoutEngine;
    const hasActiveVehicles = state.enemies.some((enemy) => enemy.alive);
    if (hasActiveVehicles && !this.engineLoopActive) {
      this.sfxPlayer?.playLoop('scout-engine', { volume: AUDIO_CONFIG.levels.scoutEngine, playbackRate: se.playbackRate });
      this.engineLoopActive = true;
    } else if (!hasActiveVehicles && this.engineLoopActive) {
      this.sfxPlayer?.stopLoop('scout-engine', se.fadeOutMs);
      this.engineLoopActive = false;
    }
  }

  getMuzzleWorldPosition(enemyId, fireIndex = 0, forwardOffset = 0) {
    const mesh = this.meshes.get(enemyId);
    if (!mesh) return null;
    const muzzleNodes = mesh.userData.muzzleNodes ?? [];
    if (muzzleNodes.length === 0) return null;
    const muzzle = muzzleNodes[Math.abs(fireIndex) % muzzleNodes.length];
    const worldPosition = new THREE.Vector3();
    muzzle.getWorldPosition(worldPosition);

    if (forwardOffset !== 0) {
      const worldQuaternion = new THREE.Quaternion();
      const forward = new THREE.Vector3(0, 0, 1);
      muzzle.getWorldQuaternion(worldQuaternion);
      forward.applyQuaternion(worldQuaternion).normalize().multiplyScalar(forwardOffset);
      worldPosition.add(forward);
    }

    return worldPosition;
  }
}
