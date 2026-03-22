import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AUDIO_CONFIG } from '../../../config/audio.js';
import { RENDERING_CONFIG } from '../../../config/rendering.js';
import { mk } from './materials.js';

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

function attachHudDecorators(mesh, vehicleScale, vehicleHeight) {
  const hp = ENM.hpBar;
  const hpGroup = new THREE.Group();
  hpGroup.position.y = Math.max(hp.minYOffset, vehicleHeight * hp.yOffsetHeightFactor) * vehicleScale;
  const hpBackgroundMaterial = new THREE.MeshBasicMaterial({
    color: hp.background.color,
    transparent: true,
    opacity: hp.background.opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });
  hpGroup.add(mk(new THREE.PlaneGeometry(hp.background.width, hp.background.height), hpBackgroundMaterial));
  const hpFill = mk(
    new THREE.PlaneGeometry(hp.fill.width, hp.fill.height),
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
  mesh.add(hpGroup);
  mesh.userData.hpGroup = hpGroup;
  mesh.userData.hpFill = hpFill;

  const tm = ENM.targetMarker;
  const targetMarker = new THREE.Group();
  targetMarker.position.y = tm.yOffset * vehicleScale;
  targetMarker.visible = false;
  const ring = mk(new THREE.TorusGeometry(tm.ring.radius, tm.ring.tube, tm.ring.radialSegments, tm.ring.tubularSegments), new THREE.MeshBasicMaterial({ color: tm.ring.color, transparent: true, opacity: tm.ring.opacity }));
  ring.rotation.x = Math.PI / 2;
  targetMarker.add(ring);
  const chevron = mk(new THREE.ConeGeometry(tm.chevron.radius, tm.chevron.height, tm.chevron.segments), new THREE.MeshBasicMaterial({ color: tm.chevron.color, transparent: true, opacity: tm.chevron.opacity }));
  chevron.position.y = tm.chevron.height;
  chevron.rotation.z = Math.PI;
  targetMarker.add(chevron);
  mesh.add(targetMarker);
  mesh.userData.targetMarker = targetMarker;
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
  attachHudDecorators(root, 1, 0.7);
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
  root.userData.headingOffset = visualModel.headingOffset ?? 0;

  const nodeMap = visualModel.assetNodeMap;
  const turretYaw = nodeMap?.turretYaw ? assetRoot.getObjectByName(nodeMap.turretYaw) : null;
  const gunPitch = nodeMap?.gunPitch ? assetRoot.getObjectByName(nodeMap.gunPitch) : null;
  const muzzleNodes = collectMuzzleNodes(assetRoot, nodeMap);

  root.userData.turretYaw = turretYaw;
  root.userData.muzzleNodes = muzzleNodes;
  if (turretYaw) {
    turretYaw.userData.restRotation = turretYaw.rotation.clone();
    turretYaw.userData.gunPitch = gunPitch;
  }
  if (gunPitch) gunPitch.userData.restRotation = gunPitch.rotation.clone();

  attachHudDecorators(root, vehicleScale, size.y);
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
      mesh.userData.hpFill.position.x = -(1 - hpRatio) * hp.fill.halfWidth;
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
          targetMarker.position.y = tm.bob.base + Math.sin(elapsedTime * tm.bob.frequency + enemy.pathIndex) * tm.bob.amplitude;
          targetMarker.children[0].material.opacity = tm.opacityPulse.base + Math.sin(elapsedTime * tm.opacityPulse.frequency) * tm.opacityPulse.amplitude;
        }
      }

      const turretYaw = mesh.userData.turretYaw;
      if (turretYaw) {
        const yawBase = turretYaw.userData.restRotation?.y ?? 0;
        turretYaw.rotation.y = yawBase + Math.sin(elapsedTime * ta.yawFrequency + enemy.pathIndex) * ta.yawAmplitude;
        const gunPitch = turretYaw.userData.gunPitch;
        if (gunPitch) {
          const pitchBase = gunPitch.userData.restRotation?.x ?? 0;
          gunPitch.rotation.x = pitchBase + ta.pitchBase + Math.sin(elapsedTime * ta.pitchFrequency + enemy.pathIndex) * ta.pitchAmplitude;
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
}
