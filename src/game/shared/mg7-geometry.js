function getLevelScale(levelScale) {
  return 0.66 * levelScale;
}

function getStandardBarrelPositions(levelScale, level) {
  const s = getLevelScale(levelScale);
  const numBarrels = level + 1;
  const spacing = 0.042 * s;
  let positions = [];

  if (numBarrels === 1) positions = [[0, 0]];
  else if (numBarrels === 2) positions = [[-spacing * 0.55, 0], [spacing * 0.55, 0]];
  else if (numBarrels === 3) positions = [[0, spacing * 0.5], [-spacing * 0.62, -spacing * 0.34], [spacing * 0.62, -spacing * 0.34]];
  else positions = [[-spacing * 0.55, spacing * 0.45], [spacing * 0.55, spacing * 0.45], [-spacing * 0.55, -spacing * 0.45], [spacing * 0.55, -spacing * 0.45]];

  const barrelLen = (0.38 + level * 0.055) * s;
  const tipZ = barrelLen + 0.066 * s;
  return positions.map(([x, y]) => ({ x, y, z: tipZ }));
}

function getGatlingBarrelPositions(levelScale) {
  const s = getLevelScale(levelScale);
  const radius = 0.043 * s;
  const tipZ = 0.56 * s + 0.02 * s;
  const points = [];

  for (let index = 0; index < 6; index++) {
    const angle = (index / 6) * Math.PI * 2;
    points.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: tipZ,
    });
  }

  return points;
}

export function getMg7MuzzleAnchors(level, levelScale) {
  if (level >= 4) {
    return getGatlingBarrelPositions(levelScale);
  }
  return getStandardBarrelPositions(levelScale, level);
}

export function getMg7MuzzleAnchor(level, levelScale, fireIndex = 0) {
  const anchors = getMg7MuzzleAnchors(level, levelScale);
  if (!anchors.length) return { x: 0, y: 0, z: 0 };
  return anchors[fireIndex % anchors.length];
}

export function clampMg7Pitch(pitch, minPitch = -0.72, maxPitch = 0.5) {
  return Math.max(minPitch, Math.min(maxPitch, pitch));
}

export function getMg7Direction(aimAngle, aimPitch) {
  const pitchCos = Math.cos(aimPitch);
  return {
    x: Math.sin(aimAngle) * pitchCos,
    y: -Math.sin(aimPitch),
    z: Math.cos(aimAngle) * pitchCos,
  };
}

export function getMg7MuzzleWorld(tower, levelScale, worldScale = 1, fireIndex = 0) {
  const s = getLevelScale(levelScale);
  const anchor = getMg7MuzzleAnchor(tower.level, levelScale, fireIndex);

  const sinPitch = Math.sin(tower.aimPitch ?? 0);
  const cosPitch = Math.cos(tower.aimPitch ?? 0);
  const sinYaw = Math.sin(tower.aimAngle ?? 0);
  const cosYaw = Math.cos(tower.aimAngle ?? 0);

  const localX = anchor.x * worldScale;
  const localY = (0.355 * s + anchor.y * cosPitch - anchor.z * sinPitch) * worldScale;
  const localZ = (0.11 * s + anchor.y * sinPitch + anchor.z * cosPitch) * worldScale;

  return {
    x: tower.wx + localX * cosYaw + localZ * sinYaw,
    y: localY,
    z: tower.wz - localX * sinYaw + localZ * cosYaw,
  };
}
