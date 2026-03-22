import * as THREE from 'three';
import { AUDIO_CONFIG } from '../../../config/audio.js';
import { EFFECTS_CONFIG } from '../../../config/effects.js';
import { mk } from './materials.js';

const FX = EFFECTS_CONFIG;

function normalizeAtlasFrame(texture, tilesX, tilesY, frame) {
  const safeFrame = Math.max(0, frame);
  const col = safeFrame % tilesX;
  const row = Math.floor(safeFrame / tilesX);
  texture.repeat.set(1 / tilesX, 1 / tilesY);
  texture.offset.set(col / tilesX, 1 - (row + 1) / tilesY);
}

function createFlipbookAtlasCanvas(kind, tilesX, tilesY, tileSize = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = tilesX * tileSize;
  canvas.height = tilesY * tileSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  for (let frame = 0; frame < tilesX * tilesY; frame += 1) {
    const col = frame % tilesX;
    const row = Math.floor(frame / tilesX);
    const x = col * tileSize;
    const y = row * tileSize;
    const t = frame / Math.max(1, tilesX * tilesY - 1);
    const cx = x + tileSize / 2;
    const cy = y + tileSize / 2;

    const ringRadius = kind === 'explosion'
      ? tileSize * (0.12 + t * 0.48)
      : tileSize * (0.2 + Math.sin(t * Math.PI) * 0.22);

    const coreGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringRadius);
    if (kind === 'explosion') {
      coreGradient.addColorStop(0, `rgba(255, 250, 210, ${1 - t * 0.25})`);
      coreGradient.addColorStop(0.38, `rgba(255, 184, 80, ${0.94 - t * 0.35})`);
      coreGradient.addColorStop(0.72, `rgba(255, 96, 24, ${0.72 - t * 0.48})`);
      coreGradient.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      coreGradient.addColorStop(0, `rgba(255, 244, 190, ${0.8 - t * 0.2})`);
      coreGradient.addColorStop(0.45, `rgba(255, 160, 40, ${0.7 - t * 0.2})`);
      coreGradient.addColorStop(0.8, `rgba(216, 84, 16, ${0.5 - t * 0.2})`);
      coreGradient.addColorStop(1, 'rgba(0,0,0,0)');
    }

    ctx.fillStyle = coreGradient;
    ctx.fillRect(x, y, tileSize, tileSize);

    const sparkCount = kind === 'explosion' ? 18 : 10;
    for (let spark = 0; spark < sparkCount; spark += 1) {
      const angle = (spark / sparkCount) * Math.PI * 2 + t * 1.1;
      const spread = ringRadius * (0.18 + ((spark % 5) / 5));
      const sx = cx + Math.cos(angle) * spread;
      const sy = cy + Math.sin(angle) * spread;
      const sRadius = (kind === 'explosion' ? 3.8 : 2.5) * (1 - t * 0.6);
      const sparkGradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, sRadius);
      sparkGradient.addColorStop(0, `rgba(255,255,220,${0.82 - t * 0.5})`);
      sparkGradient.addColorStop(1, 'rgba(255,255,220,0)');
      ctx.fillStyle = sparkGradient;
      ctx.beginPath();
      ctx.arc(sx, sy, sRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return canvas;
}

function createGeneratedFlipbookTexture(kind, config) {
  const canvas = createFlipbookAtlasCanvas(kind, config.tilesX, config.tilesY);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  normalizeAtlasFrame(texture, config.tilesX, config.tilesY, 0);
  return texture;
}

function resolveBlending(mode) {
  return mode === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending;
}

function disposeParticleMesh(scene, particle) {
  scene.remove(particle.mesh);
  if (particle.texture) {
    particle.texture.dispose();
  }
  if (particle.mesh.material) {
    particle.mesh.material.dispose();
  }
  if (particle.mesh.geometry) {
    particle.mesh.geometry.dispose();
  }
}

export class ProjectileRenderer {
  constructor(scene, sfxPlayer = null, worldScale = 1) {
    this.scene = scene;
    this.sfxPlayer = sfxPlayer;
    this.worldScale = worldScale;
    this.projectileMeshes = new Map();
    this.particles = [];
    this.textureLoader = new THREE.TextureLoader();
    this.flipbookTemplates = {
      explosion: createGeneratedFlipbookTexture('explosion', FX.explosionFlipbook),
      fire: createGeneratedFlipbookTexture('fire', FX.fireFlipbook),
    };

    this.tryLoadAtlasTexture('explosion', FX.explosionFlipbook);
    this.tryLoadAtlasTexture('fire', FX.fireFlipbook);
  }

  tryLoadAtlasTexture(key, config) {
    if (!config.atlasUrl) return;
    this.textureLoader.load(
      config.atlasUrl,
      (loadedTexture) => {
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.wrapS = THREE.RepeatWrapping;
        loadedTexture.wrapT = THREE.RepeatWrapping;
        loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        normalizeAtlasFrame(loadedTexture, config.tilesX, config.tilesY, 0);
        this.flipbookTemplates[key]?.dispose();
        this.flipbookTemplates[key] = loadedTexture;
      },
      undefined,
      () => {
        // Keep generated atlas as fallback.
      },
    );
  }

  createFlipbookSprite(position, config, key, scaleMultiplier = 1) {
    const template = this.flipbookTemplates[key];
    if (!template) return null;

    const localTexture = template.clone();
    localTexture.needsUpdate = true;
    normalizeAtlasFrame(localTexture, config.tilesX, config.tilesY, 0);

    const material = new THREE.SpriteMaterial({
      map: localTexture,
      transparent: true,
      opacity: config.opacity,
      depthWrite: false,
      depthTest: false,
      blending: resolveBlending(config.blending),
    });

    const sprite = new THREE.Sprite(material);
    const size = config.size * this.worldScale * scaleMultiplier;
    sprite.scale.set(size, size, 1);
    sprite.position.set(
      position.x,
      position.y + config.yOffset * this.worldScale,
      position.z,
    );
    this.scene.add(sprite);

    return {
      mesh: sprite,
      texture: localTexture,
      life: config.lifetime,
      totalLife: config.lifetime,
      type: 'flipbook',
      frame: -1,
      frameCount: config.frameCount,
      fps: config.fps,
      tilesX: config.tilesX,
      tilesY: config.tilesY,
      maxOpacity: config.opacity,
    };
  }

  createRewardSprite(position, rewardAmount) {
    const cfg = FX.rewardFloatText;
    const canvas = document.createElement('canvas');
    canvas.width = cfg.width;
    canvas.height = cfg.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const rewardText = `+$${rewardAmount}`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${cfg.fontSize}px ${cfg.fontFamily}`;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = cfg.strokeStyle;
    ctx.lineWidth = cfg.strokeWidth;
    ctx.shadowColor = cfg.glowStyle;
    ctx.shadowBlur = 24;
    ctx.strokeText(rewardText, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = cfg.fillStyle;
    ctx.fillText(rewardText, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: cfg.opacity,
      depthWrite: false,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(material);
    const scale = cfg.scale * this.worldScale;
    sprite.scale.set(scale * 2.1, scale, 1);
    sprite.position.set(position.x, position.y + cfg.startYOffset * this.worldScale, position.z);
    this.scene.add(sprite);

    const duration = cfg.durationMin + Math.random() * cfg.durationRange;
    const driftAngle = Math.random() * Math.PI * 2;
    const driftSpeed = cfg.driftSpeed * this.worldScale;
    return {
      mesh: sprite,
      texture,
      life: duration,
      totalLife: duration,
      type: 'reward-text',
      riseSpeed: cfg.riseSpeed * this.worldScale,
      driftX: Math.cos(driftAngle) * driftSpeed,
      driftZ: Math.sin(driftAngle) * driftSpeed,
      pulse: cfg.scalePulse,
      baseScaleX: sprite.scale.x,
      baseScaleY: sprite.scale.y,
      maxOpacity: cfg.opacity,
    };
  }

  spawnSmokePuff(position, config, options = {}) {
    const lifetime = options.lifetime ?? config.lifetime;
    const radius = (options.radius ?? config.radius) * this.worldScale;
    const puff = mk(
      new THREE.SphereGeometry(radius, config.segments, config.segments),
      new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: options.opacity ?? config.opacity,
        depthWrite: false,
      }),
    );
    puff.position.set(
      position.x + (options.offsetX ?? 0),
      position.y + (options.offsetY ?? 0),
      position.z + (options.offsetZ ?? 0),
    );
    this.scene.add(puff);
    this.particles.push({
      mesh: puff,
      life: lifetime,
      totalLife: lifetime,
      type: 'smoke',
      vy: (options.riseSpeed ?? config.upwardSpeed) * this.worldScale,
      vx: options.vx ?? 0,
      vz: options.vz ?? 0,
      growthRate: options.growthRate ?? config.growthRate,
      opacityMultiplier: options.opacityMultiplier ?? config.opacityMultiplier ?? 1,
      maxOpacity: options.opacity ?? config.opacity,
    });
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
        this.particles.push({ mesh: flash, life: mf.lifetime, totalLife: mf.lifetime, type: 'impact-pulse', maxOpacity: 1 });
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
            totalLife: hs.lifetime,
            type: 'impact-pulse',
            growthRate: hs.growthRate,
            maxOpacity: hs.opacity,
          });
        }

        if (effect.type === 'enemy-killed') {
          const explosionSprite = this.createFlipbookSprite(effect.position, FX.explosionFlipbook, 'explosion');
          if (explosionSprite) {
            this.particles.push(explosionSprite);
          } else {
            const fallback = FX.fallbackExplosion;
            const blast = mk(
              new THREE.SphereGeometry(fallback.radius * this.worldScale, fallback.segments, fallback.segments),
              new THREE.MeshBasicMaterial({ color: fallback.color, transparent: true, opacity: fallback.opacity }),
            );
            blast.position.set(
              effect.position.x,
              effect.position.y + fallback.yOffset * this.worldScale,
              effect.position.z,
            );
            this.scene.add(blast);
            this.particles.push({
              mesh: blast,
              life: fallback.lifetime,
              totalLife: fallback.lifetime,
              type: 'explosion-flash',
              growthRate: fallback.growthRate,
              maxOpacity: fallback.opacity,
            });
          }

          const fireSprite = this.createFlipbookSprite(effect.position, FX.fireFlipbook, 'fire', 0.92 + Math.random() * 0.22);
          if (fireSprite) {
            this.particles.push(fireSprite);
          }

          const smokeBurst = FX.smokeBurst;
          this.spawnSmokePuff(effect.position, smokeBurst, {
            offsetY: smokeBurst.yOffset * this.worldScale,
            lifetime: smokeBurst.lifetime,
            opacity: smokeBurst.opacity,
          });

          const smokeTrail = FX.smokeTrail;
          for (let index = 0; index < smokeTrail.puffCount; index += 1) {
            const angle = Math.random() * Math.PI * 2;
            const spread = Math.random() * smokeTrail.spread * this.worldScale;
            this.spawnSmokePuff(effect.position, smokeTrail, {
              offsetX: Math.cos(angle) * spread,
              offsetZ: Math.sin(angle) * spread,
              offsetY: (0.04 + Math.random() * 0.08) * this.worldScale,
              lifetime: smokeTrail.lifetimeMin + Math.random() * smokeTrail.lifetimeRange,
              riseSpeed: smokeTrail.riseSpeed * (0.8 + Math.random() * 0.5),
              opacity: smokeTrail.opacity * (0.82 + Math.random() * 0.18),
              vx: (Math.random() - 0.5) * smokeTrail.driftSpeed * this.worldScale,
              vz: (Math.random() - 0.5) * smokeTrail.driftSpeed * this.worldScale,
              growthRate: smokeTrail.growthRate,
              opacityMultiplier: 0.7,
            });
          }

          if (typeof effect.reward === 'number' && effect.reward > 0) {
            const rewardSprite = this.createRewardSprite(effect.position, effect.reward);
            if (rewardSprite) {
              this.particles.push(rewardSprite);
            }
          }

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
            totalLife: db.lifetimeMin + db.lifetimeRange,
            vx: (Math.random() - 0.5) * db.velocity.horizontal * this.worldScale,
            vy: (Math.random() * db.velocity.verticalRange + db.velocity.verticalMin) * this.worldScale,
            vz: (Math.random() - 0.5) * db.velocity.horizontal * this.worldScale,
            type: 'debris',
            maxOpacity: 1,
          });
        }
      }
    }
  }

  updateParticles(dt) {
    const hs = FX.hitSpark;
    const db = FX.debris;

    this.particles = this.particles.filter((particle) => {
      particle.life -= dt;
      if (particle.life <= 0) {
        disposeParticleMesh(this.scene, particle);
        return false;
      }

      if (particle.type === 'impact-pulse') {
        const growthRate = particle.growthRate ?? hs.growthRate;
        particle.mesh.scale.multiplyScalar(1 + dt * growthRate);
        if (particle.mesh.material) {
          particle.mesh.material.opacity = Math.max(0, particle.life / particle.totalLife) * (particle.maxOpacity ?? 1);
        }
      } else if (particle.type === 'explosion-flash') {
        particle.mesh.scale.multiplyScalar(1 + dt * (particle.growthRate ?? 10));
        if (particle.mesh.material) {
          particle.mesh.material.opacity = Math.max(0, particle.life / particle.totalLife) * (particle.maxOpacity ?? 1);
        }
      } else if (particle.type === 'smoke') {
        particle.mesh.position.y += particle.vy * dt;
        particle.mesh.position.x += particle.vx * dt;
        particle.mesh.position.z += particle.vz * dt;
        particle.mesh.scale.multiplyScalar(1 + dt * particle.growthRate);
        if (particle.mesh.material) {
          particle.mesh.material.opacity = Math.max(0, particle.life / particle.totalLife) * particle.opacityMultiplier * particle.maxOpacity;
        }
      } else if (particle.type === 'debris') {
        particle.vy -= db.gravity * this.worldScale * dt;
        particle.mesh.position.x += particle.vx * dt;
        particle.mesh.position.y += particle.vy * dt;
        particle.mesh.position.z += particle.vz * dt;
        if (particle.mesh.material) {
          particle.mesh.material.opacity = Math.max(0, particle.life / db.opacityLifetime);
          particle.mesh.material.transparent = true;
        }
      } else if (particle.type === 'flipbook') {
        const elapsed = particle.totalLife - particle.life;
        const frame = Math.min(
          particle.frameCount - 1,
          Math.floor(elapsed * particle.fps),
        );
        if (frame !== particle.frame) {
          normalizeAtlasFrame(particle.texture, particle.tilesX, particle.tilesY, frame);
          particle.frame = frame;
        }
        if (particle.mesh.material) {
          particle.mesh.material.opacity = Math.max(0, particle.life / particle.totalLife) * particle.maxOpacity;
        }
      } else if (particle.type === 'reward-text') {
        particle.mesh.position.y += particle.riseSpeed * dt;
        particle.mesh.position.x += particle.driftX * dt;
        particle.mesh.position.z += particle.driftZ * dt;
        const lifeRatio = Math.max(0, particle.life / particle.totalLife);
        const pulse = 1 + (1 - lifeRatio) * particle.pulse;
        particle.mesh.scale.set(particle.baseScaleX * pulse, particle.baseScaleY * pulse, 1);
        if (particle.mesh.material) {
          particle.mesh.material.opacity = lifeRatio * particle.maxOpacity;
        }
      }

      return true;
    });
  }
}
