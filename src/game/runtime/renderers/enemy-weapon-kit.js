import * as THREE from 'three';

const DEFAULT_WEAPON_KIT = {
  roofHeightFactor: 0.78,
  mountZOffsetFactor: 0.12,
  turretRadiusFactor: 0.12,
  turretHeightFactor: 0.08,
  collarRadiusFactor: 0.085,
  collarHeightFactor: 0.05,
  gunBlockWidthFactor: 0.2,
  gunBlockHeightFactor: 0.12,
  gunBlockLengthFactor: 0.26,
  gunForwardFactor: 0.24,
  gunPitchOffset: -0.1,
  barrelRadiusFactor: 0.024,
  barrelLengthFactor: 0.3,
  barrelSpacingFactor: 0.06,
  muzzleForwardFactor: 0.04,
  barrelCount: 1,
  colors: {
    mount: 0x2a313b,
    collar: 0x1f252d,
    housing: 0x3c464f,
    barrel: 0x11161d,
    accent: 0x6fa04d,
  },
};

function applyShadowFlags(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
}

function getBarrelOffsets(barrelCount, spacing) {
  if (barrelCount <= 1) return [{ x: 0, y: 0 }];
  if (barrelCount === 2) {
    return [
      { x: -spacing * 0.5, y: 0 },
      { x: spacing * 0.5, y: 0 },
    ];
  }
  if (barrelCount === 3) {
    return [
      { x: -spacing, y: 0 },
      { x: 0, y: 0 },
      { x: spacing, y: 0 },
    ];
  }
  if (barrelCount === 4) {
    return [
      { x: -spacing * 0.75, y: spacing * 0.35 },
      { x: spacing * 0.75, y: spacing * 0.35 },
      { x: -spacing * 0.75, y: -spacing * 0.35 },
      { x: spacing * 0.75, y: -spacing * 0.35 },
    ];
  }

  const offsets = [];
  const radius = spacing * 0.8;
  for (let index = 0; index < barrelCount; index += 1) {
    const angle = (index / barrelCount) * Math.PI * 2;
    offsets.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return offsets;
}

export function attachProceduralWeaponKit(assetRoot, size, weaponKit = {}) {
  const cfg = {
    ...DEFAULT_WEAPON_KIT,
    ...weaponKit,
    colors: {
      ...DEFAULT_WEAPON_KIT.colors,
      ...(weaponKit.colors ?? {}),
    },
  };

  const major = Math.max(size.x, size.z, 1);
  const rootHeight = size.y;

  const mountY = Math.max(rootHeight * cfg.roofHeightFactor, rootHeight * 0.62);
  const mountZ = size.z * cfg.mountZOffsetFactor;

  const turretYaw = new THREE.Group();
  turretYaw.name = 'procedural_turret_yaw';
  turretYaw.position.set(0, mountY, mountZ);
  assetRoot.add(turretYaw);

  const mountRadius = major * cfg.turretRadiusFactor;
  const mountHeight = rootHeight * cfg.turretHeightFactor;
  const mount = new THREE.Mesh(
    new THREE.CylinderGeometry(mountRadius, mountRadius * 1.12, mountHeight, 16),
    new THREE.MeshStandardMaterial({ color: cfg.colors.mount, roughness: 0.64, metalness: 0.56 }),
  );
  mount.position.y = mountHeight * 0.5;
  turretYaw.add(mount);

  const collarHeight = rootHeight * cfg.collarHeightFactor;
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(major * cfg.collarRadiusFactor, major * cfg.collarRadiusFactor * 1.08, collarHeight, 14),
    new THREE.MeshStandardMaterial({ color: cfg.colors.collar, roughness: 0.62, metalness: 0.7 }),
  );
  collar.position.y = mountHeight + collarHeight * 0.42;
  turretYaw.add(collar);

  const gunPitch = new THREE.Group();
  gunPitch.name = 'procedural_gun_pitch';
  gunPitch.position.set(0, mountHeight + collarHeight * 0.78, major * cfg.gunForwardFactor * 0.24);
  gunPitch.rotation.x = cfg.gunPitchOffset;
  turretYaw.add(gunPitch);

  const gunBlockWidth = major * cfg.gunBlockWidthFactor;
  const gunBlockHeight = rootHeight * cfg.gunBlockHeightFactor;
  const gunBlockLength = major * cfg.gunBlockLengthFactor;
  const gunBlock = new THREE.Mesh(
    new THREE.BoxGeometry(gunBlockWidth, gunBlockHeight, gunBlockLength),
    new THREE.MeshStandardMaterial({ color: cfg.colors.housing, roughness: 0.58, metalness: 0.68 }),
  );
  gunBlock.position.z = gunBlockLength * 0.5;
  gunPitch.add(gunBlock);

  const sensor = new THREE.Mesh(
    new THREE.BoxGeometry(gunBlockWidth * 0.2, gunBlockHeight * 0.26, gunBlockWidth * 0.2),
    new THREE.MeshStandardMaterial({ color: cfg.colors.accent, roughness: 0.3, metalness: 0.35, emissive: cfg.colors.accent, emissiveIntensity: 0.25 }),
  );
  sensor.position.set(gunBlockWidth * 0.3, gunBlockHeight * 0.55, 0);
  gunPitch.add(sensor);

  const barrelCount = Math.max(1, Math.floor(cfg.barrelCount));
  const barrelLength = major * cfg.barrelLengthFactor;
  const barrelRadius = major * cfg.barrelRadiusFactor;
  const barrelSpacing = major * cfg.barrelSpacingFactor;
  const barrelOffsets = getBarrelOffsets(barrelCount, barrelSpacing);
  const muzzleNodes = [];

  for (let index = 0; index < barrelOffsets.length; index += 1) {
    const offset = barrelOffsets[index];
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(barrelRadius, barrelRadius * 0.9, barrelLength, 12),
      new THREE.MeshStandardMaterial({ color: cfg.colors.barrel, roughness: 0.42, metalness: 0.82 }),
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(offset.x, offset.y, gunBlockLength + barrelLength * 0.5);
    gunPitch.add(barrel);

    const muzzle = new THREE.Object3D();
    muzzle.name = `muzzle_${String(index + 1).padStart(2, '0')}`;
    muzzle.position.set(offset.x, offset.y, gunBlockLength + barrelLength + major * cfg.muzzleForwardFactor);
    gunPitch.add(muzzle);
    muzzleNodes.push(muzzle);
  }

  applyShadowFlags(turretYaw);
  return { turretYaw, gunPitch, muzzleNodes };
}
