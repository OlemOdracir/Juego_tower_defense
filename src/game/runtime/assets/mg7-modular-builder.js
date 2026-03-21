import * as THREE from 'three';

function createMaterials() {
  return {
    basePaint: new THREE.MeshStandardMaterial({ color: 0x303744, roughness: 0.48, metalness: 0.78 }),
    baseDark: new THREE.MeshStandardMaterial({ color: 0x1f242c, roughness: 0.4, metalness: 0.84 }),
    hullMain: new THREE.MeshStandardMaterial({ color: 0x5e615b, roughness: 0.56, metalness: 0.66 }),
    hullEdge: new THREE.MeshStandardMaterial({ color: 0x88857c, roughness: 0.44, metalness: 0.82 }),
    hullShadow: new THREE.MeshStandardMaterial({ color: 0x43443f, roughness: 0.62, metalness: 0.58 }),
    weaponDark: new THREE.MeshStandardMaterial({ color: 0x171b20, roughness: 0.26, metalness: 0.94 }),
    weaponMid: new THREE.MeshStandardMaterial({ color: 0x3b414b, roughness: 0.32, metalness: 0.9 }),
    indicator: new THREE.MeshStandardMaterial({
      color: 0x96e86b,
      emissive: 0x5ad33f,
      emissiveIntensity: 0.7,
      roughness: 0.35,
      metalness: 0.25,
    }),
  };
}

function mesh(geometry, material, name) {
  const item = new THREE.Mesh(geometry, material);
  item.name = name;
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function addArmorPanel(parent, width, height, depth, position, rotation, material, name) {
  const panel = mesh(new THREE.BoxGeometry(width, height, depth), material, name);
  panel.position.copy(position);
  panel.rotation.set(rotation.x, rotation.y, rotation.z);
  parent.add(panel);
  return panel;
}

function createWeaponCluster(level, scale, materials) {
  const gunPitch = new THREE.Group();
  gunPitch.name = 'gun_pitch';
  gunPitch.rotation.x = -0.26;

  const mantlet = mesh(
    new THREE.CylinderGeometry(0.08 * scale, 0.1 * scale, 0.11 * scale, 20),
    materials.weaponMid,
    'mantlet',
  );
  mantlet.rotation.x = Math.PI / 2;
  gunPitch.add(mantlet);

  const barrelCluster = new THREE.Group();
  barrelCluster.name = 'barrel_cluster';
  gunPitch.add(barrelCluster);

  const muzzleNames = [];

  if (level < 4) {
    const numBarrels = level + 1;
    const spacing = 0.072 * scale;
    let positions = [];
    if (numBarrels === 1) positions = [[0, 0]];
    else if (numBarrels === 2) positions = [[-spacing * 0.5, 0], [spacing * 0.5, 0]];
    else if (numBarrels === 3) positions = [[0, spacing * 0.5], [-spacing * 0.56, -spacing * 0.35], [spacing * 0.56, -spacing * 0.35]];
    else positions = [[-spacing * 0.52, spacing * 0.42], [spacing * 0.52, spacing * 0.42], [-spacing * 0.52, -spacing * 0.42], [spacing * 0.52, -spacing * 0.42]];

    const cradle = mesh(
      new THREE.BoxGeometry((0.16 + numBarrels * 0.045) * scale, (0.08 + numBarrels * 0.018) * scale, 0.1 * scale),
      materials.weaponMid,
      'cradle',
    );
    cradle.position.z = 0.01 * scale;
    barrelCluster.add(cradle);

    const barrelLength = (0.5 + level * 0.08) * scale;
    positions.forEach(([x, y], index) => {
      const barrel = mesh(
        new THREE.CylinderGeometry(0.012 * scale, 0.014 * scale, barrelLength, 12),
        materials.weaponDark,
        `barrel_${String(index + 1).padStart(2, '0')}`,
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(x, y, barrelLength / 2 + 0.07 * scale);
      barrelCluster.add(barrel);

      const sleeve = mesh(
        new THREE.CylinderGeometry(0.02 * scale, 0.022 * scale, 0.06 * scale, 12),
        materials.weaponMid,
        `sleeve_${String(index + 1).padStart(2, '0')}`,
      );
      sleeve.rotation.x = Math.PI / 2;
      sleeve.position.set(x, y, 0.065 * scale);
      barrelCluster.add(sleeve);

      const muzzle = mesh(
        new THREE.CylinderGeometry(0.018 * scale, 0.012 * scale, 0.03 * scale, 12),
        materials.weaponMid,
        `muzzle_${String(index + 1).padStart(2, '0')}`,
      );
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(x, y, barrelLength + 0.09 * scale);
      barrelCluster.add(muzzle);
      muzzleNames.push(muzzle.name);
    });
  } else {
    const gatlingRadius = 0.066 * scale;
    const barrelLength = 0.76 * scale;
    const rearDrum = mesh(
      new THREE.CylinderGeometry(0.075 * scale, 0.08 * scale, 0.11 * scale, 18),
      materials.weaponMid,
      'rear_drum',
    );
    rearDrum.rotation.x = Math.PI / 2;
    rearDrum.position.z = 0.03 * scale;
    barrelCluster.add(rearDrum);

    const spindle = mesh(
      new THREE.CylinderGeometry(0.014 * scale, 0.014 * scale, barrelLength + 0.08 * scale, 12),
      materials.weaponMid,
      'spindle',
    );
    spindle.rotation.x = Math.PI / 2;
    spindle.position.z = barrelLength / 2;
    barrelCluster.add(spindle);

    for (let index = 0; index < 6; index++) {
      const angle = (index / 6) * Math.PI * 2;
      const x = Math.cos(angle) * gatlingRadius;
      const y = Math.sin(angle) * gatlingRadius;
      const barrel = mesh(
        new THREE.CylinderGeometry(0.011 * scale, 0.013 * scale, barrelLength, 12),
        materials.weaponDark,
        `barrel_${String(index + 1).padStart(2, '0')}`,
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(x, y, barrelLength / 2 + 0.05 * scale);
      barrelCluster.add(barrel);

      const muzzle = mesh(
        new THREE.CylinderGeometry(0.018 * scale, 0.011 * scale, 0.026 * scale, 12),
        materials.weaponMid,
        `muzzle_${String(index + 1).padStart(2, '0')}`,
      );
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(x, y, barrelLength + 0.07 * scale);
      barrelCluster.add(muzzle);
      muzzleNames.push(muzzle.name);
    }
  }

  return { gunPitch, muzzleNames };
}

export function buildMg7ModularLevel(level) {
  const scale = 1 + level * 0.08;
  const materials = createMaterials();
  const root = new THREE.Group();
  root.name = `mg7_lvl${level + 1}`;

  const baseStatic = new THREE.Group();
  baseStatic.name = 'base_static';
  root.add(baseStatic);

  const pedestalBottom = mesh(new THREE.CylinderGeometry(0.72 * scale, 0.56 * scale, 0.52 * scale, 8), materials.baseDark, 'pedestal_bottom');
  pedestalBottom.position.y = 0.26 * scale;
  baseStatic.add(pedestalBottom);

  const pedestalRing = mesh(new THREE.CylinderGeometry(0.78 * scale, 0.78 * scale, 0.05 * scale, 20), materials.weaponDark, 'pedestal_ring');
  pedestalRing.position.y = 0.05 * scale;
  baseStatic.add(pedestalRing);

  const collar = mesh(new THREE.CylinderGeometry(0.5 * scale, 0.56 * scale, 0.14 * scale, 12), materials.basePaint, 'pedestal_collar');
  collar.position.y = 0.56 * scale;
  baseStatic.add(collar);

  const turretYaw = new THREE.Group();
  turretYaw.name = 'turret_yaw';
  turretYaw.position.y = 0.62 * scale;
  root.add(turretYaw);

  const turretDeck = mesh(new THREE.BoxGeometry(0.96 * scale, 0.08 * scale, 0.86 * scale), materials.weaponMid, 'turret_deck');
  turretDeck.position.y = 0.02 * scale;
  turretYaw.add(turretDeck);

  const mainBody = mesh(new THREE.BoxGeometry(0.72 * scale, 0.58 * scale, 0.74 * scale), materials.hullMain, 'main_body');
  mainBody.position.y = 0.34 * scale;
  turretYaw.add(mainBody);

  const roof = mesh(new THREE.BoxGeometry(0.74 * scale, 0.08 * scale, 0.62 * scale), materials.hullShadow, 'roof');
  roof.position.set(0, 0.66 * scale, -0.02 * scale);
  turretYaw.add(roof);

  addArmorPanel(
    turretYaw,
    0.22 * scale,
    0.16 * scale,
    0.1 * scale,
    new THREE.Vector3(-0.23 * scale, 0.48 * scale, 0.26 * scale),
    new THREE.Euler(-0.42, 0, 0.16),
    materials.hullEdge,
    'front_armor_left',
  );
  addArmorPanel(
    turretYaw,
    0.22 * scale,
    0.16 * scale,
    0.1 * scale,
    new THREE.Vector3(0.23 * scale, 0.48 * scale, 0.26 * scale),
    new THREE.Euler(-0.42, 0, -0.16),
    materials.hullEdge,
    'front_armor_right',
  );

  const topIndicator = mesh(new THREE.BoxGeometry(0.055 * scale, 0.038 * scale, 0.055 * scale), materials.indicator, 'indicator_top');
  topIndicator.position.set(0.02 * scale, 0.74 * scale, -0.04 * scale);
  turretYaw.add(topIndicator);

  const sideIndicator = mesh(new THREE.BoxGeometry(0.05 * scale, 0.05 * scale, 0.05 * scale), materials.indicator, 'indicator_side');
  sideIndicator.position.set(0.29 * scale, 0.18 * scale, 0.18 * scale);
  turretYaw.add(sideIndicator);

  const leftPanel = mesh(new THREE.BoxGeometry(0.03 * scale, 0.18 * scale, 0.28 * scale), materials.hullShadow, 'left_panel');
  leftPanel.position.set(-0.38 * scale, 0.22 * scale, 0);
  turretYaw.add(leftPanel);

  const rightPanel = leftPanel.clone();
  rightPanel.name = 'right_panel';
  rightPanel.position.x = 0.38 * scale;
  turretYaw.add(rightPanel);

  const { gunPitch, muzzleNames } = createWeaponCluster(level, scale, materials);
  gunPitch.position.set(0, 0.43 * scale, 0.26 * scale);
  turretYaw.add(gunPitch);

  root.userData.exportMeta = {
    level: level + 1,
    nodeMap: {
      turretYaw: 'turret_yaw',
      gunPitch: 'gun_pitch',
      muzzlePrefix: 'muzzle_',
    },
    muzzleNames,
  };

  return root;
}
