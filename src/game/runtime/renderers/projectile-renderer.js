import * as THREE from 'three';
import { AUDIO_LEVELS } from '../audio/audio-config.js';
import { mk } from './materials.js';

export class ProjectileRenderer {
  constructor(scene, sfxPlayer = null) {
    this.scene = scene;
    this.sfxPlayer = sfxPlayer;
    this.projectileMeshes = new Map();
    this.particles = [];
  }

  syncProjectiles(state) {
    const nextIds = new Set(state.projectiles.map((projectile) => projectile.id));
    for (const [projectileId, mesh] of this.projectileMeshes.entries()) {
      if (!nextIds.has(projectileId)) {
        this.scene.remove(mesh);
        this.projectileMeshes.delete(projectileId);
      }
    }

    for (const projectile of state.projectiles) {
      let mesh = this.projectileMeshes.get(projectile.id);
      if (!mesh) {
        const group = new THREE.Group();
        group.add(mk(new THREE.SphereGeometry(0.024, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffee44 })));
        const trail = mk(
          new THREE.CylinderGeometry(0.008, 0.003, 0.08, 4),
          new THREE.MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0.5 }),
        );
        trail.rotation.x = Math.PI / 2;
        trail.position.z = -0.04;
        group.add(trail);
        this.scene.add(group);
        mesh = group;
        this.projectileMeshes.set(projectile.id, mesh);
      }

      mesh.position.set(projectile.x, projectile.y, projectile.z);
    }
  }

  handleEffects(effects, towerRenderer) {
    for (const effect of effects) {
      if (effect.type === 'projectile-fired') {
        const turret = towerRenderer.getTurret(effect.towerId);
        if (!turret) continue;
        const barrelData = turret.userData.barrelData ?? [];
        if (barrelData.length === 0) continue;
        const barrel = barrelData[effect.fireIndex % barrelData.length];
        const flash = mk(new THREE.SphereGeometry(0.02, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffffaa }));
        flash.position.set(barrel.ox, barrel.oy, barrel.tipZ + 0.12);
        turret.add(flash);
        this.particles.push({ mesh: flash, life: 0.035, parent: turret, local: true });
        this.sfxPlayer?.play('mg7-shot', {
          volume: AUDIO_LEVELS.mg7Shot,
          playbackRate: 0.99 + Math.random() * 0.04,
          cooldownMs: 0,
        });
      } else if (effect.type === 'hit' || effect.type === 'enemy-killed') {
        if (effect.type === 'hit') {
          const spark = mk(
            new THREE.SphereGeometry(0.028, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xffdd77, transparent: true, opacity: 0.82 }),
          );
          spark.position.set(effect.position.x, effect.position.y, effect.position.z);
          this.scene.add(spark);
          this.particles.push({
            mesh: spark,
            life: 0.08,
            local: false,
            impactPulse: true,
          });
        }

        if (effect.type === 'enemy-killed') {
          const blast = mk(
            new THREE.SphereGeometry(0.12, 10, 10),
            new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.9 }),
          );
          blast.position.set(effect.position.x, effect.position.y + 0.08, effect.position.z);
          this.scene.add(blast);
          this.particles.push({
            mesh: blast,
            life: 0.16,
            local: false,
            explosionFlash: true,
          });
          const smoke = mk(
            new THREE.SphereGeometry(0.09, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x4b5563, transparent: true, opacity: 0.65 }),
          );
          smoke.position.set(effect.position.x, effect.position.y + 0.08, effect.position.z);
          this.scene.add(smoke);
          this.particles.push({
            mesh: smoke,
            life: 0.45,
            local: false,
            smokeCloud: true,
            vy: 0.16,
          });
          this.sfxPlayer?.play('vehicle-explosion', {
            volume: AUDIO_LEVELS.vehicleExplosion,
            playbackRate: 0.95 + Math.random() * 0.08,
            cooldownMs: 40,
          });
        }

        for (let index = 0; index < effect.count; index++) {
          const size = 0.015 + Math.random() * 0.02;
          const mesh = mk(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial({ color: effect.color }));
          mesh.position.set(effect.position.x, effect.position.y, effect.position.z);
          this.scene.add(mesh);
          this.particles.push({
            mesh,
            life: 0.25 + Math.random() * 0.15,
            vx: (Math.random() - 0.5) * 3,
            vy: Math.random() * 3 + 1.5,
            vz: (Math.random() - 0.5) * 3,
            local: false,
          });
        }
      }
    }
  }

  updateParticles(dt) {
    this.particles = this.particles.filter((particle) => {
      particle.life -= dt;
      if (particle.life <= 0) {
        if (particle.local) {
          particle.parent.remove(particle.mesh);
        } else {
          this.scene.remove(particle.mesh);
        }
        return false;
      }

      if (!particle.local) {
        if (particle.explosionFlash) {
          const growth = 1 + dt * 10;
          particle.mesh.scale.multiplyScalar(growth);
          particle.mesh.material.opacity = Math.max(0, particle.life / 0.16);
        } else if (particle.impactPulse) {
          particle.mesh.scale.multiplyScalar(1 + dt * 18);
          particle.mesh.material.opacity = Math.max(0, particle.life / 0.08);
        } else if (particle.smokeCloud) {
          particle.mesh.position.y += particle.vy * dt;
          particle.mesh.scale.multiplyScalar(1 + dt * 2.6);
          particle.mesh.material.opacity = Math.max(0, particle.life / 0.45) * 0.55;
        } else {
          particle.vy -= 12 * dt;
          particle.mesh.position.x += particle.vx * dt;
          particle.mesh.position.y += particle.vy * dt;
          particle.mesh.position.z += particle.vz * dt;
          particle.mesh.material.opacity = Math.max(0, particle.life / 0.35);
          particle.mesh.material.transparent = true;
        }
      }

      return true;
    });
  }
}
