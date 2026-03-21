import * as THREE from 'three';
import { AUDIO_LEVELS } from '../audio/audio-config.js';
import { MAT, mk } from './materials.js';

function buildScoutBuggyMesh() {
  const group = new THREE.Group();
  const chassis = mk(new THREE.BoxGeometry(0.28, 0.07, 0.46), MAT.enemyDark);
  chassis.position.y = 0.1;
  chassis.castShadow = true;
  group.add(chassis);
  const hull = mk(new THREE.BoxGeometry(0.26, 0.09, 0.38), MAT.enemyBody);
  hull.position.y = 0.17;
  hull.castShadow = true;
  group.add(hull);
  const cabin = mk(new THREE.BoxGeometry(0.22, 0.08, 0.14), MAT.enemyDark);
  cabin.position.set(0, 0.26, 0.08);
  cabin.castShadow = true;
  group.add(cabin);
  const windshield = mk(new THREE.BoxGeometry(0.18, 0.06, 0.01), MAT.glass);
  windshield.position.set(0, 0.26, 0.155);
  group.add(windshield);
  const bumper = mk(new THREE.BoxGeometry(0.27, 0.05, 0.03), MAT.steelDark);
  bumper.position.set(0, 0.12, 0.23);
  group.add(bumper);

  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffff66, emissiveIntensity: 0.5 });
  const taillightMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 0.3 });
  for (const side of [-1, 1]) {
    const headlight = mk(new THREE.BoxGeometry(0.04, 0.025, 0.02), headlightMat);
    headlight.position.set(side * 0.09, 0.135, 0.24);
    group.add(headlight);
    const taillight = mk(new THREE.BoxGeometry(0.035, 0.025, 0.01), taillightMat);
    taillight.position.set(side * 0.09, 0.19, -0.225);
    group.add(taillight);
  }

  const wheelPositions = [[-0.15, 0.055, 0.13], [0.15, 0.055, 0.13], [-0.15, 0.055, -0.13], [0.15, 0.055, -0.13]];
  for (const [wx, wy, wz] of wheelPositions) {
    const tire = mk(new THREE.CylinderGeometry(0.052, 0.052, 0.05, 10), MAT.tire);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(wx, wy, wz);
    group.add(tire);
  }

  const hpGroup = new THREE.Group();
  hpGroup.position.y = 0.52;
  hpGroup.add(mk(new THREE.PlaneGeometry(0.42, 0.05), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, side: THREE.DoubleSide })));
  const hpFill = mk(new THREE.PlaneGeometry(0.38, 0.035), new THREE.MeshBasicMaterial({ color: 0x44dd44, side: THREE.DoubleSide }));
  hpFill.position.z = 0.001;
  hpGroup.add(hpFill);
  group.add(hpGroup);
  group.userData.hpGroup = hpGroup;
  group.userData.hpFill = hpFill;
  const targetMarker = new THREE.Group();
  targetMarker.position.y = 0.43;
  targetMarker.visible = false;
  const ring = mk(
    new THREE.TorusGeometry(0.12, 0.01, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffcc55, transparent: true, opacity: 0.9 }),
  );
  ring.rotation.x = Math.PI / 2;
  targetMarker.add(ring);
  const chevron = mk(
    new THREE.ConeGeometry(0.035, 0.08, 3),
    new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.95 }),
  );
  chevron.position.y = 0.08;
  chevron.rotation.z = Math.PI;
  targetMarker.add(chevron);
  group.add(targetMarker);
  group.userData.targetMarker = targetMarker;
  return group;
}

export class EnemyRenderer {
  constructor(scene, sfxPlayer = null) {
    this.scene = scene;
    this.sfxPlayer = sfxPlayer;
    this.meshes = new Map();
    this.engineLoopActive = false;
  }

  sync(state, cameraAngle, elapsedTime) {
    const targetedEnemyIds = new Set(state.towers.map((tower) => tower.targetEnemyId).filter(Boolean));
    const nextIds = new Set(state.enemies.map((enemy) => enemy.id));
    for (const [enemyId, mesh] of this.meshes.entries()) {
      if (!nextIds.has(enemyId)) {
        this.scene.remove(mesh);
        this.meshes.delete(enemyId);
      }
    }

    for (const enemy of state.enemies) {
      let mesh = this.meshes.get(enemy.id);
      if (!mesh) {
        mesh = buildScoutBuggyMesh();
        this.scene.add(mesh);
        this.meshes.set(enemy.id, mesh);
      }

      mesh.position.set(enemy.position.x, enemy.position.y + Math.sin(elapsedTime * 12 + enemy.pathIndex * 2) * 0.003, enemy.position.z);
      mesh.rotation.y = enemy.rotation;
      const hpRatio = enemy.hp / enemy.maxHp;
      mesh.userData.hpFill.scale.x = Math.max(0.01, hpRatio);
      mesh.userData.hpFill.position.x = -(1 - hpRatio) * 0.19;
      mesh.userData.hpFill.material.color.setHex(hpRatio < 0.3 ? 0xdd4444 : hpRatio < 0.6 ? 0xddaa44 : 0x44dd44);
      mesh.userData.hpGroup.rotation.y = -mesh.rotation.y + cameraAngle;
      const targetMarker = mesh.userData.targetMarker;
      if (targetMarker) {
        const isTargeted = targetedEnemyIds.has(enemy.id);
        targetMarker.visible = isTargeted;
        if (isTargeted) {
          targetMarker.rotation.y = cameraAngle;
          targetMarker.position.y = 0.45 + Math.sin(elapsedTime * 6 + enemy.pathIndex) * 0.012;
          targetMarker.children[0].material.opacity = 0.65 + Math.sin(elapsedTime * 8) * 0.18;
        }
      }
    }

    const hasActiveBuggies = state.enemies.some((enemy) => enemy.alive && enemy.enemyTypeId === 'scout-buggy');
    if (hasActiveBuggies && !this.engineLoopActive) {
      this.sfxPlayer?.playLoop('scout-engine', { volume: AUDIO_LEVELS.scoutEngine, playbackRate: 0.98 });
      this.engineLoopActive = true;
    } else if (!hasActiveBuggies && this.engineLoopActive) {
      this.sfxPlayer?.stopLoop('scout-engine', 180);
      this.engineLoopActive = false;
    }
  }
}
