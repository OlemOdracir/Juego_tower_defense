import * as THREE from 'three';
import { AUDIO_CONFIG } from '../../../config/audio.js';
import { EFFECTS_CONFIG } from '../../../config/effects.js';
import { mk } from './materials.js';

const FX = EFFECTS_CONFIG;

export class ProjectileRenderer {
  constructor(scene, sfxPlayer = null, worldScale = 1) {
    this.scene = scene;
    this.sfxPlayer = sfxPlayer;
    this.worldScale = worldScale;
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
        const s = this.worldScale;
        const pr = FX.projectile;
        const group = new THREE.Group();
        group.add(mk(new THREE.SphereGeometry(pr.sphere.radius * s, pr.sphere.segments, pr.sphere.segments), new THREE.MeshBasicMaterial({ color: pr.sphere.color })));
        const trail = mk(
          new THREE.CylinderGeometry(pr.trail.topRadius * s, pr.trail.bottomRadius * s, pr.trail.height * s, 4),
          new THREE.MeshBasicMaterial({ color: pr.trail.color, transparent: true, opacity: pr.trail.opacity }),
        );
        trail.rotation.x = Math.PI / 2;
        trail.position.z = pr.trail.zOffset * s;
        group.add(trail);
        this.scene.add(group);
        mesh = group;
        this.projectileMeshes.set(projectile.id, mesh);
      }

      mesh.position.set(projectile.x, projectile.y, projectile.z);
      const direction = new THREE.Vector3(projectile.vx ?? 0, projectile.vy ?? 0, projectile.vz ?? 1).normalize();
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    }
  }

  handleEffects(effects, towerRenderer) {
    for (const effect of effects) {
      if (effect.type === 'projectile-fired') {
        const turret = towerRenderer.getTurret(effect.towerId);
        if (!turret) continue;
        const mf = FX.muzzleFlash;
        const muzzleWorldPosition = towerRenderer.getMuzzleWorldPosition(effect.towerId, effect.fireIndex, mf.forwardOffset * this.worldScale);
        if (!muzzleWorldPosition) continue;
        const flash = mk(new THREE.SphereGeometry(mf.radius * this.worldScale, mf.segments, mf.segments), new THREE.MeshBasicMaterial({ color: mf.color }));
        flash.position.copy(muzzleWorldPosition);
        this.scene.add(flash);
        this.particles.push({ mesh: flash, life: mf.lifetime, local: false, impactPulse: true });
        const mg7 = AUDIO_CONFIG.mg7Shot;
        this.sfxPlayer?.play('mg7-shot', {
          volume: AUDIO_CONFIG.levels.mg7Shot,
          playbackRate: mg7.playbackRateMin + Math.random() * mg7.playbackRateRange,
          cooldownMs: mg7.cooldownMs,
        });
      } else if (effect.type === 'hit' || effect.type === 'enemy-killed') {
        if (effect.type === 'hit') {
          const hs = FX.hitSpark;
          const spark = mk(
            new THREE.SphereGeometry(hs.radius * this.worldScale, hs.segments, hs.segments),
            new THREE.MeshBasicMaterial({ color: hs.color, transparent: true, opacity: hs.opacity }),
          );
          spark.position.set(effect.position.x, effect.position.y, effect.position.z);
          this.scene.add(spark);
          this.particles.push({
            mesh: spark,
            life: hs.lifetime,
            local: false,
            impactPulse: true,
          });
        }

        if (effect.type === 'enemy-killed') {
          const bl = FX.explosion.blast;
          const blast = mk(
            new THREE.SphereGeometry(bl.radius * this.worldScale, bl.segments, bl.segments),
            new THREE.MeshBasicMaterial({ color: bl.color, transparent: true, opacity: bl.opacity }),
          );
          blast.position.set(effect.position.x, effect.position.y + bl.yOffset * this.worldScale, effect.position.z);
          this.scene.add(blast);
          this.particles.push({
            mesh: blast,
            life: bl.lifetime,
            local: false,
            explosionFlash: true,
          });
          const sm = FX.explosion.smoke;
          const smoke = mk(
            new THREE.SphereGeometry(sm.radius * this.worldScale, sm.segments, sm.segments),
            new THREE.MeshBasicMaterial({ color: sm.color, transparent: true, opacity: sm.opacity }),
          );
          smoke.position.set(effect.position.x, effect.position.y + bl.yOffset * this.worldScale, effect.position.z);
          this.scene.add(smoke);
          this.particles.push({
            mesh: smoke,
            life: sm.lifetime,
            local: false,
            smokeCloud: true,
            vy: sm.upwardSpeed * this.worldScale,
          });
          const ve = AUDIO_CONFIG.vehicleExplosion;
          this.sfxPlayer?.play('vehicle-explosion', {
            volume: AUDIO_CONFIG.levels.vehicleExplosion,
            playbackRate: ve.playbackRateMin + Math.random() * ve.playbackRateRange,
            cooldownMs: ve.cooldownMs,
          });
        }

        const db = FX.debris;
        for (let index = 0; index < effect.count; index++) {
          const size = (db.sizeMin + Math.random() * db.sizeRange) * this.worldScale;
          const mesh = mk(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial({ color: effect.color }));
          mesh.position.set(effect.position.x, effect.position.y, effect.position.z);
          this.scene.add(mesh);
          this.particles.push({
            mesh,
            life: db.lifetimeMin + Math.random() * db.lifetimeRange,
            vx: (Math.random() - 0.5) * db.velocity.horizontal * this.worldScale,
            vy: (Math.random() * db.velocity.verticalRange + db.velocity.verticalMin) * this.worldScale,
            vz: (Math.random() - 0.5) * db.velocity.horizontal * this.worldScale,
            local: false,
          });
        }
      }
    }
  }

  updateParticles(dt) {
    const bl = FX.explosion.blast;
    const hs = FX.hitSpark;
    const sm = FX.explosion.smoke;
    const db = FX.debris;

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
          const growth = 1 + dt * bl.growthRate;
          particle.mesh.scale.multiplyScalar(growth);
          particle.mesh.material.opacity = Math.max(0, particle.life / bl.lifetime);
        } else if (particle.impactPulse) {
          particle.mesh.scale.multiplyScalar(1 + dt * hs.growthRate);
          particle.mesh.material.opacity = Math.max(0, particle.life / hs.lifetime);
        } else if (particle.smokeCloud) {
          particle.mesh.position.y += particle.vy * dt;
          particle.mesh.scale.multiplyScalar(1 + dt * sm.growthRate);
          particle.mesh.material.opacity = Math.max(0, particle.life / sm.lifetime) * sm.opacityMultiplier;
        } else {
          particle.vy -= db.gravity * this.worldScale * dt;
          particle.mesh.position.x += particle.vx * dt;
          particle.mesh.position.y += particle.vy * dt;
          particle.mesh.position.z += particle.vz * dt;
          particle.mesh.material.opacity = Math.max(0, particle.life / db.opacityLifetime);
          particle.mesh.material.transparent = true;
        }
      }

      return true;
    });
  }
}
